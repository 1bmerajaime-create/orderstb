import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
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
  CANONICAL_SIMPLE_RECIPES,
  CANONICAL_SIZES,
  UNIT_SIZE,
  ensureCanonicalCatalog,
  isSupportedBowlSize,
} from './productSizes';
import { loadData, normalizeData } from './storage';

const SYNC_COLLECTIONS = [
  'events',
  'products',
  'recipes',
  'sizes',
  'materials',
  'promotions',
  'orders',
  'counters',
] as const;

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

/**
 * Solo añade piezas canónicas que no existan. No reescribe catálogo
 * ya personalizado (evita resetear ingredientes en cada login).
 */
async function ensureMissingCanonicalOnly(): Promise<void> {
  const db = getDb();
  const [recipesSnap, sizesSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.recipes)),
    getDocs(collection(db, COLLECTIONS.sizes)),
    getDocs(collection(db, COLLECTIONS.products)),
  ]);

  const existingRecipeIds = new Set(recipesSnap.docs.map((d) => d.id));
  const existingSizeIds = new Set(sizesSnap.docs.map((d) => d.id));
  const existingProductIds = new Set(productsSnap.docs.map((d) => d.id));

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

  const batch = writeBatch(db);
  let writes = 0;

  for (const recipe of [...CANONICAL_RECIPES, ...CANONICAL_SIMPLE_RECIPES]) {
    if (existingRecipeIds.has(recipe.id)) continue;
    batch.set(doc(db, COLLECTIONS.recipes, recipe.id), stripUndefined(recipe));
    writes += 1;
  }
  for (const size of [...CANONICAL_SIZES, UNIT_SIZE]) {
    if (existingSizeIds.has(size.id)) continue;
    batch.set(doc(db, COLLECTIONS.sizes, size.id), stripUndefined(size));
    writes += 1;
  }
  for (const sizeDoc of sizesSnap.docs) {
    const size = { id: sizeDoc.id, ...sizeDoc.data() } as BowlSize;
    if (isSupportedBowlSize(size)) continue;
    batch.delete(doc(db, COLLECTIONS.sizes, size.id));
    writes += 1;
  }
  const keptSizeIds = new Set(
    [
      ...sizesSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
      ...CANONICAL_SIZES,
      UNIT_SIZE,
    ]
      .filter((size) => isSupportedBowlSize(size as BowlSize))
      .map((size) => size.id),
  );
  for (const product of catalog.products) {
    if (existingProductIds.has(product.id)) continue;
    batch.set(
      doc(db, COLLECTIONS.products, product.id),
      stripUndefined(product),
    );
    writes += 1;
  }
  for (const productDoc of productsSnap.docs) {
    const product = { id: productDoc.id, ...productDoc.data() } as Product;
    if (keptSizeIds.has(product.sizeId)) continue;
    batch.delete(doc(db, COLLECTIONS.products, product.id));
    writes += 1;
  }

  if (writes > 0) await batch.commit();
}

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  const empty =
    (await collectionEmpty(COLLECTIONS.products)) &&
    (await collectionEmpty(COLLECTIONS.events)) &&
    (await collectionEmpty(COLLECTIONS.orders));

  if (!empty) {
    await ensureMissingCanonicalOnly();
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
  onReady?: () => void,
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

  const readyKeys = new Set<string>();
  let readyEmitted = false;

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

  const markReady = (key: (typeof SYNC_COLLECTIONS)[number]) => {
    readyKeys.add(key);
    if (!readyEmitted && readyKeys.size >= SYNC_COLLECTIONS.length) {
      readyEmitted = true;
      onReady?.();
    }
  };

  const unsubs = [
    onSnapshot(
      collection(db, COLLECTIONS.events),
      (snap) => {
        events = docsToList<Event>(snap.docs);
        emit();
        markReady('events');
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.products),
      (snap) => {
        products = docsToList<Product>(snap.docs);
        emit();
        markReady('products');
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.recipes),
      (snap) => {
        recipes = docsToList<ProductRecipe>(snap.docs);
        emit();
        markReady('recipes');
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.sizes),
      (snap) => {
        sizes = docsToList<BowlSize>(snap.docs);
        emit();
        markReady('sizes');
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.materials),
      (snap) => {
        materials = docsToList<Material>(snap.docs);
        emit();
        markReady('materials');
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.promotions),
      (snap) => {
        promotions = docsToList<Promotion>(snap.docs);
        emit();
        markReady('promotions');
      },
      (err) => onError?.(err),
    ),
    onSnapshot(
      collection(db, COLLECTIONS.orders),
      (snap) => {
        orders = docsToList<Order>(snap.docs);
        emit();
        markReady('orders');
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
        markReady('counters');
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

/** Actualiza solo los campos indicados (evita pisar ediciones concurrentes). */
export async function patchOrder(
  id: string,
  patch: Partial<Order>,
): Promise<void> {
  await updateDoc(
    doc(getDb(), COLLECTIONS.orders, id),
    stripUndefined(patch) as Record<string, unknown>,
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

/**
 * Borra el pedido sin renumerar. En servicio en vivo renumerar provoca
 * números duplicados / contador incorrecto si hay altas concurrentes.
 */
export async function removeOrder(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.orders, id));
}
