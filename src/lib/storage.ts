import type { AppData, Event } from '../types';
import { seedData } from './seed';

const STORAGE_KEY = 'tropic-boost-ops-v2';
const AUTH_KEY = 'tropic-boost-auth';

function normalizeEvent(
  e: Event & { endDate?: string; materialsUsed?: Event['materialsUsed'] },
): Event {
  return {
    ...e,
    endDate: e.endDate && e.endDate >= e.date ? e.endDate : e.date,
    materialsUsed: Array.isArray(e.materialsUsed) ? e.materialsUsed : [],
  };
}

function normalizeData(data: AppData): AppData {
  const events = (data.events || []).map((e) => normalizeEvent(e));
  const eventIds = new Set(events.map((e) => e.id));
  const orders = (data.orders || []).filter((o) => eventIds.has(o.eventId));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
}

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

export function setAuthenticated(value: boolean): void {
  if (value) sessionStorage.setItem(AUTH_KEY, '1');
  else sessionStorage.removeItem(AUTH_KEY);
}

export function resetData(): AppData {
  const fresh = structuredClone(seedData);
  saveData(fresh);
  return fresh;
}
