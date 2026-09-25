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
import { Modal, Money, PageHeader, Topbar } from "../components/ui";
import { useStore } from "../lib/store";
import {
  buildSalesSeries,
  eventKPIs,
  eventMaterialsCost,
  formatDateRange,
  formatEUR,
  IVA_RATE,
  round2,
  uid,
} from "../lib/utils";
import type { EventMaterialUsed } from "../types";

export function EventDashboardPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { data, logout, updateEvent, deleteEvent } = useStore();
  const event = data.events.find((e) => e.id === eventId);
  const [editing, setEditing] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [salesProductId, setSalesProductId] = useState("all");

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
      kpis
        ? buildSalesSeries(
            kpis.completedOrders,
            "hora",
            salesProductId === "all" ? undefined : salesProductId,
          )
        : [],
    [kpis, salesProductId],
  );

  const materialsTotal = event ? eventMaterialsCost(event) : 0;

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
          topAction={
            <button
              className="icon-btn"
              type="button"
              aria-label="Editar evento"
              title="Editar evento"
              onClick={() => setEditing(true)}
            >
              <Pencil size={18} />
            </button>
          }
          title={event.name}
          description={
            <>
              {formatDateRange(event.date, event.endDate)} · {event.place} ·
              Coste operativo {formatEUR(event.cost)}
            </>
          }
          actions={
            <>
              <Link
                className="btn btn-primary btn-lg"
                to={`/evento/${event.id}/nuevo-pedido`}
              >
                <Plus size={18} /> Crear pedido
              </Link>
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
          <Modal title="Editar evento" onClose={() => setEditing(false)}>
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
              <div className="grid grid-2">
                <div className="field">
                  <label>Fecha inicio</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDate(next);
                      if (!endDate || endDate < next) setEndDate(next);
                    }}
                  />
                </div>
                <div className="field">
                  <label>Fecha fin</label>
                  <input
                    type="date"
                    min={date || undefined}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
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
              {kpis.materialCost > 0
                ? "Registrado · toca para ver / editar"
                : "Toca para registrar consumo"}
            </div>
          </button>
          <div className="kpi">
            <div className="kpi-label">Beneficio neto</div>
            <div className="kpi-value">
              <Money value={kpis.reserva} />
            </div>
            <div className="kpi-hint">
              Sin IVA {Math.round(IVA_RATE * 100)}% − materia prima − coste (
              {formatEUR(kpis.eventCost)})
            </div>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginBottom: "1.25rem" }}>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Ventas durante el día</h2>
                <p className="panel-subtitle">Ingresos agrupados por hora</p>
              </div>
              <select
                className="chart-product-filter"
                aria-label="Filtrar ventas por producto"
                value={salesProductId}
                onChange={(event) => setSalesProductId(event.target.value)}
              >
                <option value="all">Todos los productos</option>
                {data.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
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
              <h2>Productos más vendidos</h2>
            </div>
            {kpis.productSales.length === 0 ? (
              <div className="empty">
                <strong>Todavía no hay ventas</strong>
                La clasificación aparecerá cuando haya pedidos cobrados.
              </div>
            ) : (
              <div className="top-products-list">
                {kpis.productSales.map((product, index) => (
                  <div className="top-product-row" key={product.name}>
                    <span className="top-product-position">{index + 1}</span>
                    <span className="top-product-name">{product.name}</span>
                    <strong>{product.qty} ud.</strong>
                    <span>{formatEUR(product.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {showMaterials && (
        <Modal
          title="Materia prima gastada"
          onClose={() => setShowMaterials(false)}
          wide
        >
          <div className="materials-modal-total">
            Total registrado: <strong>{formatEUR(materialsTotal)}</strong>
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
                      <td>
                        {formatEUR(
                          round2(
                            (Number(m.quantity) || 0) *
                              (Number(m.unitPrice) || 0),
                          ),
                        )}
                      </td>
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
