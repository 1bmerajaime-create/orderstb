import { ClipboardList, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Modal, Money, PageHeader, Topbar } from "../components/ui";
import { useStore } from "../lib/store";
import { resolveAllProducts } from "../lib/productSizes";
import {
  buildSalesSeries,
  eventDays,
  eventKPIs,
  eventMaterialsCost,
  formatDate,
  formatDateRange,
  formatEUR,
  IVA_RATE,
  round2,
  uid,
} from "../lib/utils";
import type { EventMaterialUsed, Material } from "../types";

const DAY_SERIES_COLORS = [
  "#a855e0",
  "#22d3ee",
  "#f472b6",
  "#a3e635",
  "#fb923c",
  "#818cf8",
];

export function EventDashboardPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { data, logout, updateEvent, deleteEvent } = useStore();
  const event = data.events.find((e) => e.id === eventId);
  const [editing, setEditing] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [editingUsedId, setEditingUsedId] = useState<string | null>(null);
  const [addingUsed, setAddingUsed] = useState(false);
  const [salesProductId, setSalesProductId] = useState("all");
  const [salesDay, setSalesDay] = useState("all");
  const [draftMaterials, setDraftMaterials] = useState<EventMaterialUsed[]>([]);
  const materialsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [place, setPlace] = useState("");
  const [cost, setCost] = useState("");

  const resolvedProducts = useMemo(
    () => resolveAllProducts(data.products, data.recipes, data.sizes),
    [data.products, data.recipes, data.sizes],
  );

  useEffect(() => {
    if (!event) return;
    setName(event.name);
    setDate(event.date);
    setEndDate(event.endDate || event.date);
    setPlace(event.place);
    setCost(String(event.cost));
    setSalesDay("all");
    setSalesProductId("all");
  }, [event]);

  useEffect(() => {
    if (!showMaterials || !event) return;
    setDraftMaterials(event.materialsUsed || []);
    setEditingUsedId(null);
    setAddingUsed(false);
  }, [showMaterials, event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (materialsSaveTimer.current) clearTimeout(materialsSaveTimer.current);
    };
  }, []);

  const kpis = useMemo(
    () => (eventId ? eventKPIs(data, eventId) : null),
    [data, eventId],
  );

  const eventDayList = useMemo(
    () => (event ? eventDays(event) : []),
    [event],
  );
  const multiDay = eventDayList.length > 1;
  const salesProductFilter =
    salesProductId === "all" ? undefined : salesProductId;

  const daySeriesMeta = useMemo(
    () =>
      eventDayList.map((day, index) => ({
        day,
        key: `day_${day}`,
        label: formatDate(day),
        color: DAY_SERIES_COLORS[index % DAY_SERIES_COLORS.length],
      })),
    [eventDayList],
  );

  /** Un gráfico: horas en X, una serie por día. */
  const multiDayHourlySeries = useMemo(() => {
    if (!kpis || !multiDay) return [];
    const byHour: Record<string, Record<string, number>> = {};
    for (const meta of daySeriesMeta) {
      const hours = buildSalesSeries(
        kpis.completedOrders,
        "hora",
        salesProductFilter,
        meta.day,
      );
      for (const point of hours) {
        if (!byHour[point.label]) byHour[point.label] = {};
        byHour[point.label][meta.key] = point.total;
      }
    }
    return Object.keys(byHour)
      .sort((a, b) => a.localeCompare(b))
      .map((hour) => {
        const row: Record<string, string | number> = { label: hour };
        for (const meta of daySeriesMeta) {
          row[meta.key] = byHour[hour][meta.key] || 0;
        }
        return row;
      });
  }, [kpis, multiDay, daySeriesMeta, salesProductFilter]);

  const singleDaySeries = useMemo(
    () =>
      kpis
        ? buildSalesSeries(
            kpis.completedOrders,
            "hora",
            salesProductFilter,
            multiDay && salesDay !== "all" ? salesDay : undefined,
          )
        : [],
    [kpis, salesProductFilter, multiDay, salesDay],
  );

  const hasSalesData = multiDay
    ? multiDayHourlySeries.some((row) =>
        daySeriesMeta.some((meta) => Number(row[meta.key] || 0) > 0),
      )
    : singleDaySeries.some((point) => point.total > 0);

  const materialsTotal = event
    ? eventMaterialsCost({
        ...event,
        materialsUsed: showMaterials ? draftMaterials : event.materialsUsed,
      })
    : 0;

  const sortedDraftMaterials = useMemo(
    () =>
      [...draftMaterials].sort((a, b) => {
        const totalA = (Number(a.quantity) || 0) * (Number(a.unitPrice) || 0);
        const totalB = (Number(b.quantity) || 0) * (Number(b.unitPrice) || 0);
        return totalB - totalA;
      }),
    [draftMaterials],
  );

  if (!event || !kpis) return <Navigate to="/" replace />;

  function flushMaterials(next: EventMaterialUsed[]) {
    if (!event) return;
    if (materialsSaveTimer.current) clearTimeout(materialsSaveTimer.current);
    materialsSaveTimer.current = setTimeout(() => {
      updateEvent(event.id, { materialsUsed: next });
    }, 450);
  }

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

  function closeMaterialsScreen() {
    setShowMaterials(false);
    setEditingUsedId(null);
    setAddingUsed(false);
  }

  function openAddMaterial() {
    setEditingUsedId(null);
    setAddingUsed(true);
  }

  function openEditMaterial(id: string) {
    setAddingUsed(false);
    setEditingUsedId(id);
  }

  function closeMaterialEditor() {
    setEditingUsedId(null);
    setAddingUsed(false);
  }

  function saveMaterialUsed(row: EventMaterialUsed, isNew: boolean) {
    const next = isNew
      ? [...draftMaterials, row]
      : draftMaterials.map((m) => (m.id === row.id ? row : m));
    setDraftMaterials(next);
    flushMaterials(next);
    closeMaterialEditor();
  }

  function removeMaterialRow(id: string) {
    const next = draftMaterials.filter((m) => m.id !== id);
    setDraftMaterials(next);
    flushMaterials(next);
    closeMaterialEditor();
  }

  const editingMaterial =
    editingUsedId != null
      ? draftMaterials.find((m) => m.id === editingUsedId) || null
      : null;

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
              {kpis.bowlsSold} bowls · {kpis.drinksSold} bebidas
            </div>
          </button>
          <div className="kpi">
            <div className="kpi-label">Total ingresado</div>
            <div className="kpi-value">
              <Money value={kpis.revenue} />
            </div>
            <div className="kpi-hint">
              Total sin IVA {formatEUR(kpis.base)}
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
                <h2>
                  {multiDay ? "Ventas por hora" : "Ventas durante el día"}
                </h2>
                <p className="panel-subtitle">
                  {multiDay
                    ? "Evolución horaria de cada día del evento"
                    : "Ingresos agrupados por hora"}
                </p>
              </div>
              <select
                className="chart-product-filter"
                aria-label="Filtrar ventas por producto"
                value={salesProductId}
                onChange={(e) => setSalesProductId(e.target.value)}
              >
                <option value="all">Todos los productos</option>
                {resolvedProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.size ? ` · ${product.size} ml` : ""}
                  </option>
                ))}
              </select>
            </div>

            {!hasSalesData ? (
              <div className="empty">
                <strong>Sin datos aún</strong>
                Las ventas aparecerán cuando registres pedidos.
              </div>
            ) : multiDay ? (
              <>
                <div className="sales-chart-mobile">
                  <div className="chart-filters" role="tablist" aria-label="Día">
                    <button
                      type="button"
                      className={`nav-pill${salesDay === "all" ? " active" : ""}`}
                      onClick={() => setSalesDay("all")}
                    >
                      Todos los días
                    </button>
                    {eventDayList.map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={`nav-pill${salesDay === day ? " active" : ""}`}
                        onClick={() => setSalesDay(day)}
                      >
                        {formatDate(day)}
                      </button>
                    ))}
                  </div>
                  {salesDay === "all" ? (
                    <SalesMultiDayHourlyChart
                      data={multiDayHourlySeries}
                      series={daySeriesMeta}
                    />
                  ) : (
                    <SalesBarChart data={singleDaySeries} />
                  )}
                </div>
                <div className="sales-chart-desktop">
                  <SalesMultiDayHourlyChart
                    data={multiDayHourlySeries}
                    series={daySeriesMeta}
                  />
                </div>
              </>
            ) : (
              <SalesBarChart data={singleDaySeries} />
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
                  <div
                    className="top-product-row"
                    key={`${product.id}-${product.size || 0}-${index}`}
                  >
                    <span className="top-product-position">{index + 1}</span>
                    <span className="top-product-name">
                      {product.name}
                      {product.size ? (
                        <span className="top-product-size">
                          {product.size} ml
                        </span>
                      ) : null}
                    </span>
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
          subtitle={event.name}
          onClose={closeMaterialsScreen}
          cover
          className="materials-cover-modal"
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={openAddMaterial}
            >
              <Plus size={16} /> Añadir
            </button>
          }
        >
          <div className="materials-screen">
            <div className="materials-screen-summary">
              <span className="materials-screen-summary-label">
                Total registrado
              </span>
              <strong className="materials-screen-summary-value">
                {formatEUR(materialsTotal)}
              </strong>
            </div>

            {draftMaterials.length === 0 ? (
              <div className="empty">
                <strong>Sin consumo registrado</strong>
                Añade ingredientes del catálogo y ajusta cantidad y precio.
              </div>
            ) : (
              <div className="materials-used-list">
                {sortedDraftMaterials.map((m) => {
                  const total = round2(
                    (Number(m.quantity) || 0) * (Number(m.unitPrice) || 0),
                  );
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="materials-used-row"
                      onClick={() => openEditMaterial(m.id)}
                    >
                      <span>
                        <span className="materials-used-name">{m.name}</span>
                        <span className="materials-used-meta">
                          {m.quantity} {m.unit || "ud"} ·{" "}
                          {formatEUR(m.unitPrice)}/{m.unit || "ud"}
                        </span>
                      </span>
                      <span>
                        <span className="materials-used-total">
                          {formatEUR(total)}
                        </span>
                        <span className="materials-used-edit-hint">
                          Editar
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {(addingUsed || editingMaterial) && (
        <MaterialUsedEditor
          initial={editingMaterial}
          catalog={data.materials}
          onClose={closeMaterialEditor}
          onSave={saveMaterialUsed}
          onDelete={
            editingMaterial
              ? () => removeMaterialRow(editingMaterial.id)
              : undefined
          }
        />
      )}
    </div>
  );
}

function MaterialUsedEditor({
  initial,
  catalog,
  onClose,
  onSave,
  onDelete,
}: {
  initial: EventMaterialUsed | null;
  catalog: Material[];
  onClose: () => void;
  onSave: (row: EventMaterialUsed, isNew: boolean) => void;
  onDelete?: () => void;
}) {
  const isNew = !initial;
  const [catalogId, setCatalogId] = useState(initial?.materialId || "");
  const [name, setName] = useState(initial?.name || "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? "1"));
  const [unit, setUnit] = useState(initial?.unit || "kg");
  const [unitPrice, setUnitPrice] = useState(
    String(initial?.unitPrice ?? ""),
  );

  const lineTotal = round2(
    (Number(quantity) || 0) * (Number(unitPrice) || 0),
  );

  function applyCatalog(materialId: string) {
    setCatalogId(materialId);
    const mat = catalog.find((m) => m.id === materialId);
    if (!mat) return;
    setName(mat.name);
    setUnit(mat.unit || "kg");
    setUnitPrice(String(mat.price));
    if (!quantity) setQuantity("1");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(
      {
        id: initial?.id || uid("emu"),
        materialId: catalogId || initial?.materialId,
        name: trimmed,
        quantity: Number(quantity) || 0,
        unit: unit.trim() || "ud",
        unitPrice: Number(unitPrice) || 0,
      },
      isNew,
    );
  }

  return (
    <Modal
      title={isNew ? "Añadir materia prima" : "Editar materia prima"}
      subtitle={`Total línea · ${formatEUR(lineTotal)}`}
      onClose={onClose}
      footer={
        <div className="modal-actions modal-actions-spread">
          {onDelete ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (confirm(`¿Eliminar “${initial?.name || "este ítem"}”?`)) {
                  onDelete();
                }
              }}
            >
              <Trash2 size={16} /> Eliminar
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
          )}
          <button
            type="submit"
            form="material-used-form"
            className="btn btn-primary"
            disabled={!name.trim()}
          >
            Guardar
          </button>
        </div>
      }
    >
      <form id="material-used-form" onSubmit={handleSubmit}>
        {isNew && (
          <div className="field">
            <label>Del catálogo</label>
            <select
              value={catalogId}
              onChange={(e) => {
                if (e.target.value) applyCatalog(e.target.value);
              }}
            >
              <option value="">Selecciona un ingrediente…</option>
              {catalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({formatEUR(m.price)}/{m.unit || "ud"})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label>Ingrediente</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            required
          />
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label>Cantidad</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Unidad</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg"
            />
          </div>
        </div>

        <div className="field">
          <label>Precio / ud. (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}

function SalesBarChart({
  data,
}: {
  data: Array<{ label: string; total: number; count: number }>;
}) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(201,168,232,0.12)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#c4a8de"
            tick={{ fill: "#c4a8de", fontSize: 12 }}
          />
          <YAxis stroke="#c4a8de" tick={{ fill: "#c4a8de", fontSize: 12 }} />
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
  );
}

function SalesMultiDayHourlyChart({
  data,
  series,
}: {
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; label: string; color: string }>;
}) {
  return (
    <div className="chart-box chart-box-tall">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(201,168,232,0.12)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#c4a8de"
            tick={{ fill: "#c4a8de", fontSize: 12 }}
          />
          <YAxis stroke="#c4a8de" tick={{ fill: "#c4a8de", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "#1e1030",
              border: "1px solid rgba(201,168,232,0.2)",
              borderRadius: 12,
            }}
            formatter={(v, name) => [
              formatEUR(Number(v)),
              series.find((item) => item.key === name)?.label || String(name),
            ]}
          />
          <Legend
            formatter={(value) =>
              series.find((item) => item.key === value)?.label || String(value)
            }
            wrapperStyle={{ color: "#c4a8de", fontSize: 12 }}
          />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.key}
              fill={item.color}
              radius={[6, 6, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
