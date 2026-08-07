import { Check, ChefHat, History, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { NewOrderModal } from '../components/NewOrderModal';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { PageHeader, StatusBadge, Topbar } from '../components/ui';
import { useStore } from '../lib/store';
import { formatEUR, formatTime } from '../lib/utils';
import type { Order } from '../types';

type BoardTab = 'curso' | 'listos';

export function OrdersPage() {
  const { eventId } = useParams();
  const { data, updateOrderStatus, markPaid } = useStore();
  const event = data.events.find((e) => e.id === eventId);
  const [tab, setTab] = useState<BoardTab>('curso');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const eventOrders = useMemo(
    () =>
      data.orders
        .filter((o) => o.eventId === eventId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
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
          <StatusBadge status={order.status} />
        </div>
        <ul className="order-lines">
          {order.lines.map((l) => (
            <li key={l.productId}>
              {l.quantity}× {l.productName}
            </li>
          ))}
        </ul>
        <div className="order-card-foot">
          <strong>{formatEUR(order.total)}</strong>
          {!order.paid && (
            <span className="badge badge-unpaid">Sin pagar</span>
          )}
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
        subtitle={`Pedidos · ${event.name}`}
        right={
          <>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowNewOrder(true)}
            >
              <Plus size={16} /> Crear pedido
            </button>
            <Link
              className="btn btn-ghost btn-sm"
              to={`/evento/${event.id}/historico`}
            >
              <History size={16} /> Histórico
            </Link>
          </>
        }
      />

      <main className="page">
        <PageHeader
          backTo={`/evento/${event.id}`}
          backLabel="Atrás"
          title="Pedidos"
          description="Los pedidos nuevos aparecen en curso. Al marcarlos listos pasan a Listos. Toca una card para ver el detalle o eliminarlo."
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
                      <>
                        {o.status === 'pendiente' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              updateOrderStatus(o.id, 'en_preparacion')
                            }
                          >
                            Empezar
                          </button>
                        )}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => updateOrderStatus(o.id, 'listo')}
                        >
                          Marcar listo
                        </button>
                        {!o.paid && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => markPaid(o.id, 'tarjeta')}
                          >
                            Cobrar
                          </button>
                        )}
                      </>
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

      {showNewOrder && (
        <NewOrderModal
          eventId={event.id}
          onClose={() => setShowNewOrder(false)}
        />
      )}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </div>
  );
}
