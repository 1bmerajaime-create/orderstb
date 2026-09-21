import { CheckCircle2, Trash2 } from 'lucide-react';
import { Modal } from './ui';
import { useStore } from '../lib/store';
import { formatTime } from '../lib/utils';
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
                </div>
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
