import { Spinner } from './Spinner'
import { C, R } from '../theme'

/**
 * Reusable Button component.
 *
 * Props:
 *   variant  — 'primary' | 'secondary' | 'ghost' | 'danger'  (default: 'secondary')
 *   size     — 'sm' | 'md' | 'lg'  (default: 'md')
 *   loading  — boolean, shows spinner and disables
 *   loadingLabel — text shown while loading (default: same as children)
 *   disabled — boolean
 *   icon     — string/JSX prepended to label
 *   onClick, type, style, className, etc. — forwarded
 */
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
  const isDisabled = disabled || loading

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: 'none',
    borderRadius: R.md,
    fontWeight: 500,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    flexShrink: 0,
    ...SIZE_STYLES[size],
  }

  const variantStyle = isDisabled
    ? DISABLED_STYLE
    : VARIANT_STYLES[variant] || VARIANT_STYLES.secondary

  return (
    <button
      disabled={isDisabled}
      style={{ ...base, ...variantStyle, ...style }}
      {...props}
    >
      {loading
        ? <Spinner size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14}
                   color={variant === 'primary' || variant === 'danger' ? '#fff' : C.primary} />
        : icon
        ? <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
        : null}
      <span>{loading ? (loadingLabel ?? children) : children}</span>
    </button>
  )
}

const SIZE_STYLES = {
  sm: { padding: '4px 10px',  fontSize: 12, lineHeight: '18px', borderRadius: R.sm },
  md: { padding: '7px 14px',  fontSize: 13, lineHeight: '20px', borderRadius: R.md },
  lg: { padding: '10px 20px', fontSize: 14, lineHeight: '22px', borderRadius: R.lg },
}

const VARIANT_STYLES = {
  primary: {
    background: C.primary, color: '#fff', border: 'none',
  },
  secondary: {
    background: C.bg, color: C.body, border: `1px solid ${C.borderStrong}`,
  },
  ghost: {
    background: 'transparent', color: C.muted, border: '1px solid transparent',
  },
  danger: {
    background: C.redLight, color: C.red, border: `1px solid ${C.redBorder}`,
  },
  'danger-solid': {
    background: C.red, color: '#fff', border: 'none',
  },
}

const DISABLED_STYLE = {
  background: C.bgSubtle, color: C.faint, border: `1px solid ${C.border}`,
}
