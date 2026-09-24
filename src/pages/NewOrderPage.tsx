import { Mail, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
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
import { sendReceiptEmail } from '../lib/receipt';
import { useStore } from '../lib/store';
import {
  calcDiscount,
  calcSubtotal,
  formatEUR,
  ivaFromGross,
  netFromGross,
  round2,
  uid,
} from '../lib/utils';
import type { OrderLine, PaymentMethod, Product } from '../types';

interface DraftBowl extends BowlConfig {
  id: string;
  productId: string;
  productName: string;
  basePrice: number;
  baseRecipe: BowlConfig;
  discountType: LineDiscountType;
  discountValue: number;
}

export function NewOrderPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { data, createOrder } = useStore();
  const event = data.events.find((e) => e.id === eventId);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [bowls, setBowls] = useState<DraftBowl[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promotionId, setPromotionId] = useState('');
  const [orderDiscountType, setOrderDiscountType] =
    useState<LineDiscountType>('none');
  const [orderDiscountValue, setOrderDiscountValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tarjeta');
  const [submitting, setSubmitting] = useState(false);
  const [emailNote, setEmailNote] = useState('');

  const editingBowl = bowls.find((bowl) => bowl.id === editingId) || null;

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
        return {
          productId: bowl.productId,
          productName: bowl.productName,
          quantity: 1,
          unitPrice: net,
          baseUnitPrice: gross,
          lineDiscount: discount,
          ingredients: bowlIngredients(config),
          customized:
            bowl.productId !== CUSTOM_PRODUCT_ID && isCustomized(bowl),
        };
      }),
    [bowls],
  );

  const promo = data.promotions.find((item) => item.id === promotionId);
  const subtotal = calcSubtotal(lines);
  const promoDiscount = calcDiscount(lines, promo);
  const manualOrderDiscount = lineDiscountAmount(
    Math.max(0, subtotal - promoDiscount),
    orderDiscountType,
    orderDiscountValue,
  );
  const discount = round2(
    Math.min(subtotal, promoDiscount + manualOrderDiscount),
  );
  const total = round2(Math.max(0, subtotal - discount));
  const allComplete = bowls.every((bowl) =>
    isBowlComplete({
      solids: bowl.solids,
      softs: bowl.softs,
      fruits: bowl.fruits,
      whey: bowl.whey,
    }),
  );

  if (!event) return <Navigate to="/" replace />;

  function addBowl(product: Product) {
    const recipe =
      product.id === CUSTOM_PRODUCT_ID
        ? { solids: [], softs: [], fruits: [], whey: false }
        : parseRecipe(product.ingredients);
    const bowl: DraftBowl = {
      id: uid('bowl'),
      productId: product.id,
      productName: product.name,
      basePrice: Number(product.price) || 0,
      baseRecipe: { ...recipe, solids: [...recipe.solids], softs: [...recipe.softs], fruits: [...recipe.fruits] },
      solids: [...recipe.solids],
      softs: [...recipe.softs],
      fruits: [...recipe.fruits],
      whey: recipe.whey,
      discountType: 'none',
      discountValue: 0,
    };
    setBowls((current) => [...current, bowl]);
    setEditingId(bowl.id);
  }

  function updateBowl(id: string, patch: Partial<DraftBowl>) {
    setBowls((current) =>
      current.map((bowl) => (bowl.id === id ? { ...bowl, ...patch } : bowl)),
    );
  }

  function removeBowl(id: string) {
    setBowls((current) => current.filter((bowl) => bowl.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function removeOneOf(productId: string) {
    const removeIndex = [...bowls]
      .map((bowl, i) => ({ id: bowl.id, productId: bowl.productId, i }))
      .reverse()
      .find((item) => item.productId === productId)?.i;
    if (removeIndex == null) return;
    const removedId = bowls[removeIndex].id;
    if (editingId === removedId) setEditingId(null);
    setBowls((current) => current.filter((_, i) => i !== removeIndex));
  }

  async function submit() {
    if (lines.length === 0 || !allComplete || submitting) return;
    if (sendEmail && !customerEmail.trim()) {
      setEmailNote('Indica el email del cliente para abrir el ticket en Gmail.');
      return;
    }
    setSubmitting(true);
    setEmailNote('');
    try {
      const order = await createOrder({
        eventId: event!.id,
        customerName,
        customerEmail: customerEmail.trim() || undefined,
        lines,
        promotionId: promotionId || undefined,
        paymentMethod,
        paid: true,
        extraDiscount: manualOrderDiscount,
      });
      if (sendEmail && customerEmail.trim()) {
        const result = await sendReceiptEmail({
          to: customerEmail.trim(),
          order,
          eventName: event!.name,
        });
        setEmailNote(result.message);
      }
      navigate(`/evento/${event!.id}/pedidos`);
    } catch (error) {
      setEmailNote(
        error instanceof Error ? error.message : 'No se pudo crear el pedido',
      );
      setSubmitting(false);
    }
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

            <div className="field field-compact">
              <label htmlFor="order-email">Email del cliente</label>
              <input
                id="order-email"
                type="email"
                placeholder="cliente@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            <label className="check-row field-compact">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              <Mail size={15} /> Abrir ticket en Gmail al crear el pedido
            </label>

            <p className="order-modal-label">Catálogo</p>
            <div className="product-picker">
              {data.products.map((product) => {
                const count = bowls.filter(
                  (bowl) => bowl.productId === product.id,
                ).length;
                const unitPrice = Number(product.price) || 0;
                return (
                  <div
                    key={product.id}
                    className={`picker-tile${count > 0 ? ' selected' : ''}`}
                  >
                    <div className="picker-tile-info">
                      <strong>{product.name}</strong>
                      <span className="picker-price">
                        {formatEUR(unitPrice)}
                      </span>
                    </div>
                    <div className="picker-counter">
                      <button
                        type="button"
                        className="picker-step"
                        aria-label={`Quitar ${product.name}`}
                        disabled={count === 0}
                        onClick={() => removeOneOf(product.id)}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="picker-count-value">{count}</span>
                      <button
                        type="button"
                        className="picker-step"
                        aria-label={`Añadir ${product.name}`}
                        onClick={() => addBowl(product)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
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
                Añade productos desde el catálogo.
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
                  const complete = isBowlComplete(config);
                  return (
                    <article key={bowl.id} className="cart-item">
                      <span className="cart-item-index">{index + 1}</span>
                      <div className="cart-item-body">
                        <div className="cart-item-title">
                          <strong>{bowl.productName}</strong>
                          <span>{formatEUR(net)}</span>
                        </div>
                        {bowl.discountType !== 'none' &&
                          bowl.discountValue > 0 && (
                            <span className="customized-badge">Dto. línea</span>
                          )}
                        {!complete && (
                          <span className="builder-status">Sin completar</span>
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
                          aria-label={`Modificar ${bowl.productName}`}
                          onClick={() => setEditingId(bowl.id)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          aria-label={`Eliminar ${bowl.productName}`}
                          onClick={() => removeBowl(bowl.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="field">
              <label htmlFor="order-promo">Promoción (pedido)</label>
              <select
                id="order-promo"
                value={promotionId}
                onChange={(e) => setPromotionId(e.target.value)}
              >
                <option value="">Sin promoción</option>
                {data.promotions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="discount-row">
              <div className="field">
                <label htmlFor="order-discount-type">Dto. pedido</label>
                <select
                  id="order-discount-type"
                  value={orderDiscountType}
                  onChange={(e) =>
                    setOrderDiscountType(e.target.value as LineDiscountType)
                  }
                >
                  <option value="none">Ninguno</option>
                  <option value="percent">%</option>
                  <option value="fixed">€ fijo</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="order-discount-value">Valor</label>
                <input
                  id="order-discount-value"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={orderDiscountType === 'none'}
                  value={orderDiscountValue || ''}
                  onChange={(e) =>
                    setOrderDiscountValue(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>

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
                <div className="totals-row">
                  <span>Subtotal</span>
                  <span>{formatEUR(subtotal)}</span>
                </div>
                <div className="totals-row">
                  <span>Descuento</span>
                  <span>−{formatEUR(discount)}</span>
                </div>
                <div className="totals-row">
                  <span>Base (sin IVA)</span>
                  <span>{formatEUR(netFromGross(total))}</span>
                </div>
                <div className="totals-row">
                  <span>IVA 21%</span>
                  <span>{formatEUR(ivaFromGross(total))}</span>
                </div>
                <div className="totals-row grand">
                  <span>Total</span>
                  <span>{formatEUR(total)}</span>
                </div>
              </div>
              {emailNote && <p className="builder-status">{emailNote}</p>}
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

      {editingBowl && (
        <BowlConfigModal
          bowl={editingBowl}
          onChange={(patch) => updateBowl(editingBowl.id, patch)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function BowlConfigModal({
  bowl,
  onChange,
  onClose,
}: {
  bowl: DraftBowl;
  onChange: (patch: Partial<DraftBowl>) => void;
  onClose: () => void;
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

  return (
    <Modal
      title={`Configurar ${bowl.productName}`}
      onClose={onClose}
      wide
      className="bowl-modal"
    >
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
        hint={`Incluye ${FREE_SOFT} gratis. Extra +1 €. Crema de pistacho siempre +1 €.`}
        options={[...SOFT_TOPPINGS]}
        selected={bowl.softs}
        maxFree={FREE_SOFT}
        optionSuffix={(option) =>
          option === PISTACHIO ? ' · siempre +1 €' : ''
        }
        onToggle={(option) =>
          onChange({ softs: toggleInList(bowl.softs, option) })
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

      <div className="builder-section">
        <div className="builder-section-head">
          <strong>Descuento de este bowl</strong>
        </div>
        <div className="discount-row">
          <select
            value={bowl.discountType}
            onChange={(e) =>
              onChange({
                discountType: e.target.value as LineDiscountType,
                discountValue:
                  e.target.value === 'none' ? 0 : bowl.discountValue,
              })
            }
          >
            <option value="none">Sin descuento</option>
            <option value="percent">Porcentaje %</option>
            <option value="fixed">Importe € fijo</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={bowl.discountType === 'none'}
            value={bowl.discountValue || ''}
            onChange={(e) =>
              onChange({ discountValue: Number(e.target.value) || 0 })
            }
            placeholder="0"
          />
        </div>
      </div>

      {bowl.productId !== CUSTOM_PRODUCT_ID && (
        <button
          type="button"
          className="btn btn-ghost"
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

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!complete}
          onClick={onClose}
        >
          Listo
        </button>
      </div>
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
