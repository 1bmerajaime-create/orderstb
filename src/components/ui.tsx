import { ArrowLeft, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatEUR } from '../lib/utils';

export function Modal({
  title,
  children,
  onClose,
  wide,
  className,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal${wide ? ' wide' : ''}${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
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

export function Topbar({
  right,
  subtitle,
}: {
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <img src="/logo.png" alt="Tropic Boost" />
        <div className="brand-text">
          <span className="brand-name">Tropic Boost</span>
          <span className="brand-tag">{subtitle || 'Push, Recover, Enjoy'}</span>
        </div>
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
}: {
  title?: string;
  description?: ReactNode;
  /** Fallback si no hay historial interno */
  backTo?: string;
  backLabel?: string;
  showBack?: boolean;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const canGoBack = showBack || !!backTo;

  if (!canGoBack && !actions && !title) return null;

  function handleBack() {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }
    navigate(backTo || '/');
  }

  return (
    <div className={`page-header${actions ? ' event-header' : ''}`}>
      <div className="page-header-main">
        {canGoBack && (
          <button type="button" className="back-link" onClick={handleBack}>
            <ArrowLeft size={18} />
            {backLabel}
          </button>
        )}
        {title && <h1>{title}</h1>}
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="event-header-actions">{actions}</div>}
    </div>
  );
}
