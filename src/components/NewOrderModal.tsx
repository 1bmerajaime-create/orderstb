import { useMemo, useState } from 'react';
import { Modal } from './ui';
import { useStore } from '../lib/store';
import {
  calcDiscount,
  calcSubtotal,
  formatEUR,
  round2,
} from '../lib/utils';
import type { OrderLine, PaymentMethod } from '../types';

export function NewOrderModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { data, createOrder } = useStore();
  const [customerName, setCustomerName] = useState('');
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});
  const [promotionId, setPromotionId] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('tarjeta');
  const [paid, setPaid] = useState(true);

  const lines: OrderLine[] = useMemo(() => {
    return data.products
      .filter((p) => (qtyByProduct[p.id] || 0) > 0)
      .map((p) => ({
        productId: p.id,
        productName: p.name,
        quantity: qtyByProduct[p.id],
        unitPrice: p.price,
      }));
  }, [data.products, qtyByProduct]);

  const promo = data.promotions.find((p) => p.id === promotionId);
  const subtotal = calcSubtotal(lines);
  const discount = calcDiscount(lines, promo);
  const total = round2(Math.max(0, subtotal - discount));

  function setQty(productId: string, quantity: number) {
    setQtyByProduct((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  function submit() {
    if (lines.length === 0) return;
    createOrder({
      eventId,
      customerName,
      lines,
      promotionId: promotionId || undefined,
      paymentMethod,
      paid: paid && paymentMethod !== 'pendiente',
    });
    onClose();
  }

  return (
    <Modal title="Nuevo pedido" onClose={onClose} wide>
      <div className="field">
        <label htmlFor="order-customer">Nombre del cliente (opcional)</label>
        <input
          id="order-customer"
          placeholder="Ej. Ana / Dorsal 214"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          autoFocus
        />
      </div>

      <p className="order-modal-label">Productos</p>
      <div className="order-product-list">
        {data.products.map((p) => {
          const qty = qtyByProduct[p.id] || 0;
          return (
            <div
              key={p.id}
              className={`order-product-row${qty > 0 ? ' selected' : ''}`}
            >
              <div className="order-product-info">
                <strong>{p.name}</strong>
                <span>
                  {p.tag}
                  {p.kcal ? ` · ${p.kcal} kcal` : ''} · {formatEUR(p.price)}
                </span>
              </div>
              <div className="qty-control qty-control-lg">
                <button
                  type="button"
                  aria-label={`Quitar ${p.name}`}
                  onClick={() => setQty(p.id, qty - 1)}
                  disabled={qty === 0}
                >
                  −
                </button>
                <span className="qty-value">{qty}</span>
                <button
                  type="button"
                  aria-label={`Añadir ${p.name}`}
                  onClick={() => setQty(p.id, qty + 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-2" style={{ marginTop: '1rem' }}>
        <div className="field">
          <label htmlFor="order-promo">Promoción</label>
          <select
            id="order-promo"
            value={promotionId}
            onChange={(e) => setPromotionId(e.target.value)}
          >
            <option value="">Sin descuento</option>
            {data.promotions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Método de pago</label>
          <div className="payment-grid">
            {(
              [
                ['tarjeta', 'Tarjeta'],
                ['efectivo', 'Efectivo'],
                ['bizum', 'Bizum'],
                ['pendiente', 'Pendiente'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`pay-option${paymentMethod === id ? ' active' : ''}`}
                onClick={() => {
                  setPaymentMethod(id);
                  setPaid(id !== 'pendiente');
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {paymentMethod !== 'pendiente' && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
          />
          Marcar como pagado
        </label>
      )}

      <div className="totals totals-inline">
        <div className="totals-row">
          <span>Subtotal</span>
          <span>{formatEUR(subtotal)}</span>
        </div>
        <div className="totals-row">
          <span>Descuento</span>
          <span>−{formatEUR(discount)}</span>
        </div>
      </div>

      <div className="order-modal-footer">
        <div className="order-modal-total">
          <span>Total</span>
          <strong>{formatEUR(total)}</strong>
        </div>
        <div className="modal-actions order-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={lines.length === 0}
            onClick={submit}
          >
            Crear pedido
          </button>
        </div>
      </div>
    </Modal>
  );
}
