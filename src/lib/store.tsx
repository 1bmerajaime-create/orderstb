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
  Event,
  Material,
  Order,
  OrderLine,
  OrderStatus,
  PaymentMethod,
  Product,
  Promotion,
} from '../types';
import { isAuthenticated, loadData, saveData, setAuthenticated } from './storage';
import { PASSWORD } from './seed';
import {
  calcDiscount,
  calcSubtotal,
  nextOrderNumber,
  round2,
  uid,
} from './utils';

interface StoreContextValue {
  data: AppData;
  authenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  // Events
  addEvent: (e: Omit<Event, 'id' | 'createdAt'>) => Event;
  updateEvent: (id: string, patch: Partial<Event>) => void;
  deleteEvent: (id: string) => void;
  // Products
  addProduct: (p: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  // Materials
  addMaterial: (m: Omit<Material, 'id'>) => Material;
  updateMaterial: (id: string, patch: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  // Promotions
  addPromotion: (p: Omit<Promotion, 'id'>) => Promotion;
  updatePromotion: (id: string, patch: Partial<Promotion>) => void;
  deletePromotion: (id: string) => void;
  // Orders
  createOrder: (input: {
    eventId: string;
    customerName: string;
    lines: OrderLine[];
    promotionId?: string;
    paymentMethod: PaymentMethod;
    paid: boolean;
  }) => Order;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  markPaid: (id: string, method: PaymentMethod) => void;
  deleteOrder: (id: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const [authenticated, setAuth] = useState(() => isAuthenticated());

  useEffect(() => {
    saveData(data);
  }, [data]);

  const login = useCallback((password: string) => {
    if (password === PASSWORD) {
      setAuthenticated(true);
      setAuth(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setAuthenticated(false);
    setAuth(false);
  }, []);

  const addEvent = useCallback((e: Omit<Event, 'id' | 'createdAt'>) => {
    const event: Event = {
      ...e,
      materialsUsed: e.materialsUsed || [],
      id: uid('evt'),
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, events: [event, ...prev.events] }));
    return event;
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<Event>) => {
    setData((prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setData((prev) => {
      const { [id]: _removed, ...orderCounter } = prev.orderCounter;
      return {
        ...prev,
        events: prev.events.filter((e) => e.id !== id),
        orders: prev.orders.filter((o) => o.eventId !== id),
        orderCounter,
      };
    });
  }, []);

  const addProduct = useCallback((p: Omit<Product, 'id'>) => {
    const product: Product = { ...p, id: uid('prod') };
    setData((prev) => ({ ...prev, products: [product, ...prev.products] }));
    return product;
  }, []);

  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    setData((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
  }, []);

  const addMaterial = useCallback((m: Omit<Material, 'id'>) => {
    const material: Material = { ...m, id: uid('mat') };
    setData((prev) => ({
      ...prev,
      materials: [material, ...prev.materials],
    }));
    return material;
  }, []);

  const updateMaterial = useCallback((id: string, patch: Partial<Material>) => {
    setData((prev) => ({
      ...prev,
      materials: prev.materials.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    }));
  }, []);

  const deleteMaterial = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      materials: prev.materials.filter((m) => m.id !== id),
    }));
  }, []);

  const addPromotion = useCallback((p: Omit<Promotion, 'id'>) => {
    const promo: Promotion = { ...p, id: uid('promo') };
    setData((prev) => ({
      ...prev,
      promotions: [promo, ...prev.promotions],
    }));
    return promo;
  }, []);

  const updatePromotion = useCallback(
    (id: string, patch: Partial<Promotion>) => {
      setData((prev) => ({
        ...prev,
        promotions: prev.promotions.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      }));
    },
    [],
  );

  const deletePromotion = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      promotions: prev.promotions.filter((p) => p.id !== id),
    }));
  }, []);

  const createOrder = useCallback(
    (input: {
      eventId: string;
      customerName: string;
      lines: OrderLine[];
      promotionId?: string;
      paymentMethod: PaymentMethod;
      paid: boolean;
    }) => {
      let created!: Order;
      setData((prev) => {
        const number = nextOrderNumber(prev, input.eventId);
        const promo = prev.promotions.find((p) => p.id === input.promotionId);
        const subtotal = calcSubtotal(input.lines);
        const discount = calcDiscount(input.lines, promo);
        const total = round2(Math.max(0, subtotal - discount));
        const now = new Date().toISOString();
        created = {
          id: uid('ord'),
          number,
          eventId: input.eventId,
          customerName: input.customerName.trim() || `Cliente #${number}`,
          lines: input.lines,
          subtotal,
          discount,
          total,
          promotionId: promo?.id,
          promotionName: promo?.name,
          paymentMethod: input.paymentMethod,
          paid: input.paid && input.paymentMethod !== 'pendiente',
          status: 'pendiente',
          createdAt: now,
          updatedAt: now,
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
    [],
  );

  const updateOrderStatus = useCallback((id: string, status: OrderStatus) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => {
        if (o.id !== id) return o;
        const now = new Date().toISOString();
        return {
          ...o,
          status,
          updatedAt: now,
          deliveredAt: status === 'entregado' ? now : o.deliveredAt,
        };
      }),
    }));
  }, []);

  const markPaid = useCallback((id: string, method: PaymentMethod) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === id
          ? {
              ...o,
              paid: method !== 'pendiente',
              paymentMethod: method,
              updatedAt: new Date().toISOString(),
            }
          : o,
      ),
    }));
  }, []);

  const deleteOrder = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.filter((o) => o.id !== id),
    }));
  }, []);

  const value = useMemo(
    () => ({
      data,
      authenticated,
      login,
      logout,
      addEvent,
      updateEvent,
      deleteEvent,
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
      login,
      logout,
      addEvent,
      updateEvent,
      deleteEvent,
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
