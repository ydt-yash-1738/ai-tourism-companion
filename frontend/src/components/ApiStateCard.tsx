import { AlertTriangle, Compass, Loader2, RefreshCw, WifiOff, X } from 'lucide-react';

interface LoadingStateCardProps {
  message: string;
  subMessage?: string;
  compact?: boolean;
}

export function LoadingStateCard({ message, subMessage, compact = false }: LoadingStateCardProps) {
  return (
    <div
      className={`api-state-card is-loading ${compact ? 'is-compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="api-state-card__halo" aria-hidden="true">
        <Loader2 size={compact ? 22 : 28} className="spin-icon" />
      </div>
      <div className="api-state-card__body">
        <div className="api-state-card__title">{message}</div>
        {subMessage && <p className="api-state-card__sub">{subMessage}</p>}
      </div>
    </div>
  );
}

interface ErrorStateCardProps {
  title: string;
  message: string;
  detail?: string;
  retryLabel?: string;
  onRetry?: () => void;
  secondaryAction?: { label: string; onClick: () => void };
}

export function ErrorStateCard({
  title,
  message,
  detail,
  retryLabel = 'Try Again',
  onRetry,
  secondaryAction,
}: ErrorStateCardProps) {
  return (
    <div className="api-state-card is-error" role="alert">
      <div className="api-state-card__halo is-error" aria-hidden="true">
        <AlertTriangle size={24} />
      </div>
      <div className="api-state-card__body">
        <h3 className="api-state-card__title">{title}</h3>
        <p className="api-state-card__sub">{message}</p>
        {detail && <div className="api-state-card__detail">{detail}</div>}
        {(onRetry || secondaryAction) && (
          <div className="api-state-card__actions">
            {onRetry && (
              <button type="button" className="pill-btn is-saffron" onClick={onRetry}>
                <RefreshCw size={15} />
                <span>{retryLabel}</span>
              </button>
            )}
            {secondaryAction && (
              <button type="button" className="pill-btn" onClick={secondaryAction.onClick}>
                <span>{secondaryAction.label}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface EmptyStateCardProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyStateCard({ message, actionLabel, onAction }: EmptyStateCardProps) {
  return (
    <div className="api-state-card is-empty" role="status">
      <div className="api-state-card__halo is-empty" aria-hidden="true">
        <Compass size={24} />
      </div>
      <div className="api-state-card__body">
        <p className="api-state-card__sub" style={{ margin: 0, color: 'var(--text-primary)' }}>
          {message}
        </p>
        {actionLabel && onAction && (
          <div className="api-state-card__actions">
            <button type="button" className="pill-btn is-active" onClick={onAction}>
              <span>{actionLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface FallbackNoticeBannerProps {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'warning' | 'info';
  loading?: boolean;
}

export function FallbackNoticeBanner({
  message,
  retryLabel = 'Try Again',
  onRetry,
  onDismiss,
  variant = 'warning',
  loading = false,
}: FallbackNoticeBannerProps) {
  return (
    <div className={`fallback-banner is-${variant}`} role="status">
      <div className="fallback-banner__left">
        {loading ? (
          <Loader2 size={16} className="spin-icon" style={{ flexShrink: 0 }} />
        ) : variant === 'warning' ? (
          <WifiOff size={16} style={{ flexShrink: 0 }} />
        ) : (
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        )}
        <span>{message}</span>
      </div>
      {(onRetry || onDismiss) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {onRetry && (
            <button
              type="button"
              className="pill-btn"
              style={{ minHeight: 34, padding: '4px 11px', fontSize: '0.78rem' }}
              onClick={onRetry}
            >
              <RefreshCw size={13} />
              <span>{retryLabel}</span>
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              className="pill-btn"
              style={{ minHeight: 34, padding: '4px 8px' }}
              onClick={onDismiss}
              aria-label="Dismiss notice"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface SkeletonCardsProps {
  count?: number;
  variant?: 'card' | 'tour' | 'dashboard';
}

export function SkeletonCards({ count = 4, variant = 'card' }: SkeletonCardsProps) {
  if (variant === 'tour') {
    return (
      <div aria-hidden="true">
        <div className="skeleton-map" />
        <div className="skeleton-card" style={{ marginBottom: 12 }}>
          <div className="skeleton-line is-short" />
          <div className="skeleton-line is-title" />
          <div className="skeleton-line" />
          <div className="skeleton-line is-med" />
        </div>
        <div className="tour-stop-list">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="skeleton-card">
              <div className="skeleton-line is-med" />
              <div className="skeleton-line is-short" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div aria-hidden="true">
        <div className="kpi-grid">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="skeleton-kpi">
              <div className="skeleton-line is-short" />
              <div className="skeleton-line is-title" style={{ width: '48%', height: 26 }} />
            </div>
          ))}
        </div>
        <div className="charts-grid">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="skeleton-chart">
              <div className="skeleton-line is-med" />
              <div className="skeleton-box" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="cards-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-card">
          <div className="skeleton-card-media" />
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="skeleton-pill" />
            <div className="skeleton-pill" style={{ width: 92 }} />
          </div>
          <div className="skeleton-line is-title" />
          <div className="skeleton-line" />
          <div className="skeleton-line is-med" />
          <div className="skeleton-line is-short" style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}
