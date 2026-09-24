import { IVA_RATE, formatEUR, ivaFromGross, netFromGross, round2 } from './utils';
import type { Order, OrderLine } from '../types';

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
  // Prefer stored subtotal/discount/total when present
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
    'TROPIC BOOST · Recibo de pedido',
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
    'info.tropicboost@gmail.com',
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

export async function sendReceiptEmail(input: {
  to: string;
  order: Order;
  eventName?: string;
}): Promise<{ ok: boolean; mode: 'emailjs' | 'mailto'; message: string }> {
  const subject = `Tropic Boost · Recibo pedido #${input.order.number}`;
  const body = buildReceiptText(input.order, input.eventName);
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

  if (serviceId && templateId && publicKey) {
    const { default: emailjs } = await import('@emailjs/browser');
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: input.to,
        from_name: 'Tropic Boost',
        reply_to: 'info.tropicboost@gmail.com',
        subject,
        message: body,
        order_number: String(input.order.number),
        customer_name: input.order.customerName,
        total: formatEUR(input.order.total),
      },
      { publicKey },
    );
    return {
      ok: true,
      mode: 'emailjs',
      message: `Recibo enviado a ${input.to}`,
    };
  }

  const mailto = `mailto:${encodeURIComponent(input.to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&bcc=${encodeURIComponent('info.tropicboost@gmail.com')}`;
  window.open(mailto, '_blank');
  return {
    ok: true,
    mode: 'mailto',
    message:
      'Se abrió el correo con el recibo. Envíalo desde info.tropicboost@gmail.com (o configura EmailJS para envío automático).',
  };
}
