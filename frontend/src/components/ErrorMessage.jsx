import { C, R } from '../theme'

export function ErrorMessage({ error }) {
  if (!error) return null
  return (
    <div role="alert" style={{
      background: C.redLight,
      border: `1px solid ${C.redBorder}`,
      borderRadius: R.md,
      padding: '10px 14px',
      color: C.redText,
      fontSize: 13,
      lineHeight: 1.5,
      margin: '8px 0',
    }}>
      {error}
    </div>
  )
}
