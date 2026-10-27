import { C } from '../theme'
import { Button } from './Button'

export function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger-solid',
  onConfirm,
  onCancel,
}) {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      style={{ zIndex: 200 }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="modal-panel" style={{ padding: '28px 28px 24px', width: '100%', maxWidth: 400 }}>
        <h3 id="confirm-title" style={{
          margin: '0 0 10px',
          fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em',
        }}>
          {title}
        </h3>
        {message && (
          <p style={{ margin: '0 0 24px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
