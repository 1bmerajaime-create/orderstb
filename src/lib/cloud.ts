import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AppData,
  BowlSize,
  Event,
  Material,
  Order,
  Product,
  ProductRecipe,
  Promotion,
} from '../types';
import { getDb } from './firebase';
import { seedData } from './seed';
import {
  CANONICAL_RECIPES,
  CANONICAL_SIZES,
  ensureCanonicalCatalog,
} from './productSizes';
import { loadData, normalizeData } from './storage';

const COLLECTIONS = {
  events: 'events',
  products: 'products',
  recipes: 'recipes',
  sizes: 'sizes',
  materials: 'materials',
  promotions: 'promotions',
  orders: 'orders',
  counters: 'counters',
} as const;

/** Firestore no acepta `undefined` en los documentos. */
export function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function collectionEmpty(name: string): Promise<boolean> {
  const snap = await getDocs(collection(getDb(), name));
  return snap.empty;
}

/** Escribe en Firestore recetas/tamaños/líneas canónicas si faltan. */
async function ensureCanonicalCatalogInCloud(): Promise<void> {
  const db = getDb();
  const [recipesSnap, sizesSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.recipes)),
    getDocs(collection(db, COLLECTIONS.sizes)),
    getDocs(collection(db, COLLECTIONS.products)),
  ]);

  const catalog = ensureCanonicalCatalog({
    recipes: recipesSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as ProductRecipe[],
    sizes: sizesSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as BowlSize[],
    products: productsSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as Product[],
  });

  // Forzar recetas/tamaños canónicos con datos completos (nombre, ingredientes, precio)
  const recipesById = new Map(catalog.recipes.map((r) => [r.id, r]));
  const sizesById = new Map(catalog.sizes.map((s) => [s.id, s]));
  for (const recipe of CANONICAL_RECIPES) {
    recipesById.set(recipe.id, {
      ...recipe,
      ingredients: [...recipe.ingredients],
    });
  }
  for (const size of CANONICAL_SIZES) {
    sizesById.set(size.id, { ...size });
  }

  const batch = writeBatch(db);
  for (const recipe of recipesById.values()) {
    batch.set(doc(db, COLLECTIONS.recipes, recipe.id), stripUndefined(recipe));
  }
  for (const size of sizesById.values()) {
    batch.set(doc(db, COLLECTIONS.sizes, size.id), stripUndefined(size));
  }
  for (const product of catalog.products) {
    batch.set(
      doc(db, COLLECTIONS.products, product.id),
      stripUndefined(product),
    );
  }
  await batch.commit();
}

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  const empty =
    (await collectionEmpty(COLLECTIONS.products)) &&
    (await collectionEmpty(COLLECTIONS.events)) &&
    (await collectionEmpty(COLLECTIONS.orders));

  if (!empty) {
    await ensureCanonicalCatalogInCloud();
    return;
  }

  // Si este dispositivo ya tenía datos locales, súbelos; si no, usa el seed.
  let seed = structuredClone(seedData);
  try {
    const local = loadData();
    if (
      local.events.length > 0 ||
      local.orders.length > 0 ||
      local.products.length > 0
    ) {
      seed = local;
    }
  } catch {
    // ignore
  }
  seed = normalizeData(seed);

  const batch = writeBatch(db);

  for (const event of seed.events) {
    batch.set(doc(db, COLLECTIONS.events, event.id), stripUndefined(event));
  }
  for (const recipe of seed.recipes) {
    batch.set(doc(db, COLLECTIONS.recipes, recipe.id), stripUndefined(recipe));
  }
  for (const size of seed.sizes) {
    batch.set(doc(db, COLLECTIONS.sizes, size.id), stripUndefined(size));
  }
  for (const product of seed.products) {
    batch.set(doc(db, COLLECTIONS.products, product.id), stripUndefined(product));
  }
  for (const material of seed.materials) {
    batch.set(
      doc(db, COLLECTIONS.materials, material.id),
      stripUndefined(material),
    );
  }
  for (const promotion of seed.promotions) {
    batch.set(
      doc(db, COLLECTIONS.promotions, promotion.id),
      stripUndefined(promotion),
    );
  }
  for (const [eventId, value] of Object.entries(seed.orderCounter)) {
    batch.set(doc(db, COLLECTIONS.counters, eventId), { value });
  }
  for (const order of seed.orders) {
    batch.set(doc(db, COLLECTIONS.orders, order.id), stripUndefined(order));
  }

  await batch.commit();
}

function docsToList<T extends { id: string }>(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>,
): T[] {
  return docs.map((item) => ({ id: item.id, ...item.data() }) as T);
}

export function subscribeAppData(
  onData: (data: AppData) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const db = getDb();
  let events: Event[] = [];
  let products: Product[] = [];
  let recipes: ProductRecipe[] = [];
  let sizes: BowlSize[] = [];
  let materials: Material[] = [];
  let promotions: Promotion[] = [];
  let orders: Order[] = [];
  let orderCounter: Record<string, number> = {};

  const emit = () => {
    onData(
      normalizeData({
        events,
        products,
        recipes,
        sizes,
        materials,
        promotions,
        orders,
        orderCounter,
      }),
    );
  };

  const unsubs = [
    onSnapshot(
      collection(db, COLLECTIONS.events),
      (snap) => {
        events = docsToList<Event>(snap.docs);
        emit();
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.products),
      (snap) => {
        products = docsToList<Product>(snap.docs);
        emit();
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.recipes),
      (snap) => {
        recipes = docsToList<ProductRecipe>(snap.docs);
        emit();
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.sizes),
      (snap) => {
        sizes = docsToList<BowlSize>(snap.docs);
        emit();
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.materials),
      (snap) => {
        materials = docsToList<Material>(snap.docs);
        emit();
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.promotions),
      (snap) => {
        promotions = docsToList<Promotion>(snap.docs);
        emit();
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.orders),
      (snap) => {
        orders = docsToList<Order>(snap.docs);
        emit();
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.counters),
      (snap) => {
        orderCounter = {};
        snap.docs.forEach((item) => {
          orderCounter[item.id] = Number(item.data().value) || 0;
        });
        emit();
      },
      (err) => onError?.(err),
    ),
  ];

  return () => unsubs.forEach((unsub) => unsub());
}

export async function upsertEvent(event: Event): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTIONS.events, event.id),
    stripUndefined(event),
  );
}

export async function removeEvent(id: string): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.events, id));
  batch.delete(doc(db, COLLECTIONS.counters, id));
  const ordersSnap = await getDocs(collection(db, COLLECTIONS.orders));
  ordersSnap.docs.forEach((item) => {
    if (item.data().eventId === id) batch.delete(item.ref);
  });
  await batch.commit();
}

export async function upsertProduct(product: Product): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTIONS.products, product.id),
    stripUndefined(product),
  );
}

export async function removeProduct(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.products, id));
}

export async function upsertRecipe(recipe: ProductRecipe): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTIONS.recipes, recipe.id),
    stripUndefined(recipe),
  );
}

export async function removeRecipe(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.recipes, id));
}

export async function upsertSize(size: BowlSize): Promise<void> {
  await setDoc(doc(getDb(), COLLECTIONS.sizes, size.id), stripUndefined(size));
}

export async function removeSize(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.sizes, id));
}

export async function upsertMaterial(material: Material): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTIONS.materials, material.id),
    stripUndefined(material),
  );
}

export async function removeMaterial(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.materials, id));
}

export async function upsertPromotion(promotion: Promotion): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTIONS.promotions, promotion.id),
    stripUndefined(promotion),
  );
}

export async function removePromotion(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.promotions, id));
}

export async function upsertOrder(order: Order): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTIONS.orders, order.id),
    stripUndefined(order),
  );
}

export async function createOrderAtomic(
  order: Omit<Order, 'number' | 'id'> & { id: string },
): Promise<Order> {
  const db = getDb();
  const counterRef = doc(db, COLLECTIONS.counters, order.eventId);
  const orderRef = doc(db, COLLECTIONS.orders, order.id);

  const created = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const number = (Number(counterSnap.data()?.value) || 0) + 1;
    const full: Order = {
      ...order,
      number,
      customerName:
        order.customerName.trim() || `Cliente #${number}`,
    };
    tx.set(counterRef, { value: number }, { merge: true });
    tx.set(orderRef, stripUndefined(full));
    return full;
  });

  return created;
}

export async function removeOrderAndRenumber(
  id: string,
  currentOrders: Order[],
): Promise<void> {
  const db = getDb();
  const removed = currentOrders.find((order) => order.id === id);
  if (!removed) return;

  const remaining = currentOrders.filter((order) => order.id !== id);
  const eventOrders = remaining
    .filter((order) => order.eventId === removed.eventId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.orders, id));

  eventOrders.forEach((order, index) => {
    const number = index + 1;
    const defaultCustomer = `Cliente #${order.number}`;
    batch.set(
      doc(db, COLLECTIONS.orders, order.id),
      stripUndefined({
        ...order,
        number,
        customerName:
          order.customerName === defaultCustomer
            ? `Cliente #${number}`
            : order.customerName,
      }),
    );
  });

  batch.set(doc(db, COLLECTIONS.counters, removed.eventId), {
    value: eventOrders.length,
  });

  await batch.commit();
}
