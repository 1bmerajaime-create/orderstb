import { CheckCircle2, Download, Mail, Ticket, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Modal } from './ui';
import { parseRecipe, WHEY } from '../lib/bowl';
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

export function OrderDetailModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { data, deleteOrder, updateOrderStatus } = useStore();
  const currentOrder = data.orders.find((item) => item.id === order.id) || order;
  const event = data.events.find((item) => item.id === currentOrder.eventId);
  const [showTicket, setShowTicket] = useState(false);
  const resolvedProducts = useMemo(
    () => resolveAllProducts(data.products, data.recipes, data.sizes),
    [data.products, data.recipes, data.sizes],
  );

  return (
    <>
      <Modal
        title={`Pedido #${currentOrder.number}`}
        onClose={onClose}
        wide
        headerActions={
          <button
            type="button"
            className="icon-btn"
            aria-label="Ticket y desglose"
            onClick={() => setShowTicket(true)}
          >
            <Ticket size={18} />
          </button>
        }
      >
        <div className="order-detail">
          <div className="order-detail-summary">
            <strong>{currentOrder.customerName}</strong>
            <span>{formatTime(currentOrder.createdAt)}</span>
          </div>

          <div className="order-detail-lines">
            <div className="bowl-table">
              {currentOrder.lines.map((line, index) => (
                <BowlLineRow
                  key={`${line.productId}-${index}`}
                  line={line}
                  fallbackIngredients={
                    resolvedProducts.find((p) => p.id === line.productId)
                      ?.ingredients || []
                  }
                />
              ))}
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
            {currentOrder.status !== 'listo' &&
              currentOrder.status !== 'entregado' && (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    updateOrderStatus(currentOrder.id, 'listo');
                    onClose();
                  }}
                >
                  <CheckCircle2 size={18} /> Marcar como terminado
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
}: {
  line: OrderLine;
  fallbackIngredients: string[];
}) {
  const ingredients = line.ingredients?.length
    ? line.ingredients
    : fallbackIngredients;
  const config = parseRecipe(ingredients);
  const base = ingredients.find((item) => /a[cç]a[ií]/i.test(item)) || 'Açaí';
  const extras = config.whey ? [WHEY] : [];

  return (
    <div className="bowl-table-row">
      <div className="bowl-table-product">
        <strong>
          {line.quantity}× {line.productName}
        </strong>
        {line.customized && (
          <span className="customized-badge">Modificado</span>
        )}
      </div>
      <div className="bowl-table-sections">
        <ChipCell kind="base" label="Base" values={[base]} />
        <ChipCell kind="fruta" label="Fruta" values={config.fruits} />
        <ChipCell kind="duro" label="Duro" values={config.solids} />
        <ChipCell kind="blando" label="Blando" values={config.softs} />
        {extras.length > 0 && (
          <ChipCell kind="extra" label="Extra" values={extras} />
        )}
      </div>
    </div>
  );
}

function ChipCell({
  kind,
  label,
  values,
}: {
  kind: string;
  label: string;
  values: string[];
}) {
  return (
    <div className={`bowl-breakdown-col bowl-breakdown-${kind}`}>
      <span className="bowl-breakdown-label">{label}</span>
      <div className="bowl-breakdown-chips">
        {values.length > 0 ? (
          values.map((value) => (
            <span key={value} className="bowl-chip">
              {value}
            </span>
          ))
        ) : (
          <span className="bowl-chip muted">—</span>
        )}
      </div>
    </div>
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
