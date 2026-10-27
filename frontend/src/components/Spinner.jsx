import { C } from '../theme'

export function Spinner({ size = 18, color = C.body }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block', flexShrink: 0,
        width: size, height: size,
        border: `${Math.max(1.5, Math.round(size / 8))}px solid ${C.border}`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  )
}
