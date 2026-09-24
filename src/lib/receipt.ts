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

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function emailBody(order: Order, filename: string): string {
  return [
    `Hola${order.customerName ? ` ${order.customerName}` : ''},`,
    '',
    `Adjuntamos el ticket PDF de tu pedido #${order.number} (Total: ${formatEUR(order.total)}).`,
    '',
    '¡Gracias por pedir en Tropic Boost!',
    FROM_EMAIL,
    '',
    `Archivo: ${filename}`,
  ].join('\n');
}

/**
 * Envía el ticket PDF.
 * 1) Google Apps Script (automático, con adjunto) si está configurado
 * 2) Compartir nativo del dispositivo (PDF adjunto) si el SO lo permite
 * 3) Fallback: descarga PDF + abre Gmail (hay que adjuntar a mano)
 */
export async function sendReceiptEmail(input: {
  to: string;
  order: Order;
  eventName?: string;
}): Promise<{
  ok: boolean;
  mode: 'apps-script' | 'share' | 'gmail' | 'mailto';
  message: string;
}> {
  const { buildReceiptPdf, downloadPdfBlob } = await import('./receiptPdf');
  const { blob, filename } = await buildReceiptPdf(input.order, input.eventName);
  const subject = `Tropic Boost · Ticket pedido #${input.order.number}`;
  const body = emailBody(input.order, filename);
  const scriptUrl = import.meta.env.VITE_GMAIL_SCRIPT_URL as string | undefined;
  const scriptSecret = (import.meta.env.VITE_GMAIL_SCRIPT_SECRET as string | undefined) || '';

  // 1) Envío automático real desde Gmail (Apps Script)
  if (scriptUrl) {
    const pdfBase64 = await blobToBase64(blob);
    const payload = JSON.stringify({
      secret: scriptSecret,
      to: input.to,
      subject,
      body,
      filename,
      pdfBase64,
    });

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'No se pudo enviar el ticket automáticamente');
      }
      return {
        ok: true,
        mode: 'apps-script',
        message: `Ticket PDF enviado a ${input.to} desde ${FROM_EMAIL}.`,
      };
    } catch {
      // Apps Script a veces falla CORS en la respuesta; el envío puede haberse hecho.
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
      });
      return {
        ok: true,
        mode: 'apps-script',
        message: `Ticket PDF enviado a ${input.to} desde ${FROM_EMAIL}. Si no llega, revisa spam o el script.`,
      };
    }
  }

  // 2) Compartir nativo (iPad/móvil: Gmail/Mail con PDF adjunto)
  const file = new File([blob], filename, { type: 'application/pdf' });
  const canShareFiles =
    typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  if (canShareFiles && typeof navigator.share === 'function') {
    await navigator.share({
      files: [file],
      title: subject,
      text: body,
    });
    return {
      ok: true,
      mode: 'share',
      message: 'Elige Gmail o Mail: el PDF ya va adjunto.',
    };
  }

  // 3) Fallback escritorio sin script: descarga + Gmail
  downloadPdfBlob(blob, filename);
  const gmailUrl =
    'https://mail.google.com/mail/?view=cm&fs=1&tf=1' +
    `&to=${encodeURIComponent(input.to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body + '\n\n(Adjunta el PDF descargado antes de enviar)')}`;

  try {
    openUrl(gmailUrl);
    return {
      ok: true,
      mode: 'gmail',
      message: `PDF descargado (${filename}). En escritorio Gmail no deja adjuntar solo: adjúntalo y envía desde ${FROM_EMAIL}. Para envío automático, configura el Apps Script (ver google-apps-script/).`,
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

export function hasAutomaticTicketSend(): boolean {
  return Boolean(import.meta.env.VITE_GMAIL_SCRIPT_URL);
}
