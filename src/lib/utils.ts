import type {
  AppData,
  DiscountType,
  Event,
  Material,
  Order,
  OrderLine,
  PaymentMethod,
  Product,
  Promotion,
} from '../types';

export function uid(prefix = 'id'): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function formatEUR(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export const IVA_RATE = 0.21;

/** Importe de IVA contenido en un total con IVA incluido */
export function ivaFromGross(gross: number): number {
  return round2(gross - gross / (1 + IVA_RATE));
}

/** Base imponible (sin IVA) a partir de un total con IVA */
export function netFromGross(gross: number): number {
  return round2(gross / (1 + IVA_RATE));
}

export function signedClass(value: number): string {
  if (value > 0) return 'num-positive';
  if (value < 0) return 'num-negative';
  return '';
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateRange(start: string, end?: string): string {
  const endDate = end && end > start ? end : start;
  if (endDate === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(endDate)}`;
}

export function toLocalISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function eventEndDate(event: Event): string {
  return event.endDate && event.endDate >= event.date
    ? event.endDate
    : event.date;
}

/** Inclusive list of YYYY-MM-DD days for an event */
export function eventDays(event: Event): string[] {
  const start = event.date;
  const end = eventEndDate(event);
  const days: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cursor <= last) {
    days.push(toLocalISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function eventsOnDate(events: Event[], iso: string): Event[] {
  return events.filter((e) => {
    const end = eventEndDate(e);
    return iso >= e.date && iso <= end;
  });
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function calcSubtotal(lines: OrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

export function calcDiscount(
  lines: OrderLine[],
  promo?: Promotion | null,
): number {
  if (!promo) return 0;
  const subtotal = calcSubtotal(lines);
  switch (promo.type as DiscountType) {
    case 'percent':
      return round2((subtotal * promo.value) / 100);
    case 'fixed':
      return Math.min(round2(promo.value), subtotal);
    case 'second_half': {
      const units: number[] = [];
      lines.forEach((l) => {
        for (let i = 0; i < l.quantity; i++) units.push(l.unitPrice);
      });
      if (units.length < 2) return 0;
      units.sort((a, b) => a - b);
      return round2(units[0] * 0.5);
    }
    case 'bogo': {
      const units: number[] = [];
      lines.forEach((l) => {
        for (let i = 0; i < l.quantity; i++) units.push(l.unitPrice);
      });
      if (units.length < 2) return 0;
      units.sort((a, b) => a - b);
      return round2(units[0]);
    }
    default:
      return 0;
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rough cost estimate: ~28% of sale price as materia prima (unused in KPIs) */
export function estimateMaterialCost(orders: Order[]): number {
  const paid = orders.filter((o) => o.status === 'entregado' || o.paid);
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  return round2(revenue * 0.28);
}

export function eventMaterialsCost(event: Event): number {
  return round2(
    (event.materialsUsed || []).reduce(
      (sum, m) => sum + (Number(m.quantity) || 0) * (Number(m.unitPrice) || 0),
      0,
    ),
  );
}

export type ChartGranularity = 'hora' | 'dia' | 'semana';

function weekKey(d: Date): string {
  const tmp = new Date(d);
  tmp.setHours(12, 0, 0, 0);
  const day = (tmp.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - day);
  return toLocalISO(tmp);
}

function labelForBucket(key: string, granularity: ChartGranularity): string {
  if (granularity === 'hora') return key;
  if (granularity === 'dia') {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${key}T12:00:00`));
  }
  const start = new Date(`${key}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function buildSalesSeries(
  orders: Order[],
  granularity: ChartGranularity,
  productId?: string,
): Array<{ label: string; total: number; count: number }> {
  const buckets: Record<string, { total: number; count: number }> = {};

  orders.forEach((o) => {
    const productTotal = productId
      ? o.lines
          .filter((line) => line.productId === productId)
          .reduce(
            (sum, line) => sum + line.unitPrice * line.quantity,
            0,
          )
      : o.total;
    if (productId && productTotal === 0) return;
    const d = new Date(o.createdAt);
    let key: string;
    if (granularity === 'hora') {
      key = `${String(d.getHours()).padStart(2, '0')}:00`;
    } else if (granularity === 'dia') {
      key = toLocalISO(d);
    } else {
      key = weekKey(d);
    }
    if (!buckets[key]) buckets[key] = { total: 0, count: 0 };
    buckets[key].total += productTotal;
    buckets[key].count += 1;
  });

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      label: labelForBucket(key, granularity),
      total: round2(v.total),
      count: v.count,
    }));
}

export function eventKPIs(data: AppData, eventId: string) {
  const event = data.events.find((e) => e.id === eventId);
  const orders = data.orders.filter((o) => o.eventId === eventId);
  const completed = orders.filter((o) => o.status === 'entregado' || o.paid);
  const revenue = round2(completed.reduce((s, o) => s + o.total, 0));
  const materialCost = event ? eventMaterialsCost(event) : 0;
  const eventCost = event?.cost || 0;
  const iva = ivaFromGross(revenue);
  const base = netFromGross(revenue);
  /** Beneficio neto = base sin IVA − materia prima − coste operativo */
  const reserva = round2(base - materialCost - eventCost);
  const margin = round2(base - materialCost);
  const avgTicket =
    completed.length > 0 ? round2(revenue / completed.length) : 0;

  const inProgressOrders = orders.filter(
    (o) => o.status === 'pendiente' || o.status === 'en_preparacion',
  );
  const readyOrders = orders.filter((o) => o.status === 'listo');
  /** Pedidos visibles en la pantalla Pedidos (En curso + Listos) */
  const boardOrders = [...inProgressOrders, ...readyOrders];

  const productSales: Record<string, { name: string; qty: number; revenue: number }> =
    {};
  completed.forEach((o) => {
    o.lines.forEach((l) => {
      if (!productSales[l.productId]) {
        productSales[l.productId] = {
          name: l.productName,
          qty: 0,
          revenue: 0,
        };
      }
      productSales[l.productId].qty += l.quantity;
      productSales[l.productId].revenue += l.unitPrice * l.quantity;
    });
  });

  return {
    totalOrders: orders.length,
    revenue,
    iva,
    base,
    materialCost,
    materialCostIsEstimate: false,
    eventCost,
    margin,
    reserva,
    avgTicket,
    productSales: Object.values(productSales).sort((a, b) => b.qty - a.qty),
    completedOrders: completed,
    allOrders: orders,
    inProgressOrders,
    readyOrders,
    boardOrders,
    /** @deprecated alias de boardOrders para compatibilidad */
    activeOrders: boardOrders,
  };
}

export function globalKPIs(data: AppData) {
  const today = toLocalISO(new Date());
  const totalEvents = data.events.length;
  const eventIds = new Set(data.events.map((e) => e.id));
  const linkedOrders = data.orders.filter((o) => eventIds.has(o.eventId));

  const revenueOrders = linkedOrders.filter(
    (o) => o.status === 'entregado' || o.paid,
  );
  const totalOrders = linkedOrders.length;
  const revenue = round2(revenueOrders.reduce((s, o) => s + o.total, 0));

  const eventCosts = round2(
    data.events.reduce((s, e) => s + (e.cost || 0), 0),
  );

  const materials = round2(
    data.events.reduce((s, e) => s + eventMaterialsCost(e), 0),
  );

  const iva = ivaFromGross(revenue);
  const base = netFromGross(revenue);
  /** Total ganado: base sin IVA − gasto eventos − materia prima */
  const totalGanado = round2(base - eventCosts - materials);

  const nextEvent =
    [...data.events]
      .filter((e) => eventEndDate(e) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ||
    [...data.events].sort((a, b) => b.date.localeCompare(a.date))[0] ||
    null;

  const ordersByEvent = [...data.events]
    .map((e) => ({
      id: e.id,
      name: e.name || 'Sin nombre',
      date: e.date,
      endDate: e.endDate,
      count: linkedOrders.filter((o) => o.eventId === e.id).length,
    }))
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));

  return {
    totalEvents,
    totalOrders,
    revenue,
    iva,
    eventCosts,
    materials,
    totalGanado,
    nextEvent,
    ordersByEvent,
  };
}

export function nextOrderNumber(data: AppData, eventId: string): number {
  const currentMax = data.orders
    .filter((order) => order.eventId === eventId)
    .reduce((max, order) => Math.max(max, order.number), 0);
  return currentMax + 1;
}

export type {
  Event,
  Product,
  Material,
  Promotion,
  Order,
  OrderLine,
  PaymentMethod,
};
