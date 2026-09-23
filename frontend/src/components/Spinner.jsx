export function Spinner({ size = 18, color = '#2563eb' }) {
  return (
    <span
      aria-label="Loading"
      role="status"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `${Math.max(2, Math.round(size / 7))}px solid #e5e7eb`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}
