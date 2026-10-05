import {
  CheckCircle2,
  Download,
  Mail,
  Pencil,
  Ticket,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './ui';
import { parseRecipe, WHEY } from '../lib/bowl';
import { ingredientVisual } from '../lib/ingredientVisuals';
import {
  sendReceiptEmail,
  downloadReceiptPdf,
  FROM_EMAIL,
  lineTotal,
  hasAutomaticTicketSend,
} from '../lib/receipt';
import { useStore } from '../lib/store';
import { resolveAllProducts } from '../lib/productSizes';
import {
  formatEUR,
  formatTime,
  IVA_RATE,
  ivaFromGross,
  netFromGross,
} from '../lib/utils';
import type { Order, OrderLine } from '../types';

function isInProgressStatus(status: Order['status']) {
  return status === 'pendiente' || status === 'en_preparacion';
}

function compactPrepParts(line: OrderLine): { size: string; duro: string } {
  const ingredients = line.ingredients?.length ? line.ingredients : [];
  const config = parseRecipe(ingredients);
  return {
    size: line.size ? `${line.size} ml` : line.productName,
    duro: config.solids.length > 0 ? config.solids.join(', ') : 'Sin duro',
  };
}

export function OrderDetailModal({
  order,
  onClose,
  onSelectOrder,
}: {
  order: Order;
  onClose: () => void;
  onSelectOrder?: (order: Order) => void;
}) {
  const navigate = useNavigate();
  const { data, deleteOrder, updateOrderStatus } = useStore();
  const currentOrder = data.orders.find((item) => item.id === order.id) || order;
  const event = data.events.find((item) => item.id === currentOrder.eventId);
  const [showTicket, setShowTicket] = useState(false);
  const resolvedProducts = useMemo(
    () => resolveAllProducts(data.products, data.recipes, data.sizes),
    [data.products, data.recipes, data.sizes],
  );
  const prepView = isInProgressStatus(currentOrder.status);
  const editPath = `/evento/${currentOrder.eventId}/editar-pedido/${currentOrder.id}`;

  const upcomingOrders = useMemo(() => {
    if (!prepView) return [];
    const queue = data.orders
      .filter(
        (item) =>
          item.eventId === currentOrder.eventId &&
          isInProgressStatus(item.status),
      )
      .sort((a, b) => a.number - b.number);
    const index = queue.findIndex((item) => item.id === currentOrder.id);
    if (index < 0) {
      return queue.filter((item) => item.id !== currentOrder.id).slice(0, 2);
    }
    return queue.slice(index + 1, index + 3);
  }, [prepView, data.orders, currentOrder.eventId, currentOrder.id]);

  function goEdit() {
    onClose();
    navigate(editPath);
  }

  return (
    <>
      <Modal
        title={currentOrder.customerName}
        subtitle={`Pedido #${currentOrder.number}`}
        onClose={onClose}
        wide={!prepView}
        fullscreen={prepView}
        cover={prepView}
        className={prepView ? 'order-prep-modal' : undefined}
        headerExtra={
          prepView && upcomingOrders.length > 0 ? (
            <aside className="prep-upcoming" aria-label="Próximos pedidos">
              {upcomingOrders.map((next) => (
                <button
                  key={next.id}
                  type="button"
                  className="prep-upcoming-card"
                  onClick={() => onSelectOrder?.(next)}
                  disabled={!onSelectOrder}
                >
                  <strong className="prep-upcoming-name">
                    {next.customerName}
                  </strong>
                  <ul className="prep-upcoming-bowls">
                    {next.lines.map((line, index) => {
                      const parts = compactPrepParts(line);
                      return (
                        <li key={`${line.productId}-${index}`}>
                          <span className="prep-upcoming-size">{parts.size}</span>
                          <span className="prep-upcoming-duro">{parts.duro}</span>
                        </li>
                      );
                    })}
                  </ul>
                </button>
              ))}
            </aside>
          ) : undefined
        }
        headerActions={
          <>
            <button
              type="button"
              className="icon-btn"
              aria-label="Editar pedido"
              title="Editar pedido"
              onClick={goEdit}
            >
              <Pencil size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Ticket y desglose"
              onClick={() => setShowTicket(true)}
            >
              <Ticket size={18} />
            </button>
          </>
        }
      >
        <div className={`order-detail${prepView ? ' order-detail-prep' : ''}`}>
          <div className="order-detail-summary">
            <span>{formatTime(currentOrder.createdAt)}</span>
          </div>

          <div className="order-detail-lines">
            <div className={`bowl-table${prepView ? ' bowl-table-prep' : ''}`}>
              {currentOrder.lines.map((line, index) => {
                const recipe =
                  resolvedProducts.find((p) => p.id === line.productId) ||
                  resolvedProducts.find((p) => p.name === line.productName);
                return (
                  <BowlLineRow
                    key={`${line.productId}-${index}`}
                    line={line}
                    visual={prepView}
                    fallbackIngredients={recipe?.ingredients || []}
                  />
                );
              })}
            </div>
          </div>

          <div className="modal-actions order-detail-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (
                  confirm(
                    `¿Eliminar el pedido #${currentOrder.number}? Esta acción no se puede deshacer.`,
                  )
                ) {
                  deleteOrder(currentOrder.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={16} /> Eliminar
            </button>
            {(currentOrder.status === 'listo' ||
              currentOrder.status === 'entregado') && (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={goEdit}
              >
                <Pencil size={18} /> Editar pedido
              </button>
            )}
            {currentOrder.status !== 'listo' &&
              currentOrder.status !== 'entregado' && (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    const nextOrder = upcomingOrders[0];
                    void updateOrderStatus(currentOrder.id, 'listo').then(
                      () => {
                        if (nextOrder && onSelectOrder) {
                          onSelectOrder(nextOrder);
                        } else {
                          onClose();
                        }
                      },
                    );
                  }}
                >
                  Terminado
                </button>
              )}
          </div>
        </div>
      </Modal>

      {showTicket && (
        <TicketModal
          order={currentOrder}
          eventName={event?.name}
          onClose={() => setShowTicket(false)}
        />
      )}
    </>
  );
}

function BowlLineRow({
  line,
  fallbackIngredients,
  visual = false,
}: {
  line: OrderLine;
  fallbackIngredients: string[];
  visual?: boolean;
}) {
  const ingredients = line.ingredients?.length
    ? line.ingredients
    : fallbackIngredients;
  const config = parseRecipe(ingredients);
  const base = ingredients.find((item) => /a[cç]a[ií]/i.test(item)) || 'Açaí';
  const baseValues = [base, ...(config.whey ? [WHEY] : [])];
  const isSimple =
    !ingredients.length ||
    (!/a[cç]a[ií]/i.test(ingredients.join(' ')) &&
      config.fruits.length === 0 &&
      config.solids.length === 0 &&
      config.softs.length === 0 &&
      !config.whey);

  return (
    <div className={`bowl-table-row${visual ? ' bowl-table-row-visual' : ''}`}>
      <div className="bowl-table-product">
        <strong>
          {line.quantity}× {line.productName}
          {visual && line.size ? ` · ${line.size} ml` : ''}
        </strong>
        {line.customized && (
          <span className="customized-badge">Modificado</span>
        )}
      </div>
      <div className="bowl-table-sections">
        {isSimple ? (
          !visual ? (
            <div className="bowl-breakdown-col">
              <span className="bowl-breakdown-label">Producto</span>
              <div className="bowl-breakdown-chips">
                <span className="bowl-chip">{line.productName}</span>
              </div>
            </div>
          ) : null
        ) : (
          <>
            <ChipCell
              kind="base"
              label="Base"
              values={baseValues}
              visual={visual}
            />
            <ChipCell
              kind="duro"
              label="Duro"
              values={config.solids}
              visual={visual}
            />
            <ChipCell
              kind="fruta"
              label="Fruta"
              values={config.fruits}
              visual={visual}
            />
            <ChipCell
              kind="blando"
              label="Blando"
              values={config.softs}
              visual={visual}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ChipCell({
  kind,
  label,
  values,
  visual = false,
}: {
  kind: string;
  label: string;
  values: string[];
  visual?: boolean;
}) {
  return (
    <div className={`bowl-breakdown-col bowl-breakdown-${kind}`}>
      <span className="bowl-breakdown-label">{label}</span>
      <div
        className={`bowl-breakdown-chips${visual ? ' bowl-breakdown-avatars' : ''}`}
      >
        {values.length > 0 ? (
          values.map((value) =>
            visual ? (
              <IngredientAvatar key={value} name={value} />
            ) : (
              <span key={value} className="bowl-chip">
                {value}
              </span>
            ),
          )
        ) : visual ? (
          <span className="ingredient-avatar muted" aria-hidden>
            <span className="ingredient-avatar-img">—</span>
          </span>
        ) : (
          <span className="bowl-chip muted">—</span>
        )}
      </div>
    </div>
  );
}

function IngredientAvatar({ name }: { name: string }) {
  const { imageUrl, emoji, tint } = ingredientVisual(name);
  return (
    <span className="ingredient-avatar" title={name}>
      <span
        className={`ingredient-avatar-img${imageUrl ? ' has-photo' : ''}`}
        style={
          imageUrl
            ? { backgroundImage: `url(${imageUrl})` }
            : { background: tint }
        }
        aria-hidden
      >
        {!imageUrl ? emoji : null}
      </span>
      <span className="ingredient-avatar-label">{name}</span>
    </span>
  );
}

export function TicketModal({
  order,
  eventName,
  onClose,
  askFirst = false,
}: {
  order: Order;
  eventName?: string;
  onClose: () => void;
  /** Si true, pregunta antes de mostrar el desglose (post-creación). */
  askFirst?: boolean;
}) {
  const [email, setEmail] = useState(order.customerEmail || '');
  const [emailNote, setEmailNote] = useState('');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [step, setStep] = useState<'ask' | 'ticket' | 'sent'>(
    askFirst ? 'ask' : 'ticket',
  );
  const [sentTo, setSentTo] = useState('');

  async function handleSend() {
    if (!email.trim()) {
      setEmailNote('Indica el email del cliente.');
      return;
    }
    setSending(true);
    setEmailNote('');
    try {
      const result = await sendReceiptEmail({
        to: email.trim(),
        order,
        eventName,
      });
      if (result.ok) {
        setSentTo(email.trim());
        setStep('sent');
      } else {
        setEmailNote(result.message);
      }
    } catch (error) {
      setEmailNote(
        error instanceof Error ? error.message : 'No se pudo generar el PDF',
      );
    } finally {
      setSending(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    setEmailNote('');
    try {
      const { filename } = await downloadReceiptPdf({ order, eventName });
      setEmailNote(`PDF descargado: ${filename}`);
    } catch (error) {
      setEmailNote(
        error instanceof Error ? error.message : 'No se pudo descargar el PDF',
      );
    } finally {
      setDownloading(false);
    }
  }

  if (step === 'ask') {
    return (
      <Modal
        title={`Pedido #${order.number} creado`}
        onClose={onClose}
        className="ticket-ask-modal"
        footer={
          <div className="ticket-ask-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              No, gracias
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep('ticket')}
            >
              <Mail size={16} /> Sí, enviar ticket
            </button>
          </div>
        }
      >
        <p className="order-detail-desc ticket-ask-copy">
          ¿Quieres enviar el ticket por correo al cliente?
        </p>
      </Modal>
    );
  }

  if (step === 'sent') {
    return (
      <Modal title="Ticket enviado" onClose={onClose} fullscreen>
        <div className="ticket-sent">
          <div className="ticket-sent-icon" aria-hidden>
            <CheckCircle2 size={40} />
          </div>
          <p className="ticket-sent-title">PDF enviado correctamente</p>
          <p className="order-detail-desc">
            El ticket del pedido #{order.number} se ha enviado a{' '}
            <strong>{sentTo}</strong>.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Ticket #${order.number}`}
      onClose={onClose}
      fullscreen
      className="ticket-send-modal"
      footer={
        <div className="ticket-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={downloading}
            onClick={handleDownloadPdf}
          >
            <Download size={16} /> {downloading ? 'Generando…' : 'Descargar'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending}
            onClick={handleSend}
          >
            <Mail size={16} />{' '}
            {sending
              ? 'Enviando…'
              : 'Enviar'}
          </button>
        </div>
      }
    >
      <div className="ticket-panel">
        <div className="field ticket-email-field">
          <label htmlFor="ticket-email">Email del cliente</label>
          <input
            id="ticket-email"
            type="email"
            placeholder="cliente@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <p className="muted ticket-hint">
            {hasAutomaticTicketSend()
              ? `Envío automático del PDF desde ${FROM_EMAIL}.`
              : `En iPad/móvil el PDF se puede compartir ya adjunto. En escritorio, sin Apps Script, hay que adjuntarlo a mano.`}
          </p>
          {emailNote && (
            <p className="builder-status complete">{emailNote}</p>
          )}
        </div>

        <div className="ticket-bowls">
          {order.lines.map((line, index) => (
            <TicketBowlRow
              key={`${line.productId}-${index}`}
              line={line}
              index={index + 1}
            />
          ))}
        </div>

        <div className="totals totals-inline">
          <div className="totals-row">
            <span>Subtotal</span>
            <span>{formatEUR(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="totals-row">
              <span>Descuento</span>
              <span>−{formatEUR(order.discount)}</span>
            </div>
          )}
          <div className="totals-row">
            <span>Base (sin IVA)</span>
            <span>{formatEUR(netFromGross(order.total))}</span>
          </div>
          <div className="totals-row">
            <span>IVA {Math.round(IVA_RATE * 100)}%</span>
            <span>{formatEUR(ivaFromGross(order.total))}</span>
          </div>
          <div className="totals-row grand">
            <span>Total pedido</span>
            <span>{formatEUR(order.total)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TicketBowlRow({ line, index }: { line: OrderLine; index: number }) {
  const ingredients = line.ingredients || [];
  const config = parseRecipe(ingredients);
  const base =
    ingredients.find((item) => /a[cç]a[ií]/i.test(item)) || 'Açaí';
  const total = lineTotal(line);

  return (
    <article className="ticket-bowl">
      <div className="ticket-bowl-head">
        <strong>
          {index}. {line.quantity}× {line.productName}
          {line.size ? ` · ${line.size} ml` : ''}
        </strong>
        <span>{formatEUR(total)}</span>
      </div>
      <ul className="ticket-bowl-details">
        <li>Base: {base}</li>
        {line.size ? <li>Tamaño: {line.size} ml</li> : null}
        {config.fruits.length > 0 && (
          <li>Fruta: {config.fruits.join(', ')}</li>
        )}
        {config.solids.length > 0 && (
          <li>Duro: {config.solids.join(', ')}</li>
        )}
        {config.softs.length > 0 && (
          <li>Blando: {config.softs.join(', ')}</li>
        )}
        {config.whey && <li>Extra: {WHEY}</li>}
        {(line.lineDiscount || 0) > 0 && (
          <li>
            Descuento
            {line.promotionName ? ` (${line.promotionName})` : ''}: −
            {formatEUR(line.lineDiscount || 0)}
          </li>
        )}
      </ul>
      <div className="ticket-bowl-total">
        <span>Total bowl</span>
        <strong>{formatEUR(total)}</strong>
      </div>
    </article>
  );
}
