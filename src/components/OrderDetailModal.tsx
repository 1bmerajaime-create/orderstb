import { CheckCircle2, Mail, Ticket, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Modal } from './ui';
import { parseRecipe, WHEY } from '../lib/bowl';
import { sendReceiptEmail, FROM_EMAIL } from '../lib/receipt';
import { useStore } from '../lib/store';
import {
  formatEUR,
  formatTime,
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
            {currentOrder.lines.map((line, index) => (
              <BowlLineCard
                key={`${line.productId}-${index}`}
                line={line}
                fallbackIngredients={
                  data.products.find((p) => p.id === line.productId)
                    ?.ingredients || []
                }
              />
            ))}
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

function BowlLineCard({
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

  const groups = [
    { kind: 'base', label: 'Base', values: [base] },
    { kind: 'fruta', label: 'Fruta', values: config.fruits },
    { kind: 'duro', label: 'Duro', values: config.solids },
    { kind: 'blando', label: 'Blando', values: config.softs },
    ...(config.whey
      ? [{ kind: 'extra', label: 'Extra', values: [WHEY] }]
      : []),
  ];

  return (
    <article className="order-detail-line">
      <div className="order-detail-line-head">
        <strong>
          {line.quantity}× {line.productName}
          {line.customized && (
            <span className="customized-badge">Modificado</span>
          )}
        </strong>
      </div>
      <div className="bowl-breakdown">
        {groups.map((group) => (
          <div
            key={group.kind}
            className={`bowl-breakdown-col bowl-breakdown-${group.kind}`}
          >
            <span className="bowl-breakdown-label">{group.label}</span>
            <div className="bowl-breakdown-chips">
              {group.values.length > 0 ? (
                group.values.map((value) => (
                  <span key={value} className="bowl-chip">
                    {value}
                  </span>
                ))
              ) : (
                <span className="bowl-chip muted">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
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
  const [step, setStep] = useState<'ask' | 'ticket'>(
    askFirst ? 'ask' : 'ticket',
  );

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
      setEmailNote(result.message);
    } catch (error) {
      setEmailNote(
        error instanceof Error ? error.message : 'No se pudo abrir el ticket',
      );
    } finally {
      setSending(false);
    }
  }

  if (step === 'ask') {
    return (
      <Modal title={`Pedido #${order.number} creado`} onClose={onClose}>
        <p className="order-detail-desc">
          ¿Quieres enviar el ticket por correo al cliente?
        </p>
        <div className="modal-actions">
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
      </Modal>
    );
  }

  return (
    <Modal title={`Ticket #${order.number}`} onClose={onClose}>
      <div className="ticket-panel">
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
            <span>IVA 21%</span>
            <span>{formatEUR(ivaFromGross(order.total))}</span>
          </div>
          <div className="totals-row grand">
            <span>Total</span>
            <span>{formatEUR(order.total)}</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="ticket-email">Email del cliente</label>
          <input
            id="ticket-email"
            type="email"
            placeholder="cliente@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>

        {emailNote && <p className="builder-status complete">{emailNote}</p>}
        <p className="muted ticket-hint">
          Se abre Gmail con el ticket. Envíalo desde {FROM_EMAIL}.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending}
            onClick={handleSend}
          >
            <Mail size={16} /> {sending ? 'Abriendo…' : 'Abrir en Gmail'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
