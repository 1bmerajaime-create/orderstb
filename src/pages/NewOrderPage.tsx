import { Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../components/ui';
import { useStore } from '../lib/store';
import { calcDiscount, calcSubtotal, formatEUR, round2, uid } from '../lib/utils';
import type { OrderLine, PaymentMethod, Product } from '../types';

const SOLID_TOPPINGS = [
  'Granola',
  'Almendra crocanti',
  'Lotus',
  'Coco rallado',
  'Galleta',
  'Choco chips',
];
const SOFT_TOPPINGS = [
  'Crema de cacahuete',
  'Miel',
  'Caramelo',
  'Crema de pistacho',
];
const FRUITS = ['Plátano', 'Mango', 'Fresa', 'Arándanos'];
const CUSTOM_PRODUCT_ID = 'prod-custom';
const EDITABLE_INGREDIENTS = [
  ...SOLID_TOPPINGS,
  ...SOFT_TOPPINGS,
  ...FRUITS,
  'Proteína whey',
];

interface DraftBowl {
  id: string;
  productId: string;
  productName: string;
  basePrice: number;
  baseIngredients: string[];
  ingredients: string[];
  solid: string;
  soft: string;
  fruits: string[];
  extras: string[];
  whey: boolean;
}

export function NewOrderPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { data, createOrder } = useStore();
  const event = data.events.find((e) => e.id === eventId);

  const [customerName, setCustomerName] = useState('');
  const [bowls, setBowls] = useState<DraftBowl[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promotionId, setPromotionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tarjeta');

  const editingBowl = bowls.find((bowl) => bowl.id === editingId) || null;

  const lines: OrderLine[] = useMemo(
    () =>
      bowls.map((bowl) => ({
        productId: bowl.productId,
        productName: bowl.productName,
        quantity: 1,
        unitPrice: bowlPrice(bowl),
        ingredients:
          bowl.productId === CUSTOM_PRODUCT_ID
            ? customIngredients(bowl)
            : bowl.ingredients,
        customized: bowl.productId !== CUSTOM_PRODUCT_ID && isCustomized(bowl),
      })),
    [bowls],
  );

  const promo = data.promotions.find((item) => item.id === promotionId);
  const subtotal = calcSubtotal(lines);
  const discount = calcDiscount(lines, promo);
  const total = round2(Math.max(0, subtotal - discount));
  const allComplete = bowls.every(isComplete);

  if (!event) return <Navigate to="/" replace />;

  function addBowl(product: Product) {
    const bowl: DraftBowl = {
      id: uid('bowl'),
      productId: product.id,
      productName: product.name,
      basePrice: Number(product.price) || 0,
      baseIngredients: [...product.ingredients],
      ingredients: [...product.ingredients],
      solid: '',
      soft: '',
      fruits: [],
      extras: [],
      whey: false,
    };
    setBowls((current) => [...current, bowl]);
    if (product.id === CUSTOM_PRODUCT_ID) setEditingId(bowl.id);
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

  function submit() {
    if (lines.length === 0 || !allComplete) return;
    createOrder({
      eventId: event!.id,
      customerName,
      lines,
      promotionId: promotionId || undefined,
      paymentMethod,
      paid: true,
    });
    navigate(`/evento/${event!.id}/pedidos`);
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
              <label htmlFor="order-customer">
                Nombre del cliente (opcional)
              </label>
              <input
                id="order-customer"
                placeholder="Ej. Ana / Dorsal 214"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

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
                  const customized =
                    bowl.productId !== CUSTOM_PRODUCT_ID && isCustomized(bowl);
                  const complete = isComplete(bowl);
                  const ingredients =
                    bowl.productId === CUSTOM_PRODUCT_ID
                      ? customIngredients(bowl)
                      : bowl.ingredients;
                  return (
                    <article key={bowl.id} className="cart-item">
                      <span className="cart-item-index">{index + 1}</span>
                      <div className="cart-item-body">
                        <div className="cart-item-title">
                          <strong>{bowl.productName}</strong>
                          <span>{formatEUR(bowlPrice(bowl))}</span>
                        </div>
                        {customized && (
                          <span className="customized-badge">Modificado</span>
                        )}
                        {!complete && (
                          <span className="builder-status">Sin completar</span>
                        )}
                        <p>
                          {ingredients.join(' · ') || 'Elige los ingredientes'}
                        </p>
                      </div>
                      <div className="cart-item-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Modificar ${bowl.productName} ${index + 1}`}
                          title="Modificar ingredientes"
                          onClick={() => setEditingId(bowl.id)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          aria-label={`Eliminar ${bowl.productName} ${index + 1}`}
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
              <label htmlFor="order-promo">Promoción</label>
              <select
                id="order-promo"
                value={promotionId}
                onChange={(e) => setPromotionId(e.target.value)}
              >
                <option value="">Sin descuento</option>
                {data.promotions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
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
                <div className="totals-row grand">
                  <span>Total</span>
                  <span>{formatEUR(total)}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-lg cart-submit"
                disabled={lines.length === 0 || !allComplete}
                onClick={submit}
              >
                Crear pedido
              </button>
            </div>
          </aside>
        </div>
      </main>

      {editingBowl &&
        (editingBowl.productId === CUSTOM_PRODUCT_ID ? (
          <CustomBowlModal
            bowl={editingBowl}
            onChange={(patch) => updateBowl(editingBowl.id, patch)}
            onClose={() => setEditingId(null)}
          />
        ) : (
          <PresetBowlModal
            bowl={editingBowl}
            onChange={(ingredients) =>
              updateBowl(editingBowl.id, { ingredients })
            }
            onReset={() =>
              updateBowl(editingBowl.id, {
                ingredients: [...editingBowl.baseIngredients],
              })
            }
            onClose={() => setEditingId(null)}
          />
        ))}
    </div>
  );
}

function CustomBowlModal({
  bowl,
  onChange,
  onClose,
}: {
  bowl: DraftBowl;
  onChange: (patch: Partial<DraftBowl>) => void;
  onClose: () => void;
}) {
  const complete = isComplete(bowl);
  return (
    <Modal
      title={`Configurar ${bowl.productName}`}
      onClose={onClose}
      wide
      className="bowl-modal"
    >
      <div className="custom-builder-heading">
        <div>
          <strong>{formatEUR(bowlPrice(bowl))}</strong>
          <span>Esta configuración solo afecta a esta unidad.</span>
        </div>
        <span className={`builder-status${complete ? ' complete' : ''}`}>
          {complete ? 'Completo' : 'Faltan opciones'}
        </span>
      </div>

      <OptionGroup
        step="1"
        label="Elige 1 topping sólido"
        options={SOLID_TOPPINGS}
        selected={[bowl.solid]}
        onToggle={(solid) => onChange({ solid })}
      />
      <OptionGroup
        step="2"
        label="Elige 1 topping blando"
        options={SOFT_TOPPINGS}
        selected={[bowl.soft]}
        optionSuffix={(option) =>
          option === 'Crema de pistacho' ? ' +1 €' : ''
        }
        onToggle={(soft) => onChange({ soft })}
      />
      <OptionGroup
        step="3"
        label="Elige 2 frutas"
        options={FRUITS}
        selected={bowl.fruits}
        onToggle={(option) =>
          onChange({
            fruits: bowl.fruits.includes(option)
              ? bowl.fruits.filter((item) => item !== option)
              : bowl.fruits.length < 2
                ? [...bowl.fruits, option]
                : bowl.fruits,
          })
        }
      />

      <div className="custom-extras">
        <label className="check-row">
          <input
            type="checkbox"
            checked={bowl.whey}
            onChange={(event) => onChange({ whey: event.target.checked })}
          />
          Añadir proteína whey <strong>+1,50 €</strong>
        </label>
        <div>
          <span className="custom-extra-label">
            Toppings extra <strong>+1 € cada uno</strong>
          </span>
          <div className="builder-options">
            {[...SOLID_TOPPINGS, ...SOFT_TOPPINGS, ...FRUITS].map((option) => (
              <button
                key={option}
                type="button"
                className={`builder-option${bowl.extras.includes(option) ? ' active' : ''}`}
                onClick={() =>
                  onChange({
                    extras: bowl.extras.includes(option)
                      ? bowl.extras.filter((item) => item !== option)
                      : [...bowl.extras, option],
                  })
                }
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

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

function PresetBowlModal({
  bowl,
  onChange,
  onReset,
  onClose,
}: {
  bowl: DraftBowl;
  onChange: (ingredients: string[]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const customized = isCustomized(bowl);
  return (
    <Modal
      title={`Modificar ${bowl.productName}`}
      onClose={onClose}
      wide
      className="bowl-modal"
    >
      <div className="custom-builder-heading">
        <div>
          <strong>{formatEUR(bowlPrice(bowl))}</strong>
          <span>Activa o desactiva ingredientes para esta unidad.</span>
        </div>
        {customized && <span className="customized-badge">Modificado</span>}
      </div>

      <div className="builder-options">
        {EDITABLE_INGREDIENTS.map((ingredient) => (
          <button
            key={ingredient}
            type="button"
            className={`builder-option${bowl.ingredients.includes(ingredient) ? ' active' : ''}`}
            onClick={() =>
              onChange(
                bowl.ingredients.includes(ingredient)
                  ? bowl.ingredients.filter((item) => item !== ingredient)
                  : [...bowl.ingredients, ingredient],
              )
            }
          >
            {ingredient}
          </button>
        ))}
      </div>
      <p className="preset-editor-note">
        El açaí base siempre se mantiene. Estos cambios no modifican el precio.
      </p>

      <div className="modal-actions modal-actions-spread">
        {customized ? (
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Restaurar receta
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onClose}
        >
          Listo
        </button>
      </div>
    </Modal>
  );
}

function OptionGroup({
  step,
  label,
  options,
  selected,
  onToggle,
  optionSuffix,
}: {
  step: string;
  label: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  optionSuffix?: (option: string) => string;
}) {
  return (
    <div className="builder-step">
      <div className="builder-step-title">
        <span>{step}</span>
        <strong>{label}</strong>
      </div>
      <div className="builder-options">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`builder-option${selected.includes(option) ? ' active' : ''}`}
            onClick={() => onToggle(option)}
          >
            {option}
            {optionSuffix?.(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function customIngredients(bowl: DraftBowl): string[] {
  return [
    'Açaí',
    bowl.solid,
    bowl.soft,
    ...bowl.fruits,
    ...bowl.extras.map((extra) => `${extra} extra`),
    ...(bowl.whey ? ['Proteína whey'] : []),
  ].filter(Boolean);
}

function bowlPrice(bowl: DraftBowl): number {
  if (bowl.productId !== CUSTOM_PRODUCT_ID) return bowl.basePrice;
  return round2(
    bowl.basePrice +
      (bowl.soft === 'Crema de pistacho' ? 1 : 0) +
      bowl.extras.length +
      (bowl.whey ? 1.5 : 0),
  );
}

function isComplete(bowl: DraftBowl): boolean {
  return (
    bowl.productId !== CUSTOM_PRODUCT_ID ||
    (!!bowl.solid && !!bowl.soft && bowl.fruits.length === 2)
  );
}

function isCustomized(bowl: DraftBowl): boolean {
  const current = [...bowl.ingredients].sort().join('|');
  const original = [...bowl.baseIngredients].sort().join('|');
  return current !== original;
}
