import { CheckCircle2, Mail, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Modal } from './ui';
import { sendReceiptEmail, FROM_EMAIL } from '../lib/receipt';
import { useStore } from '../lib/store';
import {
  formatEUR,
  formatTime,
  ivaFromGross,
  netFromGross,
} from '../lib/utils';
import type { Order } from '../types';

export function OrderDetailModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { data, deleteOrder, updateOrderStatus } = useStore();
  const currentOrder = data.orders.find((item) => item.id === order.id) || order;
  const event = data.events.find((item) => item.id === currentOrder.eventId);
  const [email, setEmail] = useState(currentOrder.customerEmail || '');
  const [emailNote, setEmailNote] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSendReceipt() {
    if (!email.trim()) {
      setEmailNote('Indica un email.');
      return;
    }
    setSending(true);
    setEmailNote('');
    try {
      const result = await sendReceiptEmail({
        to: email.trim(),
        order: currentOrder,
        eventName: event?.name,
      });
      setEmailNote(result.message);
    } catch (error) {
      setEmailNote(
        error instanceof Error ? error.message : 'No se pudo enviar el recibo',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={`Pedido #${currentOrder.number}`} onClose={onClose} wide>
      <div className="order-detail">
        <div className="order-detail-summary">
          <strong>{currentOrder.customerName}</strong>
          <span>{formatTime(currentOrder.createdAt)}</span>
        </div>

        <p className="order-modal-label">Productos e ingredientes</p>
        <div className="order-detail-lines">
          {currentOrder.lines.map((line, index) => {
            const product = data.products.find((p) => p.id === line.productId);
            const ingredients = line.ingredients || product?.ingredients || [];
            return (
              <article
                key={`${line.productId}-${index}`}
                className="order-detail-line"
              >
                <div className="order-detail-line-head">
                  <strong>
                    {line.quantity}× {line.productName}
                    {line.customized && (
                      <span className="customized-badge">Modificado</span>
                    )}
                  </strong>
                  <span>{formatEUR(line.unitPrice * line.quantity)}</span>
                </div>
                {(line.lineDiscount || 0) > 0 && (
                  <p className="muted">
                    Dto. producto −{formatEUR(line.lineDiscount || 0)}
                  </p>
                )}
                <ul className="ingredient-chips">
                  {ingredients.map((ing) => (
                    <li key={ing}>{ing}</li>
                  ))}
                  {!ingredients.length && (
                    <li className="muted">Sin ingredientes en catálogo</li>
                  )}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="totals totals-inline">
          <div className="totals-row">
            <span>Subtotal</span>
            <span>{formatEUR(currentOrder.subtotal)}</span>
          </div>
          <div className="totals-row">
            <span>Descuento</span>
            <span>−{formatEUR(currentOrder.discount)}</span>
          </div>
          <div className="totals-row">
            <span>Base (sin IVA)</span>
            <span>{formatEUR(netFromGross(currentOrder.total))}</span>
          </div>
          <div className="totals-row">
            <span>IVA 21%</span>
            <span>{formatEUR(ivaFromGross(currentOrder.total))}</span>
          </div>
          <div className="totals-row grand">
            <span>Total</span>
            <span>{formatEUR(currentOrder.total)}</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="receipt-email">Enviar ticket por Gmail</label>
          <div className="discount-row">
            <input
              id="receipt-email"
              type="email"
              placeholder="cliente@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={sending}
              onClick={handleSendReceipt}
            >
              <Mail size={16} /> {sending ? 'Abriendo…' : 'Abrir en Gmail'}
            </button>
          </div>
          {emailNote && <p className="builder-status complete">{emailNote}</p>}
          <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
            Se abre Gmail con el ticket (productos + IVA). Envíalo desde{' '}
            {FROM_EMAIL}.
          </p>
        </div>

        <div className="modal-actions order-detail-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (
                confirm(
                  `¿Eliminar el pedido #${currentOrder.number}? Esta acción no se puede deshacer.`,
                )
              ) {
                deleteOrder(currentOrder.id);
                onClose();
              }
            }}
          >
            <Trash2 size={16} /> Eliminar pedido
          </button>
          {currentOrder.status !== 'listo' &&
            currentOrder.status !== 'entregado' && (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  updateOrderStatus(currentOrder.id, 'listo');
                  onClose();
                }}
              >
                <CheckCircle2 size={18} /> Marcar como terminado
              </button>
            )}
        </div>
      </div>
    </Modal>
  );
}
