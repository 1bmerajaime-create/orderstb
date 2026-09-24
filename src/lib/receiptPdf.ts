import { jsPDF } from 'jspdf';
import { parseRecipe, WHEY } from './bowl';
import { lineTotal, receiptTotals, FROM_EMAIL } from './receipt';
import { IVA_RATE, formatEUR } from './utils';
import type { Order, OrderLine } from '../types';

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
  let y = 22;

  const ensureSpace = (needed: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 22;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TROPIC BOOST', margin, y);
  y += 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Ticket de pedido', margin, y);
  y += 10;

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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Totales pedido (IVA incluido)', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const totalRows: Array<[string, string]> = [
    ['Subtotal', formatEUR(totals.subtotal)],
  ];
  if (totals.lineDiscounts > 0) {
    totalRows.push(['Descuentos por bowl', `−${formatEUR(totals.lineDiscounts)}`]);
  }
  if (totals.orderDiscount > 0) {
    totalRows.push(['Descuento pedido', `−${formatEUR(totals.orderDiscount)}`]);
  }
  totalRows.push(
    ['Base imponible', formatEUR(totals.net)],
    [`IVA (${Math.round(IVA_RATE * 100)}%)`, formatEUR(totals.iva)],
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
  doc.text('TOTAL PEDIDO', margin, y);
  doc.text(formatEUR(totals.total), margin + contentWidth, y, { align: 'right' });
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
  const grossUnit =
    line.baseUnitPrice ?? line.unitPrice + (line.lineDiscount || 0);

  ensureSpace(28);
  doc.setFont('helvetica', 'bold');
  doc.text(`${index}. ${line.quantity}× ${line.productName}`, margin, y);
  doc.text(formatEUR(total), margin + contentWidth, y, { align: 'right' });
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  const details = [
    `Base: ${base}`,
    config.fruits.length ? `Fruta: ${config.fruits.join(', ')}` : '',
    config.solids.length ? `Duro: ${config.solids.join(', ')}` : '',
    config.softs.length ? `Blando: ${config.softs.join(', ')}` : '',
    config.whey ? `Extra: ${WHEY}` : '',
    (line.lineDiscount || 0) > 0
      ? `Dto.${line.promotionName ? ` ${line.promotionName}` : ''}: −${formatEUR(line.lineDiscount || 0)} (${formatEUR(grossUnit)} → ${formatEUR(line.unitPrice)})`
      : '',
  ].filter(Boolean);

  for (const detail of details) {
    ensureSpace(5);
    doc.setTextColor(70);
    doc.text(detail, margin + 2, y);
    y += 4.8;
  }
  doc.setTextColor(0);

  ensureSpace(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Total bowl', margin + 2, y);
  doc.text(formatEUR(total), margin + contentWidth, y, { align: 'right' });
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
