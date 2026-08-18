const COLORS = {
  NOT_DEPLOYED: '#6b7280',
  BUILDING:     '#d97706',
  BUILD_FAILED: '#dc2626',
  DEPLOYING:    '#2563eb',
  RUNNING:      '#16a34a',
  DEGRADED:     '#ca8a04',
  FAILED:       '#dc2626',
  STOPPED:      '#6b7280',
  DELETING:     '#9333ea',
}

export function StatusBadge({ status }) {
  const color = COLORS[status] || '#6b7280'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      color: '#fff',
      backgroundColor: color,
      letterSpacing: '0.05em',
    }}>
      {status ?? '—'}
    </span>
  )
}
