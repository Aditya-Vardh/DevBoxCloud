import { C, R, STATUS_META } from '../theme'

export function StatusBadge({ status, dot = true, style }) {
  const m = STATUS_META[status] ?? { label: status ?? '—', dot: C.faint, bg: C.chip, text: C.muted }
  const pulsing = ['PROVISIONING','BUILDING','DEPLOYING','DELETING'].includes(status)

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: R.pill,
      background: m.bg, color: m.text,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
      whiteSpace: 'nowrap', lineHeight: 1.4,
      border: `1px solid ${C.border}`,
      ...style,
    }}>
      {dot && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: m.dot, flexShrink: 0,
          animation: pulsing ? 'pulse 1.4s ease-in-out infinite' : 'none',
        }} />
      )}
      {m.label}
    </span>
  )
}
