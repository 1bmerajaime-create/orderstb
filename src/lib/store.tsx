import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppData,
  BowlSize,
  Event,
  Material,
  Order,
  OrderLine,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductRecipe,
  Promotion,
} from '../types';
import {
  createOrderAtomic,
  ensureSeeded,
  removeEvent,
  removeMaterial,
  removeOrderAndRenumber,
  removeProduct,
  removePromotion,
  removeRecipe,
  removeSize,
  subscribeAppData,
  upsertEvent,
  upsertMaterial,
  upsertOrder,
  upsertProduct,
  upsertPromotion,
  upsertRecipe,
  upsertSize,
} from './cloud';
import { cloudLogin, cloudLogout, isCloudEnabled } from './firebase';
import { isAuthenticated, loadData, saveData, setAuthenticated } from './storage';
import { PASSWORD } from './seed';
import { migrateCatalog } from './productSizes';
import {
  calcDiscount,
  calcSubtotal,
  nextOrderNumber,
  round2,
  uid,
} from './utils';

function normalizeAppData(data: AppData): AppData {
  const catalog = migrateCatalog(data);
  return {
    ...data,
    recipes: catalog.recipes,
    sizes: catalog.sizes,
    products: catalog.products,
    materials: catalog.materials,
  };
}

interface StoreContextValue {
  data: AppData;
  authenticated: boolean;
  syncReady: boolean;
  syncError: string | null;
  cloudEnabled: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  // Events
  addEvent: (e: Omit<Event, 'id' | 'createdAt'>) => Promise<Event>;
  updateEvent: (id: string, patch: Partial<Event>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  // Recipes (productos)
  addRecipe: (r: Omit<ProductRecipe, 'id'>) => Promise<ProductRecipe>;
  updateRecipe: (id: string, patch: Partial<ProductRecipe>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  // Sizes
  addSize: (s: Omit<BowlSize, 'id'>) => Promise<BowlSize>;
  updateSize: (id: string, patch: Partial<BowlSize>) => Promise<void>;
  deleteSize: (id: string) => Promise<void>;
  // Catalog lines (products)
  addProduct: (p: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  // Materials
  addMaterial: (m: Omit<Material, 'id'>) => Promise<Material>;
  updateMaterial: (id: string, patch: Partial<Material>) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  // Promotions
  addPromotion: (p: Omit<Promotion, 'id'>) => Promise<Promotion>;
  updatePromotion: (id: string, patch: Partial<Promotion>) => Promise<void>;
  deletePromotion: (id: string) => Promise<void>;
  // Orders
  createOrder: (input: {
    eventId: string;
    customerName: string;
    customerEmail?: string;
    lines: OrderLine[];
    promotionId?: string;
    paymentMethod: PaymentMethod;
    paid: boolean;
    /** Descuento manual de pedido (además o en lugar de promo). */
    extraDiscount?: number;
  }) => Promise<Order>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  markPaid: (id: string, method: PaymentMethod) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
}

const emptyData: AppData = {
  events: [],
  recipes: [],
  sizes: [],
  products: [],
  materials: [],
  promotions: [],
  orders: [],
  orderCounter: {},
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const cloudEnabled = isCloudEnabled;
  const [data, setData] = useState<AppData>(() =>
    cloudEnabled ? emptyData : normalizeAppData(loadData()),
  );
  const [authenticated, setAuth] = useState(() => isAuthenticated());
  const [syncReady, setSyncReady] = useState(!cloudEnabled);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Persistencia local solo si no hay nube
  useEffect(() => {
    if (!cloudEnabled) saveData(data);
  }, [cloudEnabled, data]);

  // Suscripción Firestore cuando hay sesión
  useEffect(() => {
    if (!cloudEnabled || !authenticated) {
      setSyncReady(!cloudEnabled);
      return;
    }

    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        await cloudLogin();
        await ensureSeeded();
        if (cancelled) return;
        unsub = subscribeAppData(
          (next) => {
            setData(normalizeAppData(next));
            setSyncReady(true);
            setSyncError(null);
          },
          (error) => {
            setSyncError(error.message);
            setSyncReady(false);
          },
        );
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : 'Error de sincronización',
        );
        setSyncReady(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [cloudEnabled, authenticated]);

  const login = useCallback(async (password: string) => {
    if (password !== PASSWORD) return false;
    if (cloudEnabled) {
      try {
        await cloudLogin();
      } catch {
        return false;
      }
    }
    setAuthenticated(true);
    setAuth(true);
    return true;
  }, [cloudEnabled]);

  const logout = useCallback(async () => {
    if (cloudEnabled) await cloudLogout();
    setAuthenticated(false);
    setAuth(false);
    if (cloudEnabled) {
      setData(emptyData);
      setSyncReady(false);
    }
  }, [cloudEnabled]);

  const addEvent = useCallback(
    async (e: Omit<Event, 'id' | 'createdAt'>) => {
      const event: Event = {
        ...e,
        materialsUsed: e.materialsUsed || [],
        id: uid('evt'),
        createdAt: new Date().toISOString(),
      };
      if (cloudEnabled) {
        await upsertEvent(event);
      } else {
        setData((prev) => ({ ...prev, events: [event, ...prev.events] }));
      }
      return event;
    },
    [cloudEnabled],
  );

  const updateEvent = useCallback(
    async (id: string, patch: Partial<Event>) => {
      if (cloudEnabled) {
        const current = data.events.find((e) => e.id === id);
        if (!current) return;
        await upsertEvent({ ...current, ...patch });
        return;
      }
      setData((prev) => ({
        ...prev,
        events: prev.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
    },
    [cloudEnabled, data.events],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      if (cloudEnabled) {
        await removeEvent(id);
        return;
      }
      setData((prev) => {
        const { [id]: _removed, ...orderCounter } = prev.orderCounter;
        return {
          ...prev,
          events: prev.events.filter((e) => e.id !== id),
          orders: prev.orders.filter((o) => o.eventId !== id),
          orderCounter,
        };
      });
    },
    [cloudEnabled],
  );

  const addRecipe = useCallback(
    async (r: Omit<ProductRecipe, 'id'>) => {
      const recipe: ProductRecipe = { ...r, id: uid('recipe') };
      if (cloudEnabled) await upsertRecipe(recipe);
      else
        setData((prev) => ({
          ...prev,
          recipes: [recipe, ...prev.recipes],
        }));
      return recipe;
    },
    [cloudEnabled],
  );

  const updateRecipe = useCallback(
    async (id: string, patch: Partial<ProductRecipe>) => {
      if (cloudEnabled) {
        const current = data.recipes.find((r) => r.id === id);
        if (!current) return;
        await upsertRecipe({ ...current, ...patch });
        return;
      }
      setData((prev) => ({
        ...prev,
        recipes: prev.recipes.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      }));
    },
    [cloudEnabled, data.recipes],
  );

  const deleteRecipe = useCallback(
    async (id: string) => {
      if (cloudEnabled) {
        const lines = data.products.filter((p) => p.recipeId === id);
        for (const line of lines) {
          await removeProduct(line.id);
        }
        await removeRecipe(id);
        return;
      }
      setData((prev) => ({
        ...prev,
        recipes: prev.recipes.filter((r) => r.id !== id),
        products: prev.products.filter((p) => p.recipeId !== id),
      }));
    },
    [cloudEnabled, data.products],
  );

  const addSize = useCallback(
    async (s: Omit<BowlSize, 'id'>) => {
      const size: BowlSize = {
        ...s,
        id: `size-${s.ml}`,
      };
      if (cloudEnabled) await upsertSize(size);
      else
        setData((prev) => ({
          ...prev,
          sizes: [
            ...prev.sizes.filter((item) => item.id !== size.id && item.ml !== size.ml),
            size,
          ].sort((a, b) => a.ml - b.ml),
        }));
      return size;
    },
    [cloudEnabled],
  );

  const updateSize = useCallback(
    async (id: string, patch: Partial<BowlSize>) => {
      if (cloudEnabled) {
        const current = data.sizes.find((s) => s.id === id);
        if (!current) return;
        const next = { ...current, ...patch };
        // Si cambia ml, actualizar id canónico
        const canonical: BowlSize = {
          ...next,
          id: `size-${next.ml}`,
        };
        if (canonical.id !== id) {
          await upsertSize(canonical);
          await removeSize(id);
          // Reasignar líneas al nuevo sizeId
          const lines = data.products.filter((p) => p.sizeId === id);
          for (const line of lines) {
            await upsertProduct({ ...line, sizeId: canonical.id });
          }
          return;
        }
        await upsertSize(canonical);
        return;
      }
      setData((prev) => {
        const current = prev.sizes.find((s) => s.id === id);
        if (!current) return prev;
        const next = { ...current, ...patch };
        const canonical: BowlSize = { ...next, id: `size-${next.ml}` };
        return {
          ...prev,
          sizes: prev.sizes
            .filter((s) => s.id !== id)
            .concat(canonical)
            .sort((a, b) => a.ml - b.ml),
          products: prev.products.map((p) =>
            p.sizeId === id ? { ...p, sizeId: canonical.id } : p,
          ),
        };
      });
    },
    [cloudEnabled, data.sizes, data.products],
  );

  const deleteSize = useCallback(
    async (id: string) => {
      if (cloudEnabled) {
        const lines = data.products.filter((p) => p.sizeId === id);
        for (const line of lines) {
          await removeProduct(line.id);
        }
        await removeSize(id);
        return;
      }
      setData((prev) => ({
        ...prev,
        sizes: prev.sizes.filter((s) => s.id !== id),
        products: prev.products.filter((p) => p.sizeId !== id),
      }));
    },
    [cloudEnabled, data.products],
  );

  const addProduct = useCallback(
    async (p: Omit<Product, 'id'>) => {
      const product: Product = {
        ...p,
        id: `${p.recipeId}-${data.sizes.find((s) => s.id === p.sizeId)?.ml ?? uid('line')}`,
      };
      // Preferir id estable recipe-ml
      const size = data.sizes.find((s) => s.id === p.sizeId);
      const stable: Product = {
        recipeId: p.recipeId,
        sizeId: p.sizeId,
        id: size ? `${p.recipeId}-${size.ml}` : product.id,
      };
      if (cloudEnabled) await upsertProduct(stable);
      else
        setData((prev) => ({
          ...prev,
          products: [stable, ...prev.products],
        }));
      return stable;
    },
    [cloudEnabled, data.sizes],
  );

  const updateProduct = useCallback(
    async (id: string, patch: Partial<Product>) => {
      if (cloudEnabled) {
        const current = data.products.find((p) => p.id === id);
        if (!current) return;
        const merged = { ...current, ...patch };
        const size = data.sizes.find((s) => s.id === merged.sizeId);
        const next: Product = {
          recipeId: merged.recipeId,
          sizeId: merged.sizeId,
          id: size
            ? `${merged.recipeId}-${size.ml}`
            : merged.id,
        };
        await upsertProduct(next);
        if (next.id !== id) await removeProduct(id);
        return;
      }
      setData((prev) => {
        const current = prev.products.find((p) => p.id === id);
        if (!current) return prev;
        const merged = { ...current, ...patch };
        const size = prev.sizes.find((s) => s.id === merged.sizeId);
        const next: Product = {
          recipeId: merged.recipeId,
          sizeId: merged.sizeId,
          id: size ? `${merged.recipeId}-${size.ml}` : merged.id,
        };
        return {
          ...prev,
          products: prev.products
            .filter((p) => p.id !== id)
            .concat(next),
        };
      });
    },
    [cloudEnabled, data.products, data.sizes],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (cloudEnabled) {
        await removeProduct(id);
        return;
      }
      setData((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== id),
      }));
    },
    [cloudEnabled],
  );

  const addMaterial = useCallback(
    async (m: Omit<Material, 'id'>) => {
      const material: Material = { ...m, id: uid('mat') };
      if (cloudEnabled) await upsertMaterial(material);
      else
        setData((prev) => ({
          ...prev,
          materials: [material, ...prev.materials],
        }));
      return material;
    },
    [cloudEnabled],
  );

  const updateMaterial = useCallback(
    async (id: string, patch: Partial<Material>) => {
      if (cloudEnabled) {
        const current = data.materials.find((m) => m.id === id);
        if (!current) return;
        await upsertMaterial({ ...current, ...patch });
        return;
      }
      setData((prev) => ({
        ...prev,
        materials: prev.materials.map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        ),
      }));
    },
    [cloudEnabled, data.materials],
  );

  const deleteMaterial = useCallback(
    async (id: string) => {
      if (cloudEnabled) {
        await removeMaterial(id);
        return;
      }
      setData((prev) => ({
        ...prev,
        materials: prev.materials.filter((m) => m.id !== id),
      }));
    },
    [cloudEnabled],
  );

  const addPromotion = useCallback(
    async (p: Omit<Promotion, 'id'>) => {
      const promo: Promotion = { ...p, id: uid('promo') };
      if (cloudEnabled) await upsertPromotion(promo);
      else
        setData((prev) => ({
          ...prev,
          promotions: [promo, ...prev.promotions],
        }));
      return promo;
    },
    [cloudEnabled],
  );

  const updatePromotion = useCallback(
    async (id: string, patch: Partial<Promotion>) => {
      if (cloudEnabled) {
        const current = data.promotions.find((p) => p.id === id);
        if (!current) return;
        await upsertPromotion({ ...current, ...patch });
        return;
      }
      setData((prev) => ({
        ...prev,
        promotions: prev.promotions.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      }));
    },
    [cloudEnabled, data.promotions],
  );

  const deletePromotion = useCallback(
    async (id: string) => {
      if (cloudEnabled) {
        await removePromotion(id);
        return;
      }
      setData((prev) => ({
        ...prev,
        promotions: prev.promotions.filter((p) => p.id !== id),
      }));
    },
    [cloudEnabled],
  );

  const createOrder = useCallback(
    async (input: {
      eventId: string;
      customerName: string;
      customerEmail?: string;
      lines: OrderLine[];
      promotionId?: string;
      paymentMethod: PaymentMethod;
      paid: boolean;
      extraDiscount?: number;
    }) => {
      const promo = data.promotions.find((p) => p.id === input.promotionId);
      const subtotal = calcSubtotal(input.lines);
      const promoDiscount = calcDiscount(input.lines, promo);
      const extra = Math.max(0, Number(input.extraDiscount) || 0);
      const discount = round2(Math.min(subtotal, promoDiscount + extra));
      const total = round2(Math.max(0, subtotal - discount));
      const now = new Date().toISOString();
      const base = {
        id: uid('ord'),
        eventId: input.eventId,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail?.trim() || undefined,
        lines: input.lines,
        subtotal,
        discount,
        total,
        promotionId: promo?.id,
        promotionName: promo?.name,
        paymentMethod: input.paymentMethod,
        paid: input.paid && input.paymentMethod !== 'pendiente',
        status: 'pendiente' as const,
        createdAt: now,
        updatedAt: now,
      };

      if (cloudEnabled) {
        return createOrderAtomic(base);
      }

      let created!: Order;
      setData((prev) => {
        const number = nextOrderNumber(prev, input.eventId);
        created = {
          ...base,
          number,
          customerName: base.customerName || `Cliente #${number}`,
        };
        return {
          ...prev,
          orders: [created, ...prev.orders],
          orderCounter: {
            ...prev.orderCounter,
            [input.eventId]: number,
          },
        };
      });
      return created;
    },
    [cloudEnabled, data.promotions],
  );

  const updateOrderStatus = useCallback(
    async (id: string, status: OrderStatus) => {
      const current = data.orders.find((o) => o.id === id);
      if (!current) return;
      const now = new Date().toISOString();
      const next: Order = {
        ...current,
        status,
        updatedAt: now,
        deliveredAt: status === 'entregado' ? now : current.deliveredAt,
      };
      if (cloudEnabled) await upsertOrder(next);
      else
        setData((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === id ? next : o)),
        }));
    },
    [cloudEnabled, data.orders],
  );

  const markPaid = useCallback(
    async (id: string, method: PaymentMethod) => {
      const current = data.orders.find((o) => o.id === id);
      if (!current) return;
      const next: Order = {
        ...current,
        paid: method !== 'pendiente',
        paymentMethod: method,
        updatedAt: new Date().toISOString(),
      };
      if (cloudEnabled) await upsertOrder(next);
      else
        setData((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === id ? next : o)),
        }));
    },
    [cloudEnabled, data.orders],
  );

  const deleteOrder = useCallback(
    async (id: string) => {
      if (cloudEnabled) {
        await removeOrderAndRenumber(id, data.orders);
        return;
      }
      setData((prev) => {
        const removed = prev.orders.find((order) => order.id === id);
        if (!removed) return prev;

        const remaining = prev.orders.filter((order) => order.id !== id);
        const eventOrders = remaining
          .filter((order) => order.eventId === removed.eventId)
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        const numberById = new Map(
          eventOrders.map((order, index) => [order.id, index + 1]),
        );
        const orders = remaining.map((order) => {
          const number = numberById.get(order.id);
          if (!number) return order;
          const defaultCustomer = `Cliente #${order.number}`;
          return {
            ...order,
            number,
            customerName:
              order.customerName === defaultCustomer
                ? `Cliente #${number}`
                : order.customerName,
          };
        });

        return {
          ...prev,
          orders,
          orderCounter: {
            ...prev.orderCounter,
            [removed.eventId]: eventOrders.length,
          },
        };
      });
    },
    [cloudEnabled, data.orders],
  );

  const value = useMemo(
    () => ({
      data,
      authenticated,
      syncReady,
      syncError,
      cloudEnabled,
      login,
      logout,
      addEvent,
      updateEvent,
      deleteEvent,
      addRecipe,
      updateRecipe,
      deleteRecipe,
      addSize,
      updateSize,
      deleteSize,
      addProduct,
      updateProduct,
      deleteProduct,
      addMaterial,
      updateMaterial,
      deleteMaterial,
      addPromotion,
      updatePromotion,
      deletePromotion,
      createOrder,
      updateOrderStatus,
      markPaid,
      deleteOrder,
    }),
    [
      data,
      authenticated,
      syncReady,
      syncError,
      cloudEnabled,
      login,
      logout,
      addEvent,
      updateEvent,
      deleteEvent,
      addRecipe,
      updateRecipe,
      deleteRecipe,
      addSize,
      updateSize,
      deleteSize,
      addProduct,
      updateProduct,
      deleteProduct,
      addMaterial,
      updateMaterial,
      deleteMaterial,
      addPromotion,
      updatePromotion,
      deletePromotion,
      createOrder,
      updateOrderStatus,
      markPaid,
      deleteOrder,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
