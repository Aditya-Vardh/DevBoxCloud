export function ErrorMessage({ error }) {
  if (!error) return null
  return (
    <div style={{
      padding: '10px 14px',
      background: '#fee2e2',
      border: '1px solid #fca5a5',
      borderRadius: 6,
      color: '#b91c1c',
      margin: '8px 0',
      fontSize: 14,
    }}>
      {error}
    </div>
  )
}
