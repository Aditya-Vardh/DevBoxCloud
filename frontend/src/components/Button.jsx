import { C, R } from '../theme'
import { Spinner } from './Spinner'

const VARIANTS = {
  primary: {
    background: C.ink, color: C.inverse, border: 'none',
  },
  secondary: {
    background: 'transparent', color: C.body,
    border: `1px solid ${C.borderStrong}`,
  },
  ghost: {
    background: 'transparent', color: C.muted, border: '1px solid transparent',
  },
  danger: {
    background: 'transparent', color: C.red,
    border: `1px solid ${C.redBorder}`,
  },
  'danger-solid': {
    background: C.red, color: '#fff', border: 'none',
  },
}

const SIZES = {
  sm: { padding: '6px 12px', fontSize: 12, borderRadius: R.md },
  md: { padding: '8px 16px', fontSize: 13, borderRadius: R.lg },
  lg: { padding: '11px 22px', fontSize: 14, borderRadius: R.lg },
}

const DISABLED = {
  background: C.bgSubtle, color: C.faint,
  border: `1px solid ${C.border}`, opacity: 0.5,
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  loadingLabel,
  disabled = false,
  icon,
  children,
  style,
  ...props
}) {
  const off = disabled || loading
  const vStyle = off ? DISABLED : (VARIANTS[variant] ?? VARIANTS.secondary)

  return (
    <button
      disabled={off}
      data-variant={off ? undefined : variant}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, fontFamily: 'inherit', fontWeight: 600,
        cursor: off ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap', userSelect: 'none', flexShrink: 0,
        letterSpacing: '-0.01em',
        transition: 'background 0.18s, color 0.18s, border-color 0.18s, opacity 0.18s',
        lineHeight: 1.4,
        ...SIZES[size],
        ...vStyle,
        ...style,
      }}
      {...props}
    >
      {loading
        ? <Spinner size={size === 'lg' ? 15 : 13} color={variant === 'primary' ? C.inverse : C.body} />
        : icon
        ? <span style={{ display: 'inline-flex', lineHeight: 1 }}>{icon}</span>
        : null}
      <span>{loading ? (loadingLabel ?? children) : children}</span>
    </button>
  )
}
