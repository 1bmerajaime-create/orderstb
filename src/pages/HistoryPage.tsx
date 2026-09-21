import { Eye, ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { PageHeader, StatusBadge, Topbar } from '../components/ui';
import { useStore } from '../lib/store';
import { formatDateRange, formatEUR, formatTime } from '../lib/utils';
import type { Order } from '../types';

export function HistoryPage() {
  const { eventId } = useParams();
  const { data } = useStore();
  const event = data.events.find((e) => e.id === eventId);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const [productFilter, setProductFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const orders = useMemo(() => {
    return data.orders
      .filter((o) => o.eventId === eventId)
      .filter((o) => {
        if (!productFilter) return true;
        return o.lines.some((l) => l.productId === productFilter);
      })
      .filter((o) => !paymentFilter || o.paymentMethod === paymentFilter)
      .filter((o) => {
        if (!dateFilter) return true;
        return o.createdAt.slice(0, 10) === dateFilter;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [data.orders, eventId, productFilter, paymentFilter, dateFilter]);

  if (!event) return <Navigate to="/" replace />;

  return (
    <div className="app-shell">
      <Topbar
        right={
          <Link
            className="btn btn-primary btn-sm"
            to={`/evento/${event.id}/pedidos`}
          >
            <ShoppingBag size={16} /> Pedidos
          </Link>
        }
      />

      <main className="page">
        <PageHeader
          backTo={`/evento/${event.id}`}
          backLabel="Atrás"
          title={event.name}
          description={`${formatDateRange(event.date, event.endDate)} · Filtra por producto, pago o fecha.`}
        />

        <section className="panel">
          <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
            <div className="field">
              <label>Producto</label>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {data.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Método de pago</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="efectivo">Efectivo</option>
                <option value="bizum">Bizum</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
            <div className="field">
              <label>Fecha</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="empty">
              <strong>Sin resultados</strong>
              Ajusta los filtros o crea pedidos en el TPV.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Productos</th>
                    <th>Total</th>
                    <th>Pago</th>
                    <th>Estado</th>
                    <th>Hora</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>#{o.number}</strong>
                      </td>
                      <td>{o.customerName}</td>
                      <td>
                        {o.lines
                          .map((l) => `${l.quantity}× ${l.productName}`)
                          .join(', ')}
                        {o.promotionName && (
                          <div
                            style={{
                              color: 'var(--lavender)',
                              fontSize: '0.78rem',
                            }}
                          >
                            Promo: {o.promotionName}
                          </div>
                        )}
                      </td>
                      <td>{formatEUR(o.total)}</td>
                      <td>
                        {o.paymentMethod}
                        {!o.paid && (
                          <div>
                            <span className="badge badge-unpaid">Sin pagar</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>{formatTime(o.createdAt)}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDetailOrder(o)}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
