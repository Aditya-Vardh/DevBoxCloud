import { C, R, SHADOW } from '../theme'
import { Button } from './Button'

/**
 * Confirmation dialog overlay.
 *
 * Props:
 *   title        — heading (default: "Are you sure?")
 *   message      — body text or JSX
 *   confirmLabel — label for the confirm button (default: "Delete")
 *   confirmVariant — Button variant for confirm (default: "danger-solid")
 *   onConfirm    — callback
 *   onCancel     — callback
 */
export function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  confirmVariant = 'danger-solid',
  onConfirm,
  onCancel,
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 16,
        animation: 'fadeIn 0.12s ease both',
      }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: C.bg,
        borderRadius: R.xl,
        padding: '24px 28px',
        width: '100%',
        maxWidth: 420,
        boxShadow: SHADOW.modal,
        animation: 'modalIn 0.15s ease both',
      }}>
        <h3 id="confirm-dialog-title" style={{
          margin: '0 0 10px',
          fontSize: 16,
          fontWeight: 700,
          color: C.ink,
        }}>
          {title}
        </h3>

        {message && (
          <p style={{
            margin: '0 0 20px',
            fontSize: 14,
            color: C.muted,
            lineHeight: 1.6,
          }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
