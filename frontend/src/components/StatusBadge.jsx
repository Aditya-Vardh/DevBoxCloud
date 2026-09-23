import { STATUS_META, C } from '../theme'

/**
 * Unified StatusBadge — works for both EnvironmentStatus and DeploymentStatus.
 *
 * Props:
 *   status  — string key matching STATUS_META in theme.js
 *   dot     — boolean, show pulsing dot before label (default: true)
 *   style   — extra inline style overrides
 */
export function StatusBadge({ status, dot = true, style }) {
  const meta = STATUS_META[status] || { label: status ?? '—', dot: C.faint, bg: C.bgSubtle, text: C.muted }
  const isPulsing = status === 'PROVISIONING' || status === 'BUILDING' || status === 'DEPLOYING' || status === 'DELETING'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      borderRadius: 9999,
      background: meta.bg,
      color: meta.text,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.01em',
      whiteSpace: 'nowrap',
      lineHeight: 1.4,
      ...style,
    }}>
      {dot && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: meta.dot,
          flexShrink: 0,
          animation: isPulsing ? 'pulse 1.4s ease-in-out infinite' : 'none',
        }} />
      )}
      {meta.label}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </span>
  )
}
