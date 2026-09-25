import {
  ChevronLeft,
  ChevronRight,
  List,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Modal, Money, Topbar } from "../components/ui";
import { useStore } from "../lib/store";
import {
  eventsOnDate,
  eventKPIs,
  formatDateRange,
  formatEUR,
  globalKPIs,
  IVA_RATE,
  toLocalISO,
} from "../lib/utils";
import {
  DEFAULT_BOWL_SIZE,
  resolveAllProducts,
} from "../lib/productSizes";
import { FRUITS, SOFT_TOPPINGS } from "../lib/bowl";
import type {
  BowlSize,
  DiscountType,
  Event,
  Material,
  MaterialKind,
  Product,
  ProductRecipe,
  Promotion,
} from "../types";
import { Link, useNavigate } from "react-router-dom";

type Tab = "eventos" | "productos" | "materia" | "promos";
type EventView = "lista" | "calendario";
type EventModalState =
  | { mode: "edit"; event: Event }
  | { mode: "new"; date?: string; endDate?: string }
  | null;
type CatalogModal =
  | { type: "recipes-list" }
  | { type: "sizes-list" }
  | { type: "recipe"; initial: ProductRecipe | null; fromList?: boolean }
  | { type: "size"; initial: BowlSize | null; fromList?: boolean }
  | { type: "line"; initial: Product | null }
  | null;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function HomePage() {
  const navigate = useNavigate();
  const {
    data,
    logout,
    addEvent,
    updateEvent,
    deleteEvent,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    addSize,
    updateSize,
    deleteSize,
    addProduct,
    updateProduct,
    deleteProduct,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addPromotion,
    updatePromotion,
    deletePromotion,
  } = useStore();

  const [tab, setTab] = useState<Tab>("eventos");
  const [eventView, setEventView] = useState<EventView>("calendario");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [eventModal, setEventModal] = useState<EventModalState>(null);
  const [catalogModal, setCatalogModal] = useState<CatalogModal>(null);
  const [materialModal, setMaterialModal] = useState<Material | "new" | null>(
    null,
  );
  const [promoModal, setPromoModal] = useState<Promotion | "new" | null>(null);
  const [showGanadoBreakdown, setShowGanadoBreakdown] = useState(false);
  const [showPedidosBreakdown, setShowPedidosBreakdown] = useState(false);

  const resolvedProducts = useMemo(
    () => resolveAllProducts(data.products, data.recipes, data.sizes),
    [data.products, data.recipes, data.sizes],
  );

  const sortedEvents = useMemo(
    () =>
      [...data.events].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [data.events],
  );

  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ date: null, key: `pad-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      cells.push({ date, key: toLocalISO(date) });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, key: `trail-${cells.length}` });
    }
    return cells;
  }, [calMonth]);

  const monthLabel = calMonth.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const todayIso = toLocalISO(new Date());

  const homeKpis = useMemo(() => globalKPIs(data), [data]);

  return (
    <div className="app-shell">
      <Topbar
        right={
          <>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              <LogOut size={16} /> Salir
            </button>
          </>
        }
      />

      <main className="page">
        <div className="page-header">
          <h1>Inicio</h1>
          <p>
            Planifica eventos, gestiona el catálogo de bowls y controla
            promociones desde un único lugar.
          </p>
        </div>

        <div
          className="grid grid-4 stagger"
          style={{ marginBottom: "1.25rem" }}
        >
          <button
            type="button"
            className="kpi kpi-clickable"
            onClick={() => {
              setTab("eventos");
              setEventView("lista");
              requestAnimationFrame(() => {
                document
                  .getElementById("seccion-eventos")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
          >
            <div className="kpi-label">Eventos</div>
            <div className="kpi-value">{homeKpis.totalEvents}</div>
            <div className="kpi-hint">Toca para ver el listado</div>
          </button>
          <button
            type="button"
            className="kpi kpi-clickable"
            onClick={() => setShowPedidosBreakdown(true)}
          >
            <div className="kpi-label">Pedidos totales</div>
            <div className="kpi-value">{homeKpis.totalOrders}</div>
          </button>
          <button
            type="button"
            className="kpi kpi-clickable"
            onClick={() => setShowGanadoBreakdown(true)}
          >
            <div className="kpi-label">Beneficio total</div>
            <div className="kpi-value">
              <Money value={homeKpis.totalGanado} />
            </div>
          </button>
          {homeKpis.nextEvent ? (
            <Link
              to={`/evento/${homeKpis.nextEvent.id}`}
              className="kpi kpi-clickable"
            >
              <div className="kpi-label">Próximo evento</div>
              <div className="kpi-value kpi-value-sm">
                {homeKpis.nextEvent.name || "Sin nombre"}
              </div>
              <div className="kpi-hint">
                {formatDateRange(
                  homeKpis.nextEvent.date,
                  homeKpis.nextEvent.endDate,
                )}{" "}
                · {homeKpis.nextEvent.place || "Sin lugar"}
              </div>
            </Link>
          ) : (
            <div className="kpi">
              <div className="kpi-label">Próximo evento</div>
              <div className="kpi-value kpi-value-sm">—</div>
              <div className="kpi-hint">Sin eventos</div>
            </div>
          )}
        </div>

        <div className="nav-pills">
          {(
            [
              ["eventos", "Eventos"],
              ["productos", "Catálogo"],
              ["materia", "Materia prima"],
              ["promos", "Promociones"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`nav-pill${tab === id ? " active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "eventos" && (
          <section className="panel" id="seccion-eventos">
            <div className="panel-header">
              <h2>Eventos</h2>
              <div className="event-row-actions">
                <div className="view-toggle">
                  <button
                    className={`view-toggle-btn${eventView === "lista" ? " active" : ""}`}
                    onClick={() => setEventView("lista")}
                    type="button"
                  >
                    <List size={15} /> Lista
                  </button>
                  <button
                    className={`view-toggle-btn${eventView === "calendario" ? " active" : ""}`}
                    onClick={() => setEventView("calendario")}
                    type="button"
                  >
                    <CalendarDays size={15} /> Calendario
                  </button>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setEventModal({ mode: "new" })}
                >
                  <Plus size={16} /> Nuevo evento
                </button>
              </div>
            </div>

            {sortedEvents.length === 0 && eventView === "lista" ? (
              <div className="empty">
                <strong>Sin eventos</strong>
                Crea tu primer evento para empezar a tomar pedidos.
              </div>
            ) : eventView === "lista" ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Fechas</th>
                      <th>Lugar</th>
                      <th>Beneficio total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEvents.map((e) => (
                      <tr
                        key={e.id}
                        className="row-clickable"
                        onClick={() => navigate(`/evento/${e.id}`)}
                      >
                        <td>
                          <strong>{e.name}</strong>
                        </td>
                        <td>{formatDateRange(e.date, e.endDate)}</td>
                        <td>{e.place}</td>
                        <td>
                          <Money value={eventKPIs(data, e.id).reserva} />
                        </td>
                        <td>
                          <div
                            className="event-row-actions"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                setEventModal({ mode: "edit", event: e })
                              }
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                if (confirm(`¿Eliminar el evento “${e.name}”?`))
                                  deleteEvent(e.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="calendar">
                <div className="calendar-toolbar">
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label="Mes anterior"
                    onClick={() =>
                      setCalMonth(
                        new Date(
                          calMonth.getFullYear(),
                          calMonth.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="calendar-toolbar-center">
                    <strong className="calendar-month">{monthLabel}</strong>
                  </div>
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label="Mes siguiente"
                    onClick={() =>
                      setCalMonth(
                        new Date(
                          calMonth.getFullYear(),
                          calMonth.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="calendar-weekdays">
                  {WEEKDAYS.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="calendar-grid">
                  {calendarDays.map((cell) => {
                    if (!cell.date) {
                      return (
                        <div
                          key={cell.key}
                          className="calendar-cell empty-cell"
                        />
                      );
                    }
                    const iso = toLocalISO(cell.date);
                    const dayEvents = eventsOnDate(data.events, iso);
                    const isToday = iso === todayIso;
                    return (
                      <div
                        key={cell.key}
                        role="button"
                        tabIndex={0}
                        className={`calendar-cell clickable${dayEvents.length ? " has-events" : ""}${isToday ? " today" : ""}`}
                        onClick={() => {
                          if (dayEvents.length === 0) {
                            setEventModal({
                              mode: "new",
                              date: iso,
                              endDate: iso,
                            });
                          }
                        }}
                        onKeyDown={(ev) => {
                          if (
                            dayEvents.length === 0 &&
                            (ev.key === "Enter" || ev.key === " ")
                          ) {
                            ev.preventDefault();
                            setEventModal({
                              mode: "new",
                              date: iso,
                              endDate: iso,
                            });
                          }
                        }}
                      >
                        <span className="calendar-day">
                          {cell.date.getDate()}
                          {isToday && <small>Hoy</small>}
                        </span>
                        <div className="calendar-events">
                          {dayEvents.map((e) => (
                            <Link
                              key={e.id}
                              to={`/evento/${e.id}`}
                              className="calendar-event"
                              title={`${e.name} · ${e.place}`}
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              {e.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "productos" && (
          <section className="panel">
            <div className="panel-header catalog-header">
              <h2>Catálogo</h2>
              <div className="catalog-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCatalogModal({ type: "recipes-list" })}
                >
                  Productos
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCatalogModal({ type: "sizes-list" })}
                >
                  Tamaños
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    setCatalogModal({ type: "line", initial: null })
                  }
                >
                  <Plus size={16} /> Nueva línea
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Tamaño</th>
                    <th>Ingredientes</th>
                    <th>Precio</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        {p.description && (
                          <div
                            style={{
                              color: "var(--ink-soft)",
                              fontSize: "0.8rem",
                              marginTop: 4,
                            }}
                          >
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td>{p.size ? `${p.size} ml` : "—"}</td>
                      <td>
                        {p.ingredients
                          .filter((i) => !/^aça[ií]/i.test(i))
                          .join(", ") || "—"}
                      </td>
                      <td>{formatEUR(p.price)}</td>
                      <td>
                        <div className="event-row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Editar línea"
                            onClick={() => {
                              const line = data.products.find(
                                (item) => item.id === p.id,
                              );
                              if (line)
                                setCatalogModal({
                                  type: "line",
                                  initial: line,
                                });
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (
                                confirm(
                                  `¿Eliminar línea “${p.name} · ${p.size} ml”?`,
                                )
                              )
                                deleteProduct(p.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "materia" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Materia prima</h2>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setMaterialModal("new")}
              >
                <Plus size={16} /> Añadir
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Tipo</th>
                    <th>Precio compra</th>
                    <th>Unidad</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.materials.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.name}</strong>
                      </td>
                      <td>{materialKindLabel(m.kind)}</td>
                      <td>{formatEUR(m.price)}</td>
                      <td>{m.unit || "—"}</td>
                      <td>
                        <div className="event-row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setMaterialModal(m)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (confirm(`¿Eliminar “${m.name}”?`))
                                deleteMaterial(m.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "promos" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Promociones</h2>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setPromoModal("new")}
              >
                <Plus size={16} /> Nueva promo
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.promotions.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        {p.description && (
                          <div
                            style={{
                              color: "var(--ink-soft)",
                              fontSize: "0.8rem",
                            }}
                          >
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td>{promoTypeLabel(p.type)}</td>
                      <td>{promoValueLabel(p)}</td>
                      <td>
                        <div className="event-row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPromoModal(p)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (confirm(`¿Eliminar “${p.name}”?`))
                                deletePromotion(p.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {showPedidosBreakdown && (
        <Modal
          title="Desglose · Pedidos por evento"
          onClose={() => setShowPedidosBreakdown(false)}
        >
          <div className="breakdown-list">
            {homeKpis.ordersByEvent.length === 0 ? (
              <div className="empty" style={{ padding: "1rem 0" }}>
                <strong>Sin eventos</strong>
                Aún no hay pedidos que desglosar.
              </div>
            ) : (
              homeKpis.ordersByEvent.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="breakdown-row breakdown-row-click"
                  onClick={() => {
                    setShowPedidosBreakdown(false);
                    navigate(`/evento/${row.id}`);
                  }}
                >
                  <span>
                    {row.name}
                    <span className="breakdown-sub">
                      {formatDateRange(row.date, row.endDate)}
                    </span>
                  </span>
                  <strong>{row.count}</strong>
                </button>
              ))
            )}
          </div>
          <div className="breakdown-row breakdown-total">
            <span>Total pedidos</span>
            <strong>{homeKpis.totalOrders}</strong>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowPedidosBreakdown(false)}
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}

      {showGanadoBreakdown && (
        <Modal
          title="Desglose · Beneficio total"
          onClose={() => setShowGanadoBreakdown(false)}
        >
          <div className="breakdown-list">
            <div className="breakdown-row">
              <span>Total pedidos</span>
              <strong>{homeKpis.totalOrders}</strong>
            </div>
            <div className="breakdown-row">
              <span>Dinero generado</span>
              <strong>
                <Money value={homeKpis.revenue} />
              </strong>
            </div>
            <div className="breakdown-row">
              <span>IVA {Math.round(IVA_RATE * 100)}% (incluido)</span>
              <strong className="num-negative">
                −{formatEUR(homeKpis.iva)}
              </strong>
            </div>
            <div className="breakdown-row">
              <span>Gasto eventos</span>
              <strong className="num-negative">
                −{formatEUR(homeKpis.eventCosts)}
              </strong>
            </div>
            <div className="breakdown-row">
              <span>Materia prima</span>
              <strong className="num-negative">
                −{formatEUR(homeKpis.materials)}
              </strong>
            </div>
            <div className="breakdown-row breakdown-total">
              <span>Beneficio total</span>
              <strong>
                <Money value={homeKpis.totalGanado} />
              </strong>
            </div>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowGanadoBreakdown(false)}
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}

      {eventModal && (
        <EventFormModal
          initial={eventModal.mode === "edit" ? eventModal.event : null}
          defaultDate={eventModal.mode === "new" ? eventModal.date : undefined}
          defaultEndDate={
            eventModal.mode === "new" ? eventModal.endDate : undefined
          }
          onClose={() => setEventModal(null)}
          onSave={(payload) => {
            if (eventModal.mode === "new") addEvent(payload);
            else updateEvent(eventModal.event.id, payload);
            setEventModal(null);
          }}
        />
      )}

      {catalogModal?.type === "recipes-list" && (
        <RecipesListModal
          recipes={[...data.recipes].sort((a, b) =>
            a.name.localeCompare(b.name, "es"),
          )}
          onClose={() => setCatalogModal(null)}
          onAdd={() =>
            setCatalogModal({
              type: "recipe",
              initial: null,
              fromList: true,
            })
          }
          onEdit={(recipe) =>
            setCatalogModal({
              type: "recipe",
              initial: recipe,
              fromList: true,
            })
          }
          onDelete={async (recipe) => {
            if (
              confirm(`¿Eliminar producto “${recipe.name}” y sus líneas?`)
            ) {
              await deleteRecipe(recipe.id);
            }
          }}
        />
      )}

      {catalogModal?.type === "sizes-list" && (
        <SizesListModal
          sizes={[...data.sizes].sort((a, b) => a.ml - b.ml)}
          onClose={() => setCatalogModal(null)}
          onAdd={() =>
            setCatalogModal({ type: "size", initial: null, fromList: true })
          }
          onEdit={(size) =>
            setCatalogModal({ type: "size", initial: size, fromList: true })
          }
          onDelete={async (size) => {
            if (
              confirm(
                `¿Eliminar tamaño ${size.ml} ml y sus líneas?`,
              )
            ) {
              await deleteSize(size.id);
            }
          }}
        />
      )}

      {catalogModal?.type === "recipe" && (
        <RecipeFormModal
          initial={catalogModal.initial}
          materials={data.materials}
          onClose={() =>
            setCatalogModal(
              catalogModal.fromList ? { type: "recipes-list" } : null,
            )
          }
          onSave={async (payload) => {
            if (catalogModal.initial) {
              await updateRecipe(catalogModal.initial.id, payload);
            } else {
              await addRecipe(payload);
            }
            setCatalogModal(
              catalogModal.fromList ? { type: "recipes-list" } : null,
            );
          }}
          onDelete={
            catalogModal.initial
              ? async () => {
                  if (
                    confirm(
                      `¿Eliminar producto “${catalogModal.initial!.name}” y sus líneas?`,
                    )
                  ) {
                    await deleteRecipe(catalogModal.initial!.id);
                    setCatalogModal(
                      catalogModal.fromList
                        ? { type: "recipes-list" }
                        : null,
                    );
                  }
                }
              : undefined
          }
        />
      )}

      {catalogModal?.type === "size" && (
        <SizeFormModal
          initial={catalogModal.initial}
          onClose={() =>
            setCatalogModal(
              catalogModal.fromList ? { type: "sizes-list" } : null,
            )
          }
          onSave={async (payload) => {
            if (catalogModal.initial) {
              await updateSize(catalogModal.initial.id, payload);
            } else {
              await addSize(payload);
            }
            setCatalogModal(
              catalogModal.fromList ? { type: "sizes-list" } : null,
            );
          }}
          onDelete={
            catalogModal.initial
              ? async () => {
                  if (
                    confirm(
                      `¿Eliminar tamaño ${catalogModal.initial!.ml} ml y sus líneas?`,
                    )
                  ) {
                    await deleteSize(catalogModal.initial!.id);
                    setCatalogModal(
                      catalogModal.fromList ? { type: "sizes-list" } : null,
                    );
                  }
                }
              : undefined
          }
        />
      )}

      {catalogModal?.type === "line" && (
        <LineFormModal
          initial={catalogModal.initial}
          recipes={data.recipes}
          sizes={data.sizes}
          products={data.products}
          onClose={() => setCatalogModal(null)}
          onEditRecipe={(recipe) =>
            setCatalogModal({
              type: "recipe",
              initial: recipe,
              fromList: false,
            })
          }
          onEditSize={(size) =>
            setCatalogModal({ type: "size", initial: size, fromList: false })
          }
          onSave={async (payload) => {
            if (catalogModal.initial) {
              await updateProduct(catalogModal.initial.id, payload);
            } else {
              await addProduct(payload);
            }
            setCatalogModal(null);
          }}
        />
      )}

      {materialModal && (
        <MaterialFormModal
          initial={materialModal === "new" ? null : materialModal}
          onClose={() => setMaterialModal(null)}
          onSave={(payload) => {
            if (materialModal === "new") addMaterial(payload);
            else updateMaterial(materialModal.id, payload);
            setMaterialModal(null);
          }}
        />
      )}

      {promoModal && (
        <PromoFormModal
          initial={promoModal === "new" ? null : promoModal}
          onClose={() => setPromoModal(null)}
          onSave={(payload) => {
            if (promoModal === "new") addPromotion(payload);
            else updatePromotion(promoModal.id, payload);
            setPromoModal(null);
          }}
        />
      )}
    </div>
  );
}

function materialKindLabel(kind: MaterialKind | undefined | string) {
  switch (kind) {
    case "fruta":
      return "Fruta";
    case "topping_duro":
      return "Topping duro";
    case "topping_blando":
      return "Topping blando";
    case "topping":
      return "Topping";
    default:
      return "Otro";
  }
}

function promoTypeLabel(type: DiscountType) {
  switch (type) {
    case "percent":
      return "%";
    case "fixed":
      return "Fijo €";
    case "second_half":
      return "2º al 50%";
    case "bogo":
      return "2x1";
    default:
      return type;
  }
}

function promoValueLabel(p: Promotion) {
  if (p.type === "percent" || p.type === "second_half") return `${p.value}%`;
  if (p.type === "fixed") return formatEUR(p.value);
  return String(p.value);
}

function EventFormModal({
  initial,
  defaultDate,
  defaultEndDate,
  onClose,
  onSave,
}: {
  initial: Event | null;
  defaultDate?: string;
  defaultEndDate?: string;
  onClose: () => void;
  onSave: (p: Omit<Event, "id" | "createdAt">) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [date, setDate] = useState(initial?.date || defaultDate || "");
  const [endDate, setEndDate] = useState(
    initial?.endDate ||
      initial?.date ||
      defaultEndDate ||
      defaultDate ||
      "",
  );
  const [place, setPlace] = useState(initial?.place || "");
  const [cost, setCost] = useState(String(initial?.cost ?? ""));

  return (
    <Modal
      title={initial ? "Editar evento" : "Nuevo evento"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const start = date;
          const end = endDate && endDate >= start ? endDate : start;
          onSave({
            name: name.trim(),
            date: start,
            endDate: end,
            place: place.trim(),
            cost: Number(cost) || 0,
            materialsUsed: initial?.materialsUsed || [],
          });
        }}
      >
        <div className="field">
          <label>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
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
          <label>Lugar</label>
          <input value={place} onChange={(e) => setPlace(e.target.value)} />
        </div>
        <div className="field">
          <label>Coste del evento (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecipesListModal({
  recipes,
  onClose,
  onAdd,
  onEdit,
  onDelete,
}: {
  recipes: ProductRecipe[];
  onClose: () => void;
  onAdd: () => void;
  onEdit: (recipe: ProductRecipe) => void;
  onDelete: (recipe: ProductRecipe) => void | Promise<void>;
}) {
  return (
    <Modal title="Productos" onClose={onClose} wide>
      {recipes.length === 0 ? (
        <p className="catalog-list-empty">Aún no hay productos.</p>
      ) : (
        <div className="catalog-list">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="catalog-list-row">
              <div>
                <strong>{recipe.name}</strong>
                <div className="catalog-list-meta">
                  {recipe.ingredients
                    .filter((item) => !/^aça[ií]$/i.test(item))
                    .join(" · ") || "Sin toppings/frutas"}
                </div>
              </div>
              <div className="catalog-list-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Editar"
                  onClick={() => onEdit(recipe)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  title="Eliminar"
                  onClick={() => onDelete(recipe)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cerrar
        </button>
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          <Plus size={16} /> Añadir producto
        </button>
      </div>
    </Modal>
  );
}

function SizesListModal({
  sizes,
  onClose,
  onAdd,
  onEdit,
  onDelete,
}: {
  sizes: BowlSize[];
  onClose: () => void;
  onAdd: () => void;
  onEdit: (size: BowlSize) => void;
  onDelete: (size: BowlSize) => void | Promise<void>;
}) {
  return (
    <Modal title="Tamaños" onClose={onClose}>
      {sizes.length === 0 ? (
        <p className="catalog-list-empty">Aún no hay tamaños.</p>
      ) : (
        <div className="catalog-list">
          {sizes.map((size) => (
            <div key={size.id} className="catalog-list-row">
              <div>
                <strong>{size.ml} ml</strong>
                <div className="catalog-list-meta">{formatEUR(size.price)}</div>
              </div>
              <div className="catalog-list-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Editar"
                  onClick={() => onEdit(size)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  title="Eliminar"
                  onClick={() => onDelete(size)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cerrar
        </button>
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          <Plus size={16} /> Añadir tamaño
        </button>
      </div>
    </Modal>
  );
}

function RecipeFormModal({
  initial,
  materials,
  onClose,
  onSave,
  onDelete,
}: {
  initial: ProductRecipe | null;
  materials: Material[];
  onClose: () => void;
  onSave: (p: Omit<ProductRecipe, "id">) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const initialPicks = (initial?.ingredients || []).filter(
    (item) => !/^aça[ií]$/i.test(item) && !/^aça[ií] base$/i.test(item),
  );
  const [selected, setSelected] = useState<string[]>(initialPicks);

  const ingredientGroups = useMemo(() => {
    const usable = materials.filter((m) => {
      const kind = m.kind as string;
      return (
        kind === "fruta" ||
        kind === "topping_duro" ||
        kind === "topping_blando" ||
        kind === "topping"
      );
    });

    const fruits = usable
      .filter(
        (m) =>
          m.kind === "fruta" ||
          (FRUITS as readonly string[]).includes(m.name),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    const soft = usable
      .filter(
        (m) =>
          (m.kind as string) === "topping_blando" ||
          (SOFT_TOPPINGS as readonly string[]).includes(m.name),
      )
      .filter((m) => !fruits.some((f) => f.id === m.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    const hard = usable
      .filter(
        (m) =>
          !fruits.some((f) => f.id === m.id) &&
          !soft.some((s) => s.id === m.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    return {
      fruits,
      hard,
      soft,
      total: fruits.length + hard.length + soft.length,
    };
  }, [materials]);

  function toggle(itemName: string) {
    setSelected((current) =>
      current.includes(itemName)
        ? current.filter((item) => item !== itemName)
        : [...current, itemName],
    );
  }

  function renderPillGroup(title: string, items: Material[]) {
    if (items.length === 0) return null;
    return (
      <div className="ingredient-group">
        <strong className="ingredient-group-title">{title}</strong>
        <div className="ingredient-pill-grid">
          {items.map((material) => {
            const active = selected.includes(material.name);
            return (
              <button
                key={material.id}
                type="button"
                className={`ingredient-pill${active ? " selected" : ""}`}
                aria-pressed={active}
                onClick={() => toggle(material.name)}
              >
                {material.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Modal
      title={initial ? "Editar producto" : "Nuevo producto"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const ingredients = ["Açaí", ...selected];
          onSave({
            name: name.trim(),
            description: description.trim(),
            ingredients,
          });
        }}
      >
        <div className="field">
          <label>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Descripción (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Ingredientes</label>
          <p className="muted-note" style={{ marginBottom: "0.65rem" }}>
            Elige de la materia prima por categoría.
          </p>
          <div className="ingredient-groups">
            {renderPillGroup("Fruta", ingredientGroups.fruits)}
            {renderPillGroup("Topping duro", ingredientGroups.hard)}
            {renderPillGroup("Topping blando", ingredientGroups.soft)}
          </div>
          {ingredientGroups.total === 0 && (
            <p className="muted-note">
              No hay materias de tipo fruta o topping. Añádelas en Materia
              prima.
            </p>
          )}
        </div>
        <div className="modal-actions">
          {onDelete && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onDelete()}
            >
              Eliminar
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!name.trim()}
          >
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SizeFormModal({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: BowlSize | null;
  onClose: () => void;
  onSave: (p: Omit<BowlSize, "id">) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const [ml, setMl] = useState(String(initial?.ml ?? DEFAULT_BOWL_SIZE));
  const [price, setPrice] = useState(
    String(initial?.price ?? (Number(initial?.ml) === 350 ? 10 : 12)),
  );

  return (
    <Modal
      title={initial ? "Editar tamaño" : "Nuevo tamaño"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const nextMl = Number(ml) || DEFAULT_BOWL_SIZE;
          onSave({
            ml: nextMl,
            price: Number(price) || 0,
          });
        }}
      >
        <div className="grid grid-2">
          <div className="field">
            <label>Tamaño (ml)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={ml}
              onChange={(e) => setMl(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Precio (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        </div>
        <p className="muted-note">
          Este precio aplica a todas las líneas y pedidos con este tamaño.
        </p>
        <div className="modal-actions">
          {onDelete && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onDelete()}
            >
              Eliminar
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LineFormModal({
  initial,
  recipes,
  sizes,
  products,
  onClose,
  onSave,
  onEditRecipe,
  onEditSize,
}: {
  initial: Product | null;
  recipes: ProductRecipe[];
  sizes: BowlSize[];
  products: Product[];
  onClose: () => void;
  onSave: (p: Omit<Product, "id">) => void | Promise<void>;
  onEditRecipe: (recipe: ProductRecipe) => void;
  onEditSize: (size: BowlSize) => void;
}) {
  const [recipeId, setRecipeId] = useState(
    initial?.recipeId || recipes[0]?.id || "",
  );
  const [sizeId, setSizeId] = useState(
    initial?.sizeId || sizes[0]?.id || "",
  );
  const [error, setError] = useState("");

  const sortedSizes = [...sizes].sort((a, b) => a.ml - b.ml);
  const selectedRecipe = recipes.find((r) => r.id === recipeId);
  const selectedSize = sizes.find((s) => s.id === sizeId);

  return (
    <Modal
      title={initial ? "Editar línea" : "Nueva línea"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!recipeId || !sizeId) {
            setError("Elige producto y tamaño.");
            return;
          }
          const duplicate = products.find(
            (p) =>
              p.recipeId === recipeId &&
              p.sizeId === sizeId &&
              p.id !== initial?.id,
          );
          if (duplicate) {
            setError("Ya existe una línea con ese producto y tamaño.");
            return;
          }
          setError("");
          onSave({ recipeId, sizeId });
        }}
      >
        <div className="field">
          <label>Producto</label>
          <div className="catalog-select-row">
            <select
              className="product-size-select"
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              required
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
            {selectedRecipe && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Editar producto"
                onClick={() => onEditRecipe(selectedRecipe)}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="field">
          <label>Tamaño</label>
          <div className="catalog-select-row">
            <select
              className="product-size-select"
              value={sizeId}
              onChange={(e) => setSizeId(e.target.value)}
              required
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {sortedSizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.ml} ml · {formatEUR(size.price)}
                </option>
              ))}
            </select>
            {selectedSize && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Editar tamaño"
                onClick={() => onEditSize(selectedSize)}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        {(recipes.length === 0 || sizes.length === 0) && (
          <p className="muted-note">
            Primero crea al menos un producto y un tamaño.
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!recipeId || !sizeId}
          >
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MaterialFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Material | null;
  onClose: () => void;
  onSave: (p: Omit<Material, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [unit, setUnit] = useState(initial?.unit || "kg");
  const [kind, setKind] = useState<MaterialKind>(() => {
    const raw = initial?.kind as string | undefined;
    if (raw === "topping") return "topping_duro";
    if (
      raw === "fruta" ||
      raw === "topping_duro" ||
      raw === "topping_blando" ||
      raw === "otro"
    ) {
      return raw;
    }
    return "otro";
  });

  return (
    <Modal
      title={initial ? "Editar materia prima" : "Nueva materia prima"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name: name.trim(),
            price: Number(price) || 0,
            unit: unit.trim() || "kg",
            kind,
          });
        }}
      >
        <div className="field">
          <label>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Tipo</label>
          <select
            className="product-size-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as MaterialKind)}
          >
            <option value="fruta">Fruta</option>
            <option value="topping_duro">Topping duro</option>
            <option value="topping_blando">Topping blando</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Precio compra (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Unidad</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PromoFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Promotion | null;
  onClose: () => void;
  onSave: (p: Omit<Promotion, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState<DiscountType>(initial?.type || "percent");
  const [value, setValue] = useState(String(initial?.value ?? "10"));
  const [description, setDescription] = useState(initial?.description || "");

  return (
    <Modal
      title={initial ? "Editar promoción" : "Nueva promoción"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name: name.trim(),
            type,
            value: Number(value) || 0,
            description: description.trim() || undefined,
          });
        }}
      >
        <div className="field">
          <label>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Tipo de descuento</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DiscountType)}
          >
            <option value="percent">Porcentaje (%)</option>
            <option value="fixed">Importe fijo (€)</option>
            <option value="second_half">Segundo bowl al 50%</option>
            <option value="bogo">2x1</option>
          </select>
        </div>
        <div className="field">
          <label>Valor</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
