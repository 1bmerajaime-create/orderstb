import { Check, ChefHat, History, ListFilter, Pencil, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { Modal, PageHeader, Topbar } from '../components/ui';
import {
  FRUITS,
  SOLID_TOPPINGS,
  SOFT_TOPPINGS,
  WHEY,
} from '../lib/bowl';
import { useStore } from '../lib/store';
import { resolveAllProducts, isSimpleRecipe, CANONICAL_SIZES } from '../lib/productSizes';
import { formatTime } from '../lib/utils';
import type { Order, OrderLine } from '../types';

type BoardTab = 'curso' | 'listos';

type ReadyFilters = {
  types: string[];
  products: string[];
  sizes: number[];
};

const EMPTY_FILTERS: ReadyFilters = {
  types: [],
  products: [],
  sizes: [],
};

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function lineIngredients(
  line: OrderLine,
  resolvedProducts: { id: string; name: string; ingredients: string[] }[],
): string[] {
  if (line.ingredients?.length) return line.ingredients;
  const product =
    resolvedProducts.find((item) => item.id === line.productId) ||
    resolvedProducts.find((item) => item.name === line.productName);
  return product?.ingredients || [];
}

function lineMatchesFilters(
  line: OrderLine,
  filters: ReadyFilters,
  resolvedProducts: { id: string; name: string; ingredients: string[] }[],
): boolean {
  if (filters.types.length > 0) {
    const name = line.productName.trim().toLowerCase();
    if (!filters.types.some((type) => type.trim().toLowerCase() === name)) {
      return false;
    }
  }
  if (filters.products.length > 0) {
    const ingredients = lineIngredients(line, resolvedProducts).map((item) =>
      item.trim().toLowerCase(),
    );
    if (
      !filters.products.some((product) =>
        ingredients.includes(product.trim().toLowerCase()),
      )
    ) {
      return false;
    }
  }
  if (filters.sizes.length > 0) {
    if (!line.size || !filters.sizes.includes(line.size)) return false;
  }
  return true;
}

function orderMatchesFilters(
  order: Order,
  filters: ReadyFilters,
  resolvedProducts: { id: string; name: string; ingredients: string[] }[],
): boolean {
  if (
    filters.types.length === 0 &&
    filters.products.length === 0 &&
    filters.sizes.length === 0
  ) {
    return true;
  }
  return order.lines.some((line) =>
    lineMatchesFilters(line, filters, resolvedProducts),
  );
}

function activeFilterCount(filters: ReadyFilters): number {
  return filters.types.length + filters.products.length + filters.sizes.length;
}

export function OrdersPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { data, updateOrderStatus } = useStore();
  const event = data.events.find((e) => e.id === eventId);
  const [tab, setTab] = useState<BoardTab>('curso');
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [appliedFilters, setAppliedFilters] =
    useState<ReadyFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ReadyFilters>(EMPTY_FILTERS);

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
  /** Último marcado como listo primero */
  const ready = eventOrders
    .filter((o) => o.status === 'listo')
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const acaiTypes = useMemo(() => {
    const names = new Set(
      data.recipes
        .filter((recipe) => !isSimpleRecipe(recipe))
        .map((recipe) => recipe.name),
    );
    ready.forEach((order) => {
      order.lines.forEach((line) => {
        if (names.has(line.productName)) return;
        const hasAcai = (line.ingredients || []).some((item) =>
          /a[cç]a[ií]/i.test(item),
        );
        if (hasAcai) names.add(line.productName);
      });
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }, [data.recipes, ready]);

  const ingredientOptions = useMemo(() => {
    const names = new Set<string>([
      ...SOLID_TOPPINGS,
      ...SOFT_TOPPINGS,
      ...FRUITS,
      WHEY,
    ]);
    data.materials
      .filter(
        (material) =>
          material.kind === 'fruta' ||
          material.kind === 'topping_duro' ||
          material.kind === 'topping_blando',
      )
      .forEach((material) => names.add(material.name));
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }, [data.materials]);

  const sizeOptions = useMemo(
    () => CANONICAL_SIZES.map((size) => size.ml),
    [],
  );

  const filteredReady = useMemo(
    () =>
      ready.filter((order) =>
        orderMatchesFilters(order, appliedFilters, resolvedProducts),
      ),
    [ready, appliedFilters, resolvedProducts],
  );

  const appliedCount = activeFilterCount(appliedFilters);

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
            <div className="order-num">{order.customerName}</div>
            <div className="order-meta">
              Pedido #{order.number} · {formatTime(order.createdAt)}
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
              <div className="ready-heading">
                <h2>Listos</h2>
                {ready.length > 0 && (
                  <span className="ready-count">
                    {appliedCount > 0
                      ? `${filteredReady.length} de ${ready.length} pedidos`
                      : `${ready.length} ${ready.length === 1 ? 'pedido' : 'pedidos'}`}
                  </span>
                )}
              </div>
              {ready.length > 0 && (
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm${appliedCount > 0 ? ' filter-btn-active' : ''}`}
                  onClick={() => {
                    setDraftFilters({
                      types: [...appliedFilters.types],
                      products: [...appliedFilters.products],
                      sizes: [...appliedFilters.sizes],
                    });
                    setShowFilters(true);
                  }}
                >
                  <ListFilter size={16} /> Filtros
                  {appliedCount > 0 ? ` (${appliedCount})` : ''}
                </button>
              )}
            </div>
            {ready.length === 0 ? (
              <div className="empty">
                <strong>Ningún pedido listo</strong>
                Cuando marques un pedido como listo, aparecerá aquí.
              </div>
            ) : filteredReady.length === 0 ? (
              <div className="empty">
                <strong>Ningún pedido coincide</strong>
                Prueba a quitar algún filtro o pulsa Limpiar.
              </div>
            ) : (
              <div className="grid grid-3">
                {filteredReady.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    className="ready"
                    actions={
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          navigate(
                            `/evento/${event.id}/editar-pedido/${o.id}`,
                          )
                        }
                      >
                        <Pencil size={17} /> Editar
                      </button>
                    }
                  />
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
          onSelectOrder={setDetailOrder}
        />
      )}

      {showFilters && (
        <Modal
          title="Filtros"
          subtitle="Elige tipo, producto y tamaño. Un pedido entra si alguna línea cumple todo."
          onClose={() => setShowFilters(false)}
        >
          <div className="order-filters">
            <section>
              <h3>Tipo de açaí</h3>
              <div className="order-filter-chips">
                {acaiTypes.map((type) => {
                  const active = draftFilters.types.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`builder-option${active ? ' active' : ''}`}
                      onClick={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          types: toggleValue(current.types, type),
                        }))
                      }
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <h3>Producto</h3>
              <div className="order-filter-chips">
                {ingredientOptions.map((product) => {
                  const active = draftFilters.products.includes(product);
                  return (
                    <button
                      key={product}
                      type="button"
                      className={`builder-option${active ? ' active' : ''}`}
                      onClick={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          products: toggleValue(current.products, product),
                        }))
                      }
                    >
                      {product}
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <h3>Tamaño</h3>
              <div className="order-filter-chips">
                {sizeOptions.map((size) => {
                  const active = draftFilters.sizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      className={`builder-option${active ? ' active' : ''}`}
                      onClick={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          sizes: toggleValue(current.sizes, size),
                        }))
                      }
                    >
                      {size} ml
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
          <div className="modal-actions modal-actions-spread">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDraftFilters(EMPTY_FILTERS)}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setAppliedFilters({
                  types: [...draftFilters.types],
                  products: [...draftFilters.products],
                  sizes: [...draftFilters.sizes],
                });
                setShowFilters(false);
              }}
            >
              Aplicar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
