export function BrandMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--ink)' }}>
      <rect x="1" y="1" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.92" />
      <rect x="11" y="1" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.42" />
      <rect x="1" y="11" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.42" />
      <rect x="11" y="11" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.14" />
    </svg>
  )
}
