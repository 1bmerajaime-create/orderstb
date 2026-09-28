import { jsPDF } from 'jspdf';
import logoHorizontalUrl from '../assets/logo-horizontal.png';
import { parseRecipe, WHEY } from './bowl';
import { lineGrossUnit, lineTotal, receiptTotals, FROM_EMAIL } from './receipt';
import { IVA_RATE } from './utils';
import type { Order, OrderLine } from '../types';

const FISCAL = {
  name: 'Carlos Garcia Pereda',
  nif: '54213623R',
  address: 'Calle Napoles 8, Pozuelo de Alarcon, 28224, Madrid',
};

/** Brand purple #8b4fc4 — logo white → purple for print on white paper. */
const LOGO_PURPLE = { r: 139, g: 79, b: 196 };

/**
 * jsPDF Helvetica is WinAnsi: no NBSP, no typographic minus, € often garbles.
 * Keep amounts ASCII-safe for the PDF only.
 */
function formatPdfEUR(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n).toFixed(2).replace('.', ',');
  return n < 0 ? `-${abs} EUR` : `${abs} EUR`;
}

function formatPdfDiscount(value: number): string {
  return `-${formatPdfEUR(Math.abs(value))}`;
}

let cachedLogoDataUrl: string | null = null;

async function loadLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const response = await fetch(logoHorizontalUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.drawImage(bitmap, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    // White (and light AA) ink → purple; dark/black stays transparent.
    if (lum < 40) {
      data[i + 3] = 0;
      continue;
    }
    data[i] = LOGO_PURPLE.r;
    data[i + 1] = LOGO_PURPLE.g;
    data[i + 2] = LOGO_PURPLE.b;
    data[i + 3] = Math.round(alpha * (lum / 255));
  }
  ctx.putImageData(image, 0, 0);
  cachedLogoDataUrl = canvas.toDataURL('image/png');
  bitmap.close();
  return cachedLogoDataUrl;
}

export function receiptPdfFilename(order: Order): string {
  return `tropic-boost-ticket-${order.number}.pdf`;
}

export async function buildReceiptPdf(
  order: Order,
  eventName?: string,
): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const ensureSpace = (needed: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 22;
    }
  };

  // Logo izquierda + datos fiscales arriba a la derecha
  try {
    const logo = await loadLogoDataUrl();
    const logoW = 52;
    const logoH = (207 / 951) * logoW;
    doc.addImage(logo, 'PNG', margin, y, logoW, logoH);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TROPIC BOOST', margin, y + 8);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60);
  const fiscalRight = margin + contentWidth;
  doc.text(FISCAL.name, fiscalRight, y + 3, { align: 'right' });
  doc.text(FISCAL.nif, fiscalRight, y + 7.5, { align: 'right' });
  const addressLines = doc.splitTextToSize(FISCAL.address, 72);
  doc.text(addressLines, fiscalRight, y + 12, { align: 'right' });
  doc.setTextColor(0);

  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Factura simplificada', margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const meta = [
    eventName ? `Evento: ${eventName}` : '',
    `Pedido #${order.number}`,
    `Cliente: ${order.customerName}`,
    `Fecha: ${new Date(order.createdAt).toLocaleString('es-ES')}`,
    `Pago: ${order.paymentMethod}${order.paid ? ' (pagado)' : ''}`,
  ].filter(Boolean);

  for (const row of meta) {
    ensureSpace(6);
    doc.text(row, margin, y);
    y += 5.5;
  }

  y += 4;
  ensureSpace(8);
  doc.setDrawColor(160, 120, 200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Bowls', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  order.lines.forEach((line, index) => {
    y = drawBowl(doc, line, index + 1, margin, contentWidth, y, ensureSpace);
    y += 4;
  });

  ensureSpace(8);
  doc.line(margin, y, margin + contentWidth, y);
  y += 8;

  const totals = receiptTotals(order);
  const allDiscounts = totals.lineDiscounts + totals.orderDiscount;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Totales (IVA incluido)', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const totalRows: Array<[string, string]> = [
    ['Subtotal', formatPdfEUR(totals.subtotal)],
  ];
  if (allDiscounts > 0) {
    totalRows.push(['Descuentos', formatPdfDiscount(allDiscounts)]);
  }
  totalRows.push(
    ['Base imponible', formatPdfEUR(totals.net)],
    [`IVA (${Math.round(IVA_RATE * 100)}%)`, formatPdfEUR(totals.iva)],
  );

  for (const [label, value] of totalRows) {
    ensureSpace(6);
    doc.text(label, margin, y);
    doc.text(value, margin + contentWidth, y, { align: 'right' });
    y += 5.5;
  }

  y += 2;
  ensureSpace(8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL', margin, y);
  doc.text(formatPdfEUR(totals.total), margin + contentWidth, y, {
    align: 'right',
  });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  ensureSpace(10);
  doc.text('Gracias por tu pedido · Tropic Boost', margin, y);
  y += 5;
  doc.text(FROM_EMAIL, margin, y);
  doc.setTextColor(0);

  const filename = receiptPdfFilename(order);
  const blob = doc.output('blob');
  return { blob, filename };
}

function drawBowl(
  doc: jsPDF,
  line: OrderLine,
  index: number,
  margin: number,
  contentWidth: number,
  startY: number,
  ensureSpace: (needed: number) => void,
): number {
  let y = startY;
  const total = lineTotal(line);
  const ingredients = line.ingredients || [];
  const config = parseRecipe(ingredients);
  const base =
    ingredients.find((item) => /a[cç]a[ií]/i.test(item)) || 'Açaí';
  const grossUnit = lineGrossUnit(line);
  const hasDiscount = (line.lineDiscount || 0) > 0;

  ensureSpace(28);
  doc.setFont('helvetica', 'bold');
  doc.text(`${index}. ${line.quantity}× ${line.productName}`, margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  const details = [
    `Base: ${base}`,
    line.size ? `Tamaño: ${line.size} ml` : '',
    config.fruits.length ? `Fruta: ${config.fruits.join(', ')}` : '',
    config.solids.length ? `Duro: ${config.solids.join(', ')}` : '',
    config.softs.length ? `Blando: ${config.softs.join(', ')}` : '',
    config.whey ? `Extra: ${WHEY}` : '',
  ].filter(Boolean);

  for (const detail of details) {
    ensureSpace(5);
    doc.setTextColor(70);
    doc.text(detail, margin + 2, y);
    y += 4.8;
  }
  doc.setTextColor(0);

  ensureSpace(6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Precio${line.quantity > 1 ? ' ud.' : ''}`, margin + 2, y);
  doc.text(formatPdfEUR(grossUnit), margin + contentWidth, y, {
    align: 'right',
  });
  y += 4.8;

  if (hasDiscount) {
    ensureSpace(5);
    const dtoAmount = (line.lineDiscount || 0) * line.quantity;
    const dtoLabel = line.promotionName
      ? `Descuento (${line.promotionName})`
      : 'Descuento';
    doc.setTextColor(70);
    doc.text(dtoLabel, margin + 2, y);
    doc.text(formatPdfDiscount(dtoAmount), margin + contentWidth, y, {
      align: 'right',
    });
    doc.setTextColor(0);
    y += 4.8;
  }

  ensureSpace(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Total bowl', margin + 2, y);
  doc.text(formatPdfEUR(total), margin + contentWidth, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(210, 190, 230);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(margin, y, margin + contentWidth, y);
  doc.setLineDashPattern([], 0);
  y += 4;
  doc.setFont('helvetica', 'normal');
  return y;
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
