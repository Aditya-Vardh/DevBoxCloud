export function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: 24,
        maxWidth: 400, width: '90%', boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      }}>
        <p style={{ margin: '0 0 20px', fontSize: 15 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnStyle('#6b7280')}>Cancel</button>
          <button onClick={onConfirm} style={btnStyle('#dc2626')}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function btnStyle(bg) {
  return {
    padding: '8px 18px', borderRadius: 6, border: 'none',
    background: bg, color: '#fff', cursor: 'pointer', fontSize: 14,
  }
}
