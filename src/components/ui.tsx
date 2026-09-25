import { ArrowLeft, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatEUR } from '../lib/utils';
import logoHorizontalUrl from '../assets/logo-horizontal.png';

export function Modal({
  title,
  children,
  onClose,
  wide,
  fullscreen,
  className,
  headerActions,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  /** Pantalla completa en móvil (p. ej. configurar bowl). */
  fullscreen?: boolean;
  className?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const classes = [
    'modal',
    wide ? 'wide' : '',
    fullscreen ? 'modal-fullscreen' : '',
    footer ? 'has-footer' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`modal-backdrop${fullscreen ? ' modal-backdrop-fullscreen' : ''}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={classes}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <div className="modal-header-actions">
            {headerActions}
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pendiente: { label: 'Pendiente', className: 'badge-pending' },
    en_preparacion: { label: 'En preparación', className: 'badge-prep' },
    listo: { label: 'Listo', className: 'badge-ready' },
    entregado: { label: 'Entregado', className: 'badge-done' },
  };
  const s = map[status] || { label: status, className: 'badge-pending' };
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function Money({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const sign =
    value > 0 ? 'num-positive' : value < 0 ? 'num-negative' : '';
  return (
    <span className={`${sign}${className ? ` ${className}` : ''}`.trim()}>
      {formatEUR(value)}
    </span>
  );
}

export function Topbar({ right }: { right?: ReactNode }) {
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Tropic Boost">
        <img
          src={logoHorizontalUrl}
          alt="Tropic Boost"
          className="brand-logo"
        />
      </Link>
      <div className="topbar-actions">{right}</div>
    </header>
  );
}

export function PageHeader({
  title,
  description,
  backTo,
  backLabel = 'Atrás',
  showBack,
  actions,
  topAction,
}: {
  title?: string;
  description?: ReactNode;
  /** Destino fijo del botón Atrás (p. ej. "/" o el evento). */
  backTo?: string;
  backLabel?: string;
  showBack?: boolean;
  actions?: ReactNode;
  topAction?: ReactNode;
}) {
  const navigate = useNavigate();
  const canGoBack = showBack || !!backTo;

  if (!canGoBack && !actions && !title) return null;

  function handleBack() {
    if (backTo) {
      navigate(backTo);
      return;
    }
    navigate(-1);
  }

  return (
    <div className={`page-header${actions ? ' event-header' : ''}`}>
      {(canGoBack || topAction) && (
        <div className="page-header-topline">
          {canGoBack && (
            <button type="button" className="back-link" onClick={handleBack}>
              <ArrowLeft size={18} />
              {backLabel}
            </button>
          )}
          {topAction && <div className="page-header-top-action">{topAction}</div>}
        </div>
      )}
      <div className="page-header-main">
        {title && <h1>{title}</h1>}
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="event-header-actions">{actions}</div>}
    </div>
  );
}
