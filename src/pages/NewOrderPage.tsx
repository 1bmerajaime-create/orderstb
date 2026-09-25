import { Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { TicketModal } from '../components/OrderDetailModal';
import { Modal } from '../components/ui';
import {
  FREE_FRUITS,
  FREE_SOFT,
  FREE_SOLID,
  FRUITS,
  PISTACHIO,
  PISTACHIO_SURCHARGE,
  SOLID_TOPPINGS,
  SOFT_TOPPINGS,
  WHEY_PRICE,
  bowlGrossPrice,
  bowlIngredients,
  bowlNetPrice,
  isBowlComplete,
  isCustomProduct,
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
import {
  DEFAULT_BOWL_SIZE,
  defaultVariant,
  groupProductsByName,
  productSizeMl,
  resolveAllProducts,
  variantForSize,
} from '../lib/productSizes';
import type {
  Order,
  OrderLine,
  PaymentMethod,
  Promotion,
  ResolvedProduct,
} from '../types';

interface DraftBowl extends BowlConfig {
  id: string;
  productId: string;
  productName: string;
  size: number;
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
            !isCustomProduct(bowl.productId) && isCustomized(bowl),
          size: bowl.size,
        };
      }),
    [bowls, data.promotions],
  );

  const resolvedProducts = useMemo(
    () => resolveAllProducts(data.products, data.recipes, data.sizes),
    [data.products, data.recipes, data.sizes],
  );

  const productGroups = useMemo(
    () => groupProductsByName(resolvedProducts),
    [resolvedProducts],
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

  function makeBowl(product: ResolvedProduct): DraftBowl {
    const recipe = isCustomProduct(product)
      ? { solids: [], softs: [], fruits: [], whey: false }
      : parseRecipe(product.ingredients);
    const size = productSizeMl(product);
    return {
      id: uid('bowl'),
      productId: product.id,
      productName: product.name,
      size,
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

  function startNewBowlFromGroup(variants: ResolvedProduct[]) {
    setDraft({ bowl: makeBowl(defaultVariant(variants)), mode: 'new' });
  }

  function startEditBowl(bowl: DraftBowl) {
    const variants = resolvedProducts.filter(
      (p) => p.name === bowl.productName,
    );
    const matched =
      variantForSize(variants, bowl.size) ||
      resolvedProducts.find((p) => p.id === bowl.productId) ||
      defaultVariant(variants.length ? variants : resolvedProducts);
    setDraft({
      bowl: {
        ...bowl,
        productId: matched.id,
        size: productSizeMl(matched),
        basePrice: Number(matched.price) || bowl.basePrice,
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
              {productGroups.map((group) => {
                const representative = defaultVariant(group.variants);
                const count = bowls.filter(
                  (bowl) => bowl.productName === group.name,
                ).length;
                const image = productImageUrl(
                  representative.id,
                  representative.name,
                );
                const isCustom = isCustomProduct(representative);
                return (
                  <button
                    key={group.name}
                    type="button"
                    className={`picker-card${count > 0 ? ' selected' : ''}${isCustom ? ' picker-card-custom' : ''}`}
                    onClick={() => startNewBowlFromGroup(group.variants)}
                  >
                    <span className="picker-card-media-frame">
                      <span
                        className={`picker-card-media${isCustom ? ' picker-card-media-blur' : ''}`}
                        style={{ backgroundImage: `url(${image})` }}
                        aria-hidden
                      />
                    </span>
                    <span className="picker-card-body">
                      <span className="picker-card-name">{group.name}</span>
                      {count > 0 && (
                        <span className="picker-card-meta">
                          <span className="picker-chip-count">{count}</span>
                        </span>
                      )}
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
                    <CartItem
                      key={bowl.id}
                      onEdit={() => startEditBowl(bowl)}
                    >
                      <span className="cart-item-index">{index + 1}</span>
                      <div className="cart-item-body">
                        <div className="cart-item-title">
                          <strong>
                            {bowl.productName}
                            <span className="cart-item-size">
                              {' '}
                              · {bowl.size} ml
                            </span>
                          </strong>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBowl(bowl.id);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </CartItem>
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
              {submitError && (
                <p className="builder-status">{submitError}</p>
              )}
              <button
                type="button"
                className="btn btn-primary btn-lg cart-submit"
                disabled={lines.length === 0 || !allComplete || submitting}
                onClick={submit}
              >
                <span className="cart-submit-label">
                  {submitting
                    ? 'Creando…'
                    : lines.length === 0 || !allComplete
                      ? 'Completa el pedido'
                      : 'Crear pedido'}
                </span>
                {lines.length > 0 && allComplete && !submitting && (
                  <span className="cart-submit-price">{formatEUR(total)}</span>
                )}
              </button>
            </div>
          </aside>
        </div>
      </main>

      {draft && (
        <BowlConfigModal
          bowl={draft.bowl}
          variants={resolvedProducts.filter(
            (p) => p.name === draft.bowl.productName,
          )}
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
  variants,
  promotions,
  onChange,
  onConfirm,
  onCancel,
  onDelete,
  confirmLabel,
  canDelete = false,
}: {
  bowl: DraftBowl;
  variants: ResolvedProduct[];
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
  const sizeVariants =
    variants.length > 0
      ? variants
      : [
          {
            id: bowl.productId,
            recipeId: '',
            sizeId: '',
            name: bowl.productName,
            description: '',
            ingredients: [],
            price: bowl.basePrice,
            size: bowl.size || DEFAULT_BOWL_SIZE,
          } satisfies ResolvedProduct,
        ];

  function setSize(variant: ResolvedProduct) {
    onChange({
      productId: variant.id,
      size: productSizeMl(variant),
      basePrice: Number(variant.price) || 0,
    });
  }

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
            aria-disabled={!complete}
          >
            <span className="bowl-modal-confirm-label">
              {complete ? confirmLabel : 'Completa el bowl'}
            </span>
            {complete && (
              <span className="bowl-modal-confirm-price">{formatEUR(net)}</span>
            )}
          </button>
        </div>
      }
    >
      <div
        className="bowl-modal-hero"
        style={{ backgroundImage: `url(${heroImage})` }}
        aria-hidden
      />

      <div className="builder-section builder-section-size">
        <div className="builder-section-head">
          <div>
            <strong>Tamaño</strong>
            <span>Elige el tamaño del bowl</span>
          </div>
        </div>
        <div className="builder-options size-options">
          {sizeVariants.map((variant) => {
            const size = productSizeMl(variant);
            const active = bowl.productId === variant.id || bowl.size === size;
            return (
              <button
                key={variant.id}
                type="button"
                className={`builder-option size-option${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => setSize(variant)}
              >
                <span className="size-option-ml">{size} ml</span>
              </button>
            );
          })}
        </div>
      </div>

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
        onToggle={(option) =>
          onChange({ softs: toggleInList(bowl.softs, option) })
        }
        optionFee={(option, paid) =>
          option === PISTACHIO ? PISTACHIO_SURCHARGE : paid ? 1 : 0
        }
      />

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

      <div className="builder-extra-discount-row">
        <div className="builder-section builder-section-extra">
          <div className="builder-section-head">
            <strong>Extras</strong>
            <span>Opcional</span>
          </div>
          <div className="builder-options">
            <button
              type="button"
              className={`builder-option builder-option-extra${bowl.whey ? ' active' : ''}`}
              aria-pressed={bowl.whey}
              onClick={() => onChange({ whey: !bowl.whey })}
            >
              <span className="builder-option-extra-text">
                <span>Proteína whey</span>
                <span className="builder-option-price">
                  +{formatEUR(WHEY_PRICE)}
                </span>
              </span>
            </button>
          </div>
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
      </div>

      {bowl.productId && !isCustomProduct(bowl.productId) && (
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
  optionFee,
}: {
  variant: 'duro' | 'blando' | 'fruta';
  title: string;
  hint: string;
  options: string[];
  selected: string[];
  maxFree: number;
  onToggle: (option: string) => void;
  /** Importe extra a mostrar (p. ej. pistacho + extra de cupo). */
  optionFee?: (option: string, paidExtra: boolean) => number;
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
          const fee =
            optionFee?.(option, paid) ?? (paid ? 1 : 0);
          const showPaidStyle = option === PISTACHIO ? false : paid;
          return (
            <button
              key={option}
              type="button"
              className={`builder-option${active ? ' active' : ''}${showPaidStyle ? ' paid-extra' : ''}`}
              onClick={() => onToggle(option)}
            >
              {option}
              {fee > 0 ? ` · +${fee} €` : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CartItem({
  children,
  onEdit,
}: {
  children: ReactNode;
  onEdit: () => void;
}) {
  return (
    <div
      className="cart-item cart-item-clickable"
      role="button"
      tabIndex={0}
      aria-label="Editar bowl"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        onEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
    >
      {children}
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
