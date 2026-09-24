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

function openUrl(url: string) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) return true;
  // Fallback si el popup se bloquea
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

/** Abre Gmail (o mailto) con el ticket listo. Debe llamarse en un clic directo del usuario. */
export async function sendReceiptEmail(input: {
  to: string;
  order: Order;
  eventName?: string;
}): Promise<{ ok: boolean; mode: 'gmail' | 'mailto'; message: string }> {
  const subject = `Tropic Boost · Ticket pedido #${input.order.number}`;
  const body = buildReceiptText(input.order, input.eventName);
  const copied = await copyTicket(body);

  const maxBodyLen = 1500;
  const bodyForUrl =
    body.length <= maxBodyLen
      ? body
      : `${body.slice(0, maxBodyLen)}\n\n…\n(Ticket completo en el portapapeles: pégalo con Cmd+V)`;

  const gmailUrl =
    'https://mail.google.com/mail/?view=cm&fs=1&tf=1' +
    `&to=${encodeURIComponent(input.to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(bodyForUrl)}`;

  try {
    openUrl(gmailUrl);
    return {
      ok: true,
      mode: 'gmail',
      message: copied
        ? `Gmail abierto para ${input.to}. Revisa la cuenta ${FROM_EMAIL} y pulsa Enviar. Ticket también en el portapapeles.`
        : `Gmail abierto para ${input.to}. Revisa la cuenta ${FROM_EMAIL} y pulsa Enviar.`,
    };
  } catch {
    const mailto = `mailto:${encodeURIComponent(input.to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    openUrl(mailto);
    return {
      ok: true,
      mode: 'mailto',
      message: `Se abrió el cliente de correo. Envíalo desde ${FROM_EMAIL}.`,
    };
  }
}
