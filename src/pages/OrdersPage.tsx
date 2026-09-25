import { Check, ChefHat, History, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { PageHeader, Topbar } from '../components/ui';
import { useStore } from '../lib/store';
import { resolveAllProducts } from '../lib/productSizes';
import { formatTime } from '../lib/utils';
import type { Order } from '../types';

type BoardTab = 'curso' | 'listos';

export function OrdersPage() {
  const { eventId } = useParams();
  const { data, updateOrderStatus } = useStore();
  const event = data.events.find((e) => e.id === eventId);
  const [tab, setTab] = useState<BoardTab>('curso');
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const resolvedProducts = useMemo(
    () => resolveAllProducts(data.products, data.recipes, data.sizes),
    [data.products, data.recipes, data.sizes],
  );

  const eventOrders = useMemo(
    () =>
      data.orders
        .filter((o) => o.eventId === eventId)
        .sort((a, b) => a.number - b.number),
    [data.orders, eventId],
  );

  const inProgress = eventOrders.filter(
    (o) => o.status === 'pendiente' || o.status === 'en_preparacion',
  );
  const ready = eventOrders.filter((o) => o.status === 'listo');

  if (!event) return <Navigate to="/" replace />;

  function OrderCard({
    order,
    className,
    actions,
  }: {
    order: Order;
    className?: string;
    actions: ReactNode | null;
  }) {
    return (
      <article
        className={`order-card clickable-card${className ? ` ${className}` : ''}`}
        onClick={() => setDetailOrder(order)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetailOrder(order);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="order-card-head">
          <div>
            <div className="order-num">#{order.number}</div>
            <div className="order-meta">
              {order.customerName} · {formatTime(order.createdAt)}
            </div>
          </div>
        </div>
        <div className="order-card-products">
          {order.lines.map((line, index) => {
            const product = resolvedProducts.find(
              (item) => item.id === line.productId,
            );
            const ingredients = line.ingredients || product?.ingredients || [];
            return (
              <div
                className="order-card-product"
                key={`${line.productId}-${index}`}
              >
                <strong>
                  {line.quantity}× {line.productName}
                  {line.size ? ` · ${line.size} ml` : ''}
                  {line.customized && (
                    <span className="customized-badge">Modificado</span>
                  )}
                </strong>
                <span>{ingredients.join(' · ')}</span>
              </div>
            );
          })}
        </div>
        {actions && (
          <div
            className="event-row-actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="app-shell">
      <Topbar
        right={
          <Link
            className="btn btn-ghost btn-sm"
            to={`/evento/${event.id}/historico`}
          >
            <History size={16} /> Histórico
          </Link>
        }
      />

      <main className="page">
        <PageHeader
          backTo={`/evento/${event.id}`}
          backLabel="Atrás"
          title="Pedidos"
          description="Consulta cada producto y sus ingredientes. La acción principal termina el pedido y lo mueve a Listos."
          actions={
            <Link
              className="btn btn-primary"
              to={`/evento/${event.id}/nuevo-pedido`}
            >
              <Plus size={16} /> Crear pedido
            </Link>
          }
        />

        <div className="tabs-row">
          <button
            className={`nav-pill${tab === 'curso' ? ' active' : ''}`}
            onClick={() => setTab('curso')}
          >
            <ChefHat size={16} /> En curso ({inProgress.length})
          </button>
          <button
            className={`nav-pill${tab === 'listos' ? ' active' : ''}`}
            onClick={() => setTab('listos')}
          >
            <Check size={16} /> Listos ({ready.length})
          </button>
        </div>

        {tab === 'curso' && (
          <section className="panel">
            <div className="panel-header">
              <h2>En curso</h2>
            </div>
            {inProgress.length === 0 ? (
              <div className="empty">
                <strong>Nada en preparación</strong>
                Crea un pedido desde el dashboard o con el botón de arriba.
              </div>
            ) : (
              <div className="grid grid-3">
                {inProgress.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    className={o.status === 'en_preparacion' ? 'prep' : ''}
                    actions={
                      <button
                        className="btn btn-primary"
                        onClick={() => updateOrderStatus(o.id, 'listo')}
                      >
                        <Check size={17} /> Marcar como terminado
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'listos' && (
          <section className="panel">
            <div className="panel-header">
              <h2>Listos</h2>
            </div>
            {ready.length === 0 ? (
              <div className="empty">
                <strong>Ningún pedido listo</strong>
                Cuando marques un pedido como listo, aparecerá aquí.
              </div>
            ) : (
              <div className="grid grid-3">
                {ready.map((o) => (
                  <OrderCard key={o.id} order={o} className="ready" actions={null} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </div>
  );
}
