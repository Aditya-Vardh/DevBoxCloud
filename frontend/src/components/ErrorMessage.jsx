import { C, R } from '../theme'

export function ErrorMessage({ error }) {
  if (!error) return null
  return (
    <div role="alert" style={{
      background: C.redLight,
      border: `1px solid ${C.redBorder}`,
      borderRadius: R.lg,
      padding: '10px 14px',
      color: C.red,
      fontSize: 13,
      lineHeight: 1.55,
      margin: '10px 0',
    }}>
      {error}
    </div>
  )
}
