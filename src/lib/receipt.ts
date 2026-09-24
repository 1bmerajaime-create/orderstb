import { IVA_RATE, formatEUR, ivaFromGross, netFromGross, round2 } from './utils';
import type { Order, OrderLine } from '../types';

export const FROM_EMAIL = 'info.tropicboost@gmail.com';

export interface ReceiptTotals {
  subtotal: number;
  lineDiscounts: number;
  orderDiscount: number;
  total: number;
  net: number;
  iva: number;
}

export function receiptTotals(order: Order): ReceiptTotals {
  const lineDiscounts = round2(
    order.lines.reduce((sum, line) => sum + (line.lineDiscount || 0) * line.quantity, 0),
  );
  const grossLines = round2(
    order.lines.reduce(
      (sum, line) =>
        sum + ((line.baseUnitPrice ?? line.unitPrice) + (line.lineDiscount || 0)) * line.quantity,
      0,
    ),
  );
  const subtotal = order.subtotal || grossLines;
  const orderDiscount = order.discount || 0;
  const total = order.total;
  return {
    subtotal,
    lineDiscounts,
    orderDiscount,
    total,
    net: netFromGross(total),
    iva: ivaFromGross(total),
  };
}

export function buildReceiptText(order: Order, eventName?: string): string {
  const totals = receiptTotals(order);
  const lines = order.lines
    .map((line, index) => formatLine(line, index + 1))
    .join('\n\n');

  return [
    'TROPIC BOOST · Ticket de pedido',
    eventName ? `Evento: ${eventName}` : '',
    `Pedido #${order.number}`,
    `Cliente: ${order.customerName}`,
    `Fecha: ${new Date(order.createdAt).toLocaleString('es-ES')}`,
    `Pago: ${order.paymentMethod}${order.paid ? ' (pagado)' : ''}`,
    order.promotionName ? `Promoción: ${order.promotionName}` : '',
    '',
    '— Productos —',
    lines,
    '',
    '— Totales (IVA incluido) —',
    `Subtotal: ${formatEUR(totals.subtotal)}`,
    totals.lineDiscounts > 0
      ? `Descuentos por producto: −${formatEUR(totals.lineDiscounts)}`
      : '',
    totals.orderDiscount > 0
      ? `Descuento pedido: −${formatEUR(totals.orderDiscount)}`
      : '',
    `Base imponible: ${formatEUR(totals.net)}`,
    `IVA (${Math.round(IVA_RATE * 100)}%): ${formatEUR(totals.iva)}`,
    `TOTAL: ${formatEUR(totals.total)}`,
    '',
    'Gracias por tu pedido · Tropic Boost',
    FROM_EMAIL,
  ]
    .filter((row) => row !== '')
    .join('\n');
}

function formatLine(line: OrderLine, index: number): string {
  const base = line.baseUnitPrice ?? line.unitPrice + (line.lineDiscount || 0);
  const ingredients = (line.ingredients || []).join(', ');
  const discount =
    line.lineDiscount && line.lineDiscount > 0
      ? ` (dto. −${formatEUR(line.lineDiscount)})`
      : '';
  return [
    `${index}. ${line.quantity}× ${line.productName}${discount}`,
    `   Precio: ${formatEUR(base)} → ${formatEUR(line.unitPrice)}`,
    ingredients ? `   Ingredientes: ${ingredients}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function copyTicket(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Abre Gmail con el ticket listo para enviar desde la cuenta de Tropic Boost. */
export async function sendReceiptEmail(input: {
  to: string;
  order: Order;
  eventName?: string;
}): Promise<{ ok: boolean; mode: 'gmail'; message: string }> {
  const subject = `Tropic Boost · Ticket pedido #${input.order.number}`;
  const body = buildReceiptText(input.order, input.eventName);
  const copied = await copyTicket(body);

  // Gmail limita la longitud de la URL; si el ticket es largo, el cuerpo va en el portapapeles.
  const maxBodyLen = 1600;
  const bodyForUrl =
    body.length <= maxBodyLen
      ? body
      : `${body.slice(0, maxBodyLen)}\n\n…\n(Ticket completo en el portapapeles: pégalo con Cmd+V)`;

  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    tf: '1',
    to: input.to,
    su: subject,
    body: bodyForUrl,
  });

  // Fuerza la cuenta de Tropic Boost si hay varias sesiones de Google abiertas
  const gmailUrl = `https://mail.google.com/mail/?${params.toString()}&authuser=${encodeURIComponent(FROM_EMAIL)}`;
  window.open(gmailUrl, '_blank', 'noopener,noreferrer');

  return {
    ok: true,
    mode: 'gmail',
    message: copied
      ? `Ticket listo en Gmail para ${input.to}. Usa la cuenta ${FROM_EMAIL} y pulsa Enviar. (También copiado al portapapeles.)`
      : `Ticket listo en Gmail para ${input.to}. Usa la cuenta ${FROM_EMAIL} y pulsa Enviar.`,
  };
}
