import { Trash2 } from 'lucide-react';
import { Modal, StatusBadge } from './ui';
import { useStore } from '../lib/store';
import { formatEUR, formatTime } from '../lib/utils';
import type { Order } from '../types';

export function OrderDetailModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { data, deleteOrder } = useStore();

  return (
    <Modal title={`Pedido #${order.number}`} onClose={onClose} wide>
      <div className="order-detail">
        <div className="order-detail-meta">
          <div>
            <span className="order-detail-label">Cliente</span>
            <strong>{order.customerName}</strong>
          </div>
          <div>
            <span className="order-detail-label">Hora</span>
            <strong>{formatTime(order.createdAt)}</strong>
          </div>
          <div>
            <span className="order-detail-label">Estado</span>
            <StatusBadge status={order.status} />
          </div>
          <div>
            <span className="order-detail-label">Pago</span>
            <strong>
              {order.paymentMethod}
              {!order.paid ? ' · pendiente' : ''}
            </strong>
          </div>
        </div>

        <p className="order-modal-label">Bowls e ingredientes</p>
        <div className="order-detail-lines">
          {order.lines.map((line) => {
            const product = data.products.find((p) => p.id === line.productId);
            return (
              <article key={line.productId} className="order-detail-line">
                <div className="order-detail-line-head">
                  <strong>
                    {line.quantity}× {line.productName}
                  </strong>
                  <span>{formatEUR(line.unitPrice * line.quantity)}</span>
                </div>
                {product?.tag && (
                  <p className="order-detail-tag">
                    {product.tag}
                    {product.kcal ? ` · ${product.kcal} kcal` : ''}
                  </p>
                )}
                {product?.description && (
                  <p className="order-detail-desc">{product.description}</p>
                )}
                <ul className="ingredient-chips">
                  {(product?.ingredients || []).map((ing) => (
                    <li key={ing}>{ing}</li>
                  ))}
                  {!product?.ingredients?.length && (
                    <li className="muted">Sin ingredientes en catálogo</li>
                  )}
                </ul>
              </article>
            );
          })}
        </div>

        {order.promotionName && (
          <p className="hint-note">Promo aplicada: {order.promotionName}</p>
        )}

        <div className="totals">
          <div className="totals-row">
            <span>Subtotal</span>
            <span>{formatEUR(order.subtotal)}</span>
          </div>
          <div className="totals-row">
            <span>Descuento</span>
            <span>−{formatEUR(order.discount)}</span>
          </div>
          <div className="totals-row grand">
            <span>Total</span>
            <span>{formatEUR(order.total)}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (
                confirm(
                  `¿Eliminar el pedido #${order.number}? Esta acción no se puede deshacer.`,
                )
              ) {
                deleteOrder(order.id);
                onClose();
              }
            }}
          >
            <Trash2 size={16} /> Eliminar pedido
          </button>
        </div>
      </div>
    </Modal>
  );
}
