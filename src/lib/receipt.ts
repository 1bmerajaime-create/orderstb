import { parseRecipe, WHEY } from './bowl';
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

export function lineTotal(line: OrderLine): number {
  return round2(line.unitPrice * line.quantity);
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
    '— Bowls —',
    lines,
    '',
    '— Totales pedido (IVA incluido) —',
    `Subtotal: ${formatEUR(totals.subtotal)}`,
    totals.lineDiscounts > 0
      ? `Descuentos por bowl: −${formatEUR(totals.lineDiscounts)}`
      : '',
    totals.orderDiscount > 0
      ? `Descuento pedido: −${formatEUR(totals.orderDiscount)}`
      : '',
    `Base imponible: ${formatEUR(totals.net)}`,
    `IVA (${Math.round(IVA_RATE * 100)}%): ${formatEUR(totals.iva)}`,
    `TOTAL PEDIDO: ${formatEUR(totals.total)}`,
    '',
    'Gracias por tu pedido · Tropic Boost',
    FROM_EMAIL,
  ]
    .filter((row) => row !== '')
    .join('\n');
}

function formatLine(line: OrderLine, index: number): string {
  const grossUnit = line.baseUnitPrice ?? line.unitPrice + (line.lineDiscount || 0);
  const total = lineTotal(line);
  const ingredients = line.ingredients || [];
  const config = parseRecipe(ingredients);
  const base =
    ingredients.find((item) => /a[cç]a[ií]/i.test(item)) || 'Açaí';

  const detailRows = [
    `   Base: ${base}`,
    config.fruits.length ? `   Fruta: ${config.fruits.join(', ')}` : '',
    config.solids.length ? `   Duro: ${config.solids.join(', ')}` : '',
    config.softs.length ? `   Blando: ${config.softs.join(', ')}` : '',
    config.whey ? `   Extra: ${WHEY}` : '',
  ].filter(Boolean);

  const priceRows = [
    `   Precio bowl: ${formatEUR(grossUnit)}`,
    line.lineDiscount && line.lineDiscount > 0
      ? `   Dto.${line.promotionName ? ` ${line.promotionName}` : ''}: −${formatEUR(line.lineDiscount)}`
      : '',
    `   TOTAL BOWL: ${formatEUR(total)}`,
  ].filter(Boolean);

  return [
    `${index}. ${line.quantity}× ${line.productName}`,
    ...detailRows,
    ...priceRows,
  ].join('\n');
}

function openUrl(url: string) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) return true;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

/** Genera el PDF del ticket, lo descarga y abre Gmail para adjuntarlo. */
export async function sendReceiptEmail(input: {
  to: string;
  order: Order;
  eventName?: string;
}): Promise<{ ok: boolean; mode: 'gmail' | 'mailto'; message: string }> {
  const { buildReceiptPdf, downloadPdfBlob } = await import('./receiptPdf');
  const { blob, filename } = await buildReceiptPdf(input.order, input.eventName);
  downloadPdfBlob(blob, filename);

  const subject = `Tropic Boost · Ticket pedido #${input.order.number}`;
  const body = [
    `Hola${input.order.customerName ? ` ${input.order.customerName}` : ''},`,
    '',
    `Adjunto el ticket PDF de tu pedido #${input.order.number} (Total: ${formatEUR(input.order.total)}).`,
    '',
    '¡Gracias por pedir en Tropic Boost!',
    FROM_EMAIL,
    '',
    '—',
    `Archivo: ${filename}`,
    '(Adjunta el PDF descargado antes de enviar)',
  ].join('\n');

  const gmailUrl =
    'https://mail.google.com/mail/?view=cm&fs=1&tf=1' +
    `&to=${encodeURIComponent(input.to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  try {
    openUrl(gmailUrl);
    return {
      ok: true,
      mode: 'gmail',
      message: `PDF descargado (${filename}). Adjúntalo en Gmail y pulsa Enviar desde ${FROM_EMAIL}.`,
    };
  } catch {
    const mailto = `mailto:${encodeURIComponent(input.to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    openUrl(mailto);
    return {
      ok: true,
      mode: 'mailto',
      message: `PDF descargado (${filename}). Adjúntalo al correo y envíalo desde ${FROM_EMAIL}.`,
    };
  }
}

export async function downloadReceiptPdf(input: {
  order: Order;
  eventName?: string;
}): Promise<{ filename: string }> {
  const { buildReceiptPdf, downloadPdfBlob } = await import('./receiptPdf');
  const { blob, filename } = await buildReceiptPdf(input.order, input.eventName);
  downloadPdfBlob(blob, filename);
  return { filename };
}
