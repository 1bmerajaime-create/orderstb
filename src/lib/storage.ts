import type { AppData, Event } from '../types';
import { seedData } from './seed';

const STORAGE_KEY = 'tropic-boost-ops-v3';
const AUTH_KEY = 'tropic-boost-auth';
const LEGACY_INGREDIENTS: Record<string, string[]> = {
  'Lotus Boost': ['Açaí', 'Plátano', 'Arándanos', 'Lotus', 'Mango'],
  'PB Crunch': ['Açaí', 'Plátano', 'Fresa', 'Muesli', 'Peanut butter'],
  'Berry Power': [
    'Açaí',
    'Fresa',
    'Arándanos',
    'Mango',
    'Muesli',
    'Peanut butter',
  ],
  'Passion Glow': ['Açaí', 'Kiwi', 'Coco', 'Maracuyá', 'Miel'],
};

function normalizeEvent(
  e: Event & { endDate?: string; materialsUsed?: Event['materialsUsed'] },
): Event {
  return {
    ...e,
    endDate: e.endDate && e.endDate >= e.date ? e.endDate : e.date,
    materialsUsed: Array.isArray(e.materialsUsed) ? e.materialsUsed : [],
  };
}

export function normalizeData(data: AppData): AppData {
  const events = (data.events || []).map((e) => normalizeEvent(e));
  const eventIds = new Set(events.map((e) => e.id));
  const validOrders = (data.orders || []).filter((o) => eventIds.has(o.eventId));
  const numberById = new Map<string, number>();
  for (const eventId of eventIds) {
    validOrders
      .filter((order) => order.eventId === eventId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .forEach((order, index) => numberById.set(order.id, index + 1));
  }
  const orders = validOrders.map((order) => {
    const number = numberById.get(order.id) || order.number;
    return {
      ...order,
      number,
      lines: order.lines.map((line) => ({
        ...line,
        ingredients:
          line.ingredients ||
          LEGACY_INGREDIENTS[line.productName] ||
          data.products.find((product) => product.id === line.productId)
            ?.ingredients ||
          [],
      })),
      customerName:
        order.customerName === `Cliente #${order.number}`
          ? `Cliente #${number}`
          : order.customerName,
    };
  });
  const orderCounter: Record<string, number> = {};
  for (const [id, n] of Object.entries(data.orderCounter || {})) {
    if (eventIds.has(id)) orderCounter[id] = n;
  }
  // Asegura que el contador no quede por debajo del nº máximo existente
  for (const o of orders) {
    orderCounter[o.eventId] = Math.max(orderCounter[o.eventId] || 0, o.number);
  }
  return {
    ...data,
    events,
    orders,
    orderCounter,
    products: data.products || [],
    materials: data.materials || [],
    promotions: data.promotions || [],
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // v3 actualiza el menú final sin perder eventos, pedidos ni promociones.
      const v2 = localStorage.getItem('tropic-boost-ops-v2');
      if (v2) {
        const previous = normalizeData(JSON.parse(v2) as AppData);
        const migrated = normalizeData({
          ...previous,
          products: structuredClone(seedData.products),
          materials: structuredClone(seedData.materials),
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      // migrate from v1 if present
      const legacy = localStorage.getItem('tropic-boost-ops-v1');
      if (legacy) {
        const migrated = normalizeData(JSON.parse(legacy) as AppData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const fresh = structuredClone(seedData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return normalizeData(JSON.parse(raw) as AppData);
  } catch {
    return structuredClone(seedData);
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
  } catch {
    // Algunos navegadores bloquean el almacenamiento bajo file://
  }
}

export function isAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(AUTH_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAuthenticated(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(AUTH_KEY, '1');
    else sessionStorage.removeItem(AUTH_KEY);
  } catch {
    // Algunos navegadores bloquean el almacenamiento bajo file://
  }
}

export function resetData(): AppData {
  const fresh = structuredClone(seedData);
  saveData(fresh);
  return fresh;
}
