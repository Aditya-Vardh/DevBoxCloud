export function Spinner({ size = 18 }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: `3px solid #d1d5db`,
      borderTopColor: '#2563eb',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      verticalAlign: 'middle',
    }} />
  )
}
