import { ClipboardList, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NewOrderModal } from "../components/NewOrderModal";
import { EventDatePicker } from "../components/EventDatePicker";
import { Modal, Money, PageHeader, Topbar } from "../components/ui";
import { useStore } from "../lib/store";
import {
  buildSalesSeries,
  type ChartGranularity,
  eventKPIs,
  eventMaterialsCost,
  formatDateRange,
  formatEUR,
  uid,
} from "../lib/utils";
import type { EventMaterialUsed } from "../types";

export function EventDashboardPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { data, logout, updateEvent, deleteEvent } = useStore();
  const event = data.events.find((e) => e.id === eventId);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [chartGranularity, setChartGranularity] =
    useState<ChartGranularity>("hora");

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [place, setPlace] = useState("");
  const [cost, setCost] = useState("");

  useEffect(() => {
    if (!event) return;
    setName(event.name);
    setDate(event.date);
    setEndDate(event.endDate || event.date);
    setPlace(event.place);
    setCost(String(event.cost));
  }, [event]);

  const kpis = useMemo(
    () => (eventId ? eventKPIs(data, eventId) : null),
    [data, eventId],
  );

  const salesSeries = useMemo(
    () =>
      kpis ? buildSalesSeries(kpis.completedOrders, chartGranularity) : [],
    [kpis, chartGranularity],
  );

  const ordersSeries = useMemo(
    () => (kpis ? buildSalesSeries(kpis.allOrders, chartGranularity) : []),
    [kpis, chartGranularity],
  );

  const materialsTotal = event ? eventMaterialsCost(event) : 0;

  const chartTitle =
    chartGranularity === "hora"
      ? "por hora"
      : chartGranularity === "dia"
        ? "por día"
        : "por semana";

  if (!event || !kpis) return <Navigate to="/" replace />;

  function saveEventDetails(e: FormEvent) {
    e.preventDefault();
    const start = date;
    const end = endDate && endDate >= start ? endDate : start;
    updateEvent(event!.id, {
      name: name.trim(),
      date: start,
      endDate: end,
      place: place.trim(),
      cost: Number(cost) || 0,
    });
    setEditing(false);
  }

  function addMaterialFromCatalog(materialId: string) {
    const mat = data.materials.find((m) => m.id === materialId);
    if (!mat || !event) return;
    const row: EventMaterialUsed = {
      id: uid("emu"),
      materialId: mat.id,
      name: mat.name,
      quantity: 1,
      unit: mat.unit || "kg",
      unitPrice: mat.price,
    };
    updateEvent(event.id, {
      materialsUsed: [...(event.materialsUsed || []), row],
    });
  }

  function updateMaterialRow(id: string, patch: Partial<EventMaterialUsed>) {
    if (!event) return;
    updateEvent(event.id, {
      materialsUsed: (event.materialsUsed || []).map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    });
  }

  function removeMaterialRow(id: string) {
    if (!event) return;
    updateEvent(event.id, {
      materialsUsed: (event.materialsUsed || []).filter((m) => m.id !== id),
    });
  }

  return (
    <div className="app-shell">
      <Topbar
        subtitle={event.name}
        right={
          <>
            <Link
              className="btn btn-ghost btn-sm"
              to={`/evento/${event.id}/historico`}
            >
              <History size={16} /> Histórico
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Salir
            </button>
          </>
        }
      />

      <main className="page">
        <PageHeader
          backTo="/"
          backLabel="Atrás"
          title={event.name}
          description={
            <>
              {formatDateRange(event.date, event.endDate)} · {event.place} ·
              Coste operativo {formatEUR(event.cost)}
            </>
          }
          actions={
            <>
              <button
                className="btn btn-ghost btn-lg"
                onClick={() => setEditing(true)}
              >
                <Pencil size={18} /> Editar evento
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setShowNewOrder(true)}
              >
                <Plus size={18} /> Crear pedido
              </button>
              <Link
                className="btn btn-ghost btn-lg"
                to={`/evento/${event.id}/pedidos`}
              >
                <ClipboardList size={18} /> Ver pedidos
                {kpis.boardOrders.length > 0
                  ? ` (${kpis.boardOrders.length})`
                  : ""}
              </Link>
            </>
          }
        />

        {editing && (
          <Modal title="Editar evento" onClose={() => setEditing(false)} wide>
            <form onSubmit={saveEventDetails}>
              <div className="field">
                <label>Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Lugar</label>
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                />
              </div>
              <EventDatePicker
                start={date}
                end={endDate}
                onChange={(s, e) => {
                  setDate(s);
                  setEndDate(e);
                }}
              />
              <div className="field">
                <label>Coste / precio operativo (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </div>
              <div className="modal-actions modal-actions-spread">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    if (
                      confirm(
                        `¿Eliminar el evento “${event.name}”? Se perderán sus pedidos asociados.`,
                      )
                    ) {
                      deleteEvent(event.id);
                      navigate("/");
                    }
                  }}
                >
                  <Trash2 size={16} /> Eliminar
                </button>
                <div className="event-row-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setEditing(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Guardar cambios
                  </button>
                </div>
              </div>
            </form>
          </Modal>
        )}

        <div
          className="grid grid-4 stagger"
          style={{ marginBottom: "1.25rem" }}
        >
          <button
            type="button"
            className="kpi kpi-clickable"
            onClick={() => navigate(`/evento/${event.id}/pedidos`)}
          >
            <div className="kpi-label">Pedidos totales</div>
            <div className="kpi-value">{kpis.totalOrders}</div>
            <div className="kpi-hint">
              {kpis.inProgressOrders.length} en curso ·{' '}
              {kpis.readyOrders.length} listos · Toca para ver
            </div>
          </button>
          <div className="kpi">
            <div className="kpi-label">Total ingresado</div>
            <div className="kpi-value">
              <Money value={kpis.revenue} />
            </div>
            <div className="kpi-hint">
              Ticket medio {formatEUR(kpis.avgTicket)}
            </div>
          </div>
          <button
            type="button"
            className="kpi kpi-clickable"
            onClick={() => setShowMaterials(true)}
          >
            <div className="kpi-label">Materia prima</div>
            <div className="kpi-value num-negative">
              {formatEUR(kpis.materialCost)}
            </div>
            <div className="kpi-hint">
              {kpis.materialCostIsEstimate
                ? "Toca para registrar consumo"
                : "Toca para ver / editar"}
            </div>
          </button>
          <div className="kpi">
            <div className="kpi-label">Beneficio neto</div>
            <div className="kpi-value">
              <Money value={kpis.reserva} />
            </div>
            <div className="kpi-hint">
              Ingresos − materia prima − coste operativo (
              {formatEUR(kpis.eventCost)})
            </div>
          </div>
        </div>

        <div className="chart-filters">
          {(
            [
              ["hora", "Horas"],
              ["dia", "Días"],
              ["semana", "Semana"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`nav-pill${chartGranularity === id ? " active" : ""}`}
              onClick={() => setChartGranularity(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-2" style={{ marginBottom: "1.25rem" }}>
          <section className="panel">
            <div className="panel-header">
              <h2>Ventas {chartTitle}</h2>
            </div>
            {salesSeries.length === 0 ? (
              <div className="empty">
                <strong>Sin datos aún</strong>
                Las ventas aparecerán cuando registres pedidos.
              </div>
            ) : (
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesSeries}>
                    <CartesianGrid
                      stroke="rgba(201,168,232,0.12)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#c4a8de"
                      tick={{ fill: "#c4a8de", fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#c4a8de"
                      tick={{ fill: "#c4a8de", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e1030",
                        border: "1px solid rgba(201,168,232,0.2)",
                        borderRadius: 12,
                      }}
                      formatter={(v) => formatEUR(Number(v))}
                    />
                    <Bar dataKey="total" fill="#a855e0" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Pedidos {chartTitle}</h2>
            </div>
            {ordersSeries.length === 0 ? (
              <div className="empty">
                <strong>Sin actividad</strong>
                Crea el primer pedido para empezar el servicio.
              </div>
            ) : (
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ordersSeries}>
                    <CartesianGrid
                      stroke="rgba(201,168,232,0.12)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#c4a8de"
                      tick={{ fill: "#c4a8de", fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="#c4a8de"
                      tick={{ fill: "#c4a8de", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e1030",
                        border: "1px solid rgba(201,168,232,0.2)",
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="#7a35c0" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h2>Productos más vendidos</h2>
          </div>
          {kpis.productSales.length === 0 ? (
            <div className="empty">
              <strong>Todavía no hay ventas</strong>
              Comparativa de bowls cuando haya pedidos cobrados.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Ud. vendidas</th>
                    <th>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.productSales.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>{p.qty}</td>
                      <td>{formatEUR(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {showNewOrder && (
        <NewOrderModal
          eventId={event.id}
          onClose={() => setShowNewOrder(false)}
        />
      )}

      {showMaterials && (
        <Modal
          title="Materia prima gastada"
          onClose={() => setShowMaterials(false)}
          wide
        >
          <div className="materials-modal-total">
            Total: <strong>{formatEUR(materialsTotal)}</strong>
          </div>

          <div className="field">
            <label>Añadir del catálogo</label>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  addMaterialFromCatalog(e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="">Selecciona un ingrediente…</option>
              {data.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({formatEUR(m.price)}/{m.unit || "ud"})
                </option>
              ))}
            </select>
          </div>

          {(event.materialsUsed || []).length === 0 ? (
            <div className="empty">
              <strong>Sin consumo registrado</strong>
              Añade ingredientes con cantidad (unidades) y precio unitario.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Precio / ud.</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(event.materialsUsed || []).map((m) => (
                    <tr key={m.id}>
                      <td>
                        <input
                          className="inline-input"
                          value={m.name}
                          onChange={(e) =>
                            updateMaterialRow(m.id, { name: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={m.quantity}
                          onChange={(e) =>
                            updateMaterialRow(m.id, {
                              quantity: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          value={m.unit}
                          onChange={(e) =>
                            updateMaterialRow(m.id, { unit: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={m.unitPrice}
                          onChange={(e) =>
                            updateMaterialRow(m.id, {
                              unitPrice: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td>{formatEUR(m.quantity * m.unitPrice)}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          onClick={() => removeMaterialRow(m.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowMaterials(false)}
            >
              Listo
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
