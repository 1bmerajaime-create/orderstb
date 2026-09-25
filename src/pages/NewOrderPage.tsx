import { Plus, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { TicketModal } from '../components/OrderDetailModal';
import { Modal } from '../components/ui';
import {
  CUSTOM_PRODUCT_ID,
  FREE_FRUITS,
  FREE_SOFT,
  FREE_SOLID,
  FRUITS,
  PISTACHIO,
  SOLID_TOPPINGS,
  SOFT_TOPPINGS,
  WHEY_PRICE,
  bowlGrossPrice,
  bowlIngredients,
  bowlNetPrice,
  bowlSurcharges,
  isBowlComplete,
  isPaidExtra,
  lineDiscountAmount,
  parseRecipe,
  toggleInList,
  type BowlConfig,
  type LineDiscountType,
} from '../lib/bowl';
import { useStore } from '../lib/store';
import {
  calcSubtotal,
  formatEUR,
  uid,
} from '../lib/utils';
import { productImageUrl } from '../lib/productImages';
import type {
  Order,
  OrderLine,
  PaymentMethod,
  Product,
  Promotion,
} from '../types';

interface DraftBowl extends BowlConfig {
  id: string;
  productId: string;
  productName: string;
  basePrice: number;
  baseRecipe: BowlConfig;
  promotionId?: string;
  discountType: LineDiscountType;
  discountValue: number;
}

export function NewOrderPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { data, createOrder } = useStore();
  const event = data.events.find((e) => e.id === eventId);

  const [customerName, setCustomerName] = useState('');
  const [bowls, setBowls] = useState<DraftBowl[]>([]);
  const [draft, setDraft] = useState<{
    bowl: DraftBowl;
    mode: 'new' | 'edit';
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tarjeta');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [swipedBowlId, setSwipedBowlId] = useState<string | null>(null);

  const lines: OrderLine[] = useMemo(
    () =>
      bowls.map((bowl) => {
        const config: BowlConfig = {
          solids: bowl.solids,
          softs: bowl.softs,
          fruits: bowl.fruits,
          whey: bowl.whey,
        };
        const gross = bowlGrossPrice(bowl.basePrice, config);
        const discount = lineDiscountAmount(
          gross,
          bowl.discountType,
          bowl.discountValue,
        );
        const net = bowlNetPrice(
          bowl.basePrice,
          config,
          bowl.discountType,
          bowl.discountValue,
        );
        const promo = data.promotions.find((p) => p.id === bowl.promotionId);
        return {
          productId: bowl.productId,
          productName: bowl.productName,
          quantity: 1,
          unitPrice: net,
          baseUnitPrice: gross,
          lineDiscount: discount,
          promotionId: bowl.promotionId,
          promotionName: promo?.name,
          ingredients: bowlIngredients(config),
          customized:
            bowl.productId !== CUSTOM_PRODUCT_ID && isCustomized(bowl),
        };
      }),
    [bowls, data.promotions],
  );

  const bowlPromotions = useMemo(
    () =>
      data.promotions.filter(
        (promo) => promo.type === 'percent' || promo.type === 'fixed',
      ),
    [data.promotions],
  );

  const subtotal = calcSubtotal(lines);
  const total = subtotal;
  const allComplete =
    bowls.length > 0 &&
    bowls.every((bowl) =>
      isBowlComplete({
        solids: bowl.solids,
        softs: bowl.softs,
        fruits: bowl.fruits,
        whey: bowl.whey,
      }),
    );

  if (!event) return <Navigate to="/" replace />;

  function makeBowl(product: Product): DraftBowl {
    const recipe =
      product.id === CUSTOM_PRODUCT_ID
        ? { solids: [], softs: [], fruits: [], whey: false }
        : parseRecipe(product.ingredients);
    return {
      id: uid('bowl'),
      productId: product.id,
      productName: product.name,
      basePrice: Number(product.price) || 0,
      baseRecipe: {
        ...recipe,
        solids: [...recipe.solids],
        softs: [...recipe.softs],
        fruits: [...recipe.fruits],
      },
      solids: [...recipe.solids],
      softs: [...recipe.softs],
      fruits: [...recipe.fruits],
      whey: recipe.whey,
      promotionId: undefined,
      discountType: 'none',
      discountValue: 0,
    };
  }

  function startNewBowl(product: Product) {
    setDraft({ bowl: makeBowl(product), mode: 'new' });
  }

  function startEditBowl(bowl: DraftBowl) {
    setDraft({
      bowl: {
        ...bowl,
        solids: [...bowl.solids],
        softs: [...bowl.softs],
        fruits: [...bowl.fruits],
        baseRecipe: {
          ...bowl.baseRecipe,
          solids: [...bowl.baseRecipe.solids],
          softs: [...bowl.baseRecipe.softs],
          fruits: [...bowl.baseRecipe.fruits],
        },
      },
      mode: 'edit',
    });
  }

  function updateDraft(patch: Partial<DraftBowl>) {
    setDraft((current) =>
      current ? { ...current, bowl: { ...current.bowl, ...patch } } : null,
    );
  }

  function confirmDraft() {
    if (!draft) return;
    const config: BowlConfig = {
      solids: draft.bowl.solids,
      softs: draft.bowl.softs,
      fruits: draft.bowl.fruits,
      whey: draft.bowl.whey,
    };
    if (!isBowlComplete(config)) return;

    if (draft.mode === 'new') {
      setBowls((current) => [...current, draft.bowl]);
    } else {
      setBowls((current) =>
        current.map((bowl) => (bowl.id === draft.bowl.id ? draft.bowl : bowl)),
      );
    }
    setDraft(null);
  }

  function cancelDraft() {
    setDraft(null);
  }

  function removeBowl(id: string) {
    setBowls((current) => current.filter((bowl) => bowl.id !== id));
    setSwipedBowlId((current) => (current === id ? null : current));
    if (draft?.bowl.id === id) setDraft(null);
  }

  function deleteFromModal() {
    if (!draft || draft.mode !== 'edit') return;
    removeBowl(draft.bowl.id);
  }

  async function submit() {
    if (lines.length === 0 || !allComplete || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await createOrder({
        eventId: event!.id,
        customerName,
        lines,
        paymentMethod,
        paid: true,
      });
      setCreatedOrder(order);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'No se pudo crear el pedido',
      );
      setSubmitting(false);
    }
  }

  function finishAndLeave() {
    navigate(`/evento/${event!.id}`, { replace: true });
  }

  function closePage() {
    navigate(`/evento/${event!.id}`);
  }

  return (
    <div className="app-shell">
      <main className="page page-order-new">
        <div className="order-new-header">
          <div>
            <h1>Nuevo pedido</h1>
            <p>{event.name}</p>
          </div>
          <button
            type="button"
            className="icon-btn order-close-btn"
            aria-label="Cerrar"
            onClick={closePage}
          >
            <X size={20} />
          </button>
        </div>

        <div className="order-page">
          <section className="order-page-main">
            <div className="field field-compact">
              <label htmlFor="order-customer">Nombre del cliente</label>
              <input
                id="order-customer"
                placeholder="Ej. Ana / Dorsal 214"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <p className="order-modal-label">Elige tu açaí</p>
            <div className="product-picker product-picker-visual">
              {data.products.map((product) => {
                const count = bowls.filter(
                  (bowl) => bowl.productId === product.id,
                ).length;
                const unitPrice = Number(product.price) || 0;
                const image = productImageUrl(product.id, product.name);
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`picker-card${count > 0 ? ' selected' : ''}`}
                    onClick={() => startNewBowl(product)}
                  >
                    <span
                      className="picker-card-media"
                      style={{ backgroundImage: `url(${image})` }}
                      aria-hidden
                    />
                    <span className="picker-card-body">
                      <span className="picker-card-name">{product.name}</span>
                      <span className="picker-card-meta">
                        {formatEUR(unitPrice)}
                        {count > 0 && (
                          <span className="picker-chip-count">{count}</span>
                        )}
                      </span>
                    </span>
                    <Plus size={16} className="picker-card-plus" aria-hidden />
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="order-page-cart">
            <div className="cart-head">
              <h2>Pedido</h2>
              <span>{bowls.length} bowls</span>
            </div>

            {bowls.length === 0 ? (
              <div className="empty cart-empty">
                <strong>Sin bowls</strong>
                Toca un producto para añadirlo.
              </div>
            ) : (
              <div className="cart-list">
                {bowls.map((bowl, index) => {
                  const config: BowlConfig = {
                    solids: bowl.solids,
                    softs: bowl.softs,
                    fruits: bowl.fruits,
                    whey: bowl.whey,
                  };
                  const net = bowlNetPrice(
                    bowl.basePrice,
                    config,
                    bowl.discountType,
                    bowl.discountValue,
                  );
                  return (
                    <SwipeCartItem
                      key={bowl.id}
                      open={swipedBowlId === bowl.id}
                      onOpenChange={(open) =>
                        setSwipedBowlId(open ? bowl.id : null)
                      }
                      onDelete={() => removeBowl(bowl.id)}
                      onEdit={() => {
                        setSwipedBowlId(null);
                        startEditBowl(bowl);
                      }}
                    >
                      <span className="cart-item-index">{index + 1}</span>
                      <div className="cart-item-body">
                        <div className="cart-item-title">
                          <strong>{bowl.productName}</strong>
                          <span>{formatEUR(net)}</span>
                        </div>
                        {bowl.promotionId && bowl.discountValue > 0 && (
                          <span className="customized-badge">
                            {data.promotions.find(
                              (p) => p.id === bowl.promotionId,
                            )?.name || 'Dto.'}
                          </span>
                        )}
                        <p>
                          {bowlIngredients(config).slice(1).join(' · ') ||
                            'Configura el bowl'}
                        </p>
                      </div>
                      <div className="cart-item-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Eliminar ${bowl.productName}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSwipedBowlId(null);
                            removeBowl(bowl.id);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </SwipeCartItem>
                  );
                })}
              </div>
            )}

            <div className="field">
              <label>Método de pago</label>
              <div className="payment-grid">
                {(
                  [
                    ['tarjeta', 'Tarjeta'],
                    ['efectivo', 'Efectivo'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`pay-option${paymentMethod === id ? ' active' : ''}`}
                    onClick={() => setPaymentMethod(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="cart-footer">
              <div className="totals totals-inline">
                <div className="totals-row grand">
                  <span>Total</span>
                  <span>{formatEUR(total)}</span>
                </div>
              </div>
              {submitError && (
                <p className="builder-status">{submitError}</p>
              )}
              <button
                type="button"
                className="btn btn-primary btn-lg cart-submit"
                disabled={lines.length === 0 || !allComplete || submitting}
                onClick={submit}
              >
                {submitting ? 'Creando…' : 'Crear pedido'}
              </button>
            </div>
          </aside>
        </div>
      </main>

      {draft && (
        <BowlConfigModal
          bowl={draft.bowl}
          promotions={bowlPromotions}
          confirmLabel={draft.mode === 'new' ? 'Añadir al pedido' : 'Guardar'}
          canDelete={draft.mode === 'edit'}
          onChange={updateDraft}
          onConfirm={confirmDraft}
          onCancel={cancelDraft}
          onDelete={deleteFromModal}
        />
      )}

      {createdOrder && (
        <TicketModal
          order={createdOrder}
          eventName={event.name}
          askFirst
          onClose={finishAndLeave}
        />
      )}
    </div>
  );
}

function BowlConfigModal({
  bowl,
  promotions,
  onChange,
  onConfirm,
  onCancel,
  onDelete,
  confirmLabel,
  canDelete = false,
}: {
  bowl: DraftBowl;
  promotions: Promotion[];
  onChange: (patch: Partial<DraftBowl>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  confirmLabel: string;
  canDelete?: boolean;
}) {
  const config: BowlConfig = {
    solids: bowl.solids,
    softs: bowl.softs,
    fruits: bowl.fruits,
    whey: bowl.whey,
  };
  const complete = isBowlComplete(config);
  const surcharges = bowlSurcharges(config);
  const gross = bowlGrossPrice(bowl.basePrice, config);
  const discount = lineDiscountAmount(
    gross,
    bowl.discountType,
    bowl.discountValue,
  );
  const net = bowlNetPrice(
    bowl.basePrice,
    config,
    bowl.discountType,
    bowl.discountValue,
  );
  const selectedPromo = promotions.find((p) => p.id === bowl.promotionId);
  const heroImage = productImageUrl(bowl.productId, bowl.productName);

  function applyPromotion(promotionId: string) {
    if (!promotionId) {
      onChange({
        promotionId: undefined,
        discountType: 'none',
        discountValue: 0,
      });
      return;
    }
    const promo = promotions.find((item) => item.id === promotionId);
    if (!promo) return;
    onChange({
      promotionId: promo.id,
      discountType: promo.type === 'fixed' ? 'fixed' : 'percent',
      discountValue: promo.value,
    });
  }

  return (
    <Modal
      title={`Configurar ${bowl.productName}`}
      onClose={onCancel}
      wide
      fullscreen
      className="bowl-modal"
      footer={
        <div className="bowl-modal-footer">
          {canDelete && onDelete && (
            <button
              type="button"
              className="btn btn-ghost bowl-modal-delete"
              onClick={onDelete}
            >
              <Trash2 size={16} /> Eliminar bowl
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg bowl-modal-confirm"
            disabled={!complete}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div
        className="bowl-modal-hero"
        style={{ backgroundImage: `url(${heroImage})` }}
        aria-hidden
      />
      <div className="custom-builder-heading">
        <div>
          <strong>{formatEUR(net)}</strong>
          <span>
            Base {formatEUR(bowl.basePrice)}
            {surcharges.total > 0 && ` · Extras ${formatEUR(surcharges.total)}`}
            {discount > 0 && ` · Dto. −${formatEUR(discount)}`}
          </span>
        </div>
        <span className={`builder-status${complete ? ' complete' : ''}`}>
          {complete ? 'Completo' : 'Faltan opciones'}
        </span>
      </div>

      <ToppingSection
        variant="fruta"
        title="Frutas"
        hint={`Incluye ${FREE_FRUITS} gratis. Cada una extra +1 €.`}
        options={[...FRUITS]}
        selected={bowl.fruits}
        maxFree={FREE_FRUITS}
        onToggle={(option) =>
          onChange({ fruits: toggleInList(bowl.fruits, option) })
        }
      />

      <ToppingSection
        variant="duro"
        title="Toppings duros"
        hint={`Incluye ${FREE_SOLID} gratis. Cada uno extra +1 €.`}
        options={[...SOLID_TOPPINGS]}
        selected={bowl.solids}
        maxFree={FREE_SOLID}
        onToggle={(option) =>
          onChange({ solids: toggleInList(bowl.solids, option) })
        }
      />

      <ToppingSection
        variant="blando"
        title="Toppings blandos"
        hint={`Incluye ${FREE_SOFT} gratis. Extra +1 €. Pistacho +1 €.`}
        options={[...SOFT_TOPPINGS]}
        selected={bowl.softs}
        maxFree={FREE_SOFT}
        optionSuffix={(option) => (option === PISTACHIO ? ' · +1 €' : '')}
        onToggle={(option) =>
          onChange({ softs: toggleInList(bowl.softs, option) })
        }
      />

      <div className="builder-section builder-section-extra">
        <div className="builder-section-head">
          <strong>Extras</strong>
          <span>Opcional</span>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={bowl.whey}
            onChange={(event) => onChange({ whey: event.target.checked })}
          />
          Proteína whey <strong>+{formatEUR(WHEY_PRICE)}</strong>
        </label>
      </div>

      <div className="builder-section builder-section-discount">
        <div className="builder-section-head">
          <strong>Descuento</strong>
          <span>Promociones del sistema</span>
        </div>
        <div className="discount-compact">
          <select
            aria-label="Descuento"
            className="discount-promo-select"
            value={bowl.promotionId || ''}
            onChange={(e) => applyPromotion(e.target.value)}
          >
            <option value="">Sin descuento</option>
            {promotions.map((promo) => (
              <option key={promo.id} value={promo.id}>
                {promo.name}
                {promo.type === 'percent'
                  ? ` (−${promo.value}%)`
                  : ` (−${formatEUR(promo.value)})`}
              </option>
            ))}
          </select>
        </div>
        {promotions.length === 0 && (
          <p className="discount-preview muted-note">
            No hay promociones. Créalas en el panel principal.
          </p>
        )}
        {discount > 0 && selectedPromo && (
          <p className="discount-preview">
            {selectedPromo.name}: −{formatEUR(discount)}
          </p>
        )}
      </div>

      {bowl.productId !== CUSTOM_PRODUCT_ID && (
        <button
          type="button"
          className="btn btn-ghost btn-sm restore-recipe-btn"
          onClick={() =>
            onChange({
              solids: [...bowl.baseRecipe.solids],
              softs: [...bowl.baseRecipe.softs],
              fruits: [...bowl.baseRecipe.fruits],
              whey: bowl.baseRecipe.whey,
            })
          }
        >
          Restaurar receta
        </button>
      )}
    </Modal>
  );
}

function ToppingSection({
  variant,
  title,
  hint,
  options,
  selected,
  maxFree,
  onToggle,
  optionSuffix,
}: {
  variant: 'duro' | 'blando' | 'fruta';
  title: string;
  hint: string;
  options: string[];
  selected: string[];
  maxFree: number;
  onToggle: (option: string) => void;
  optionSuffix?: (option: string) => string;
}) {
  const freeUsed = Math.min(selected.length, maxFree);
  const extras = Math.max(0, selected.length - maxFree);
  return (
    <div className={`builder-section builder-section-${variant}`}>
      <div className="builder-section-head">
        <div>
          <strong>{title}</strong>
          <span>{hint}</span>
        </div>
        <span className="builder-section-count">
          {freeUsed}/{maxFree}
          {extras > 0 ? ` · +${extras} extra` : ''}
        </span>
      </div>
      <div className="builder-options">
        {options.map((option) => {
          const active = selected.includes(option);
          const paid = active && isPaidExtra(selected, option, maxFree);
          return (
            <button
              key={option}
              type="button"
              className={`builder-option${active ? ' active' : ''}${paid ? ' paid-extra' : ''}`}
              onClick={() => onToggle(option)}
            >
              {option}
              {optionSuffix?.(option)}
              {paid ? ' · +1 €' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SWIPE_DELETE_WIDTH = 72;

function SwipeCartItem({
  children,
  open,
  onOpenChange,
  onDelete,
  onEdit,
}: {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);
  const [offset, setOffset] = useState(0);
  const [draggingNow, setDraggingNow] = useState(false);

  const revealed = open ? -SWIPE_DELETE_WIDTH : 0;
  const translateX = draggingNow ? offset : revealed;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    // Ignore presses on action buttons (delete)
    if ((event.target as HTMLElement).closest('button')) return;
    startX.current = event.clientX;
    startY.current = event.clientY;
    dragging.current = true;
    moved.current = false;
    setDraggingNow(true);
    setOffset(revealed);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved.current = true;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
      // scroll vertical: cancel swipe
      dragging.current = false;
      setDraggingNow(false);
      setOffset(0);
      onOpenChange(false);
      return;
    }
    const next = Math.min(0, Math.max(-SWIPE_DELETE_WIDTH, revealed + dx));
    setOffset(next);
  }

  function endPointer() {
    if (!dragging.current && !draggingNow) return;
    dragging.current = false;
    setDraggingNow(false);
    const shouldOpen = offset <= -SWIPE_DELETE_WIDTH / 2;
    const wasTap = !moved.current && Math.abs(offset - revealed) < 8;

    if (wasTap) {
      if (open) {
        onOpenChange(false);
      } else {
        onEdit();
      }
      setOffset(0);
      return;
    }

    onOpenChange(shouldOpen);
    setOffset(0);
  }

  return (
    <div className={`cart-swipe${open ? ' open' : ''}`}>
      <button
        type="button"
        className="cart-swipe-delete"
        aria-label="Eliminar bowl"
        onClick={onDelete}
      >
        <Trash2 size={18} />
      </button>
      <div
        className="cart-item cart-swipe-front cart-item-clickable"
        style={{ transform: `translateX(${translateX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        role="button"
        tabIndex={0}
        aria-label="Editar bowl"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEdit();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

function isCustomized(bowl: DraftBowl): boolean {
  const current = bowlIngredients({
    solids: bowl.solids,
    softs: bowl.softs,
    fruits: bowl.fruits,
    whey: bowl.whey,
  })
    .slice(1)
    .sort()
    .join('|');
  const original = bowlIngredients(bowl.baseRecipe).slice(1).sort().join('|');
  return current !== original;
}
