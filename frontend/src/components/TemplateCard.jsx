export function TemplateCard({ template, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(template)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        padding: '14px 16px',
        borderRadius: 8,
        border: selected ? '2px solid #2563eb' : '1px solid #e5e7eb',
        background: selected ? '#eff6ff' : '#fff',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      aria-pressed={selected}
    >
      <div style={{ fontSize: 28, lineHeight: 1 }}>{template.icon}</div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{template.displayName}</div>
      <div style={{
        display: 'inline-block', padding: '1px 7px', borderRadius: 4,
        background: '#f3f4f6', fontSize: 11, color: '#6b7280', fontWeight: 500,
      }}>
        {template.category}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.45, marginTop: 2 }}>
        {template.description}
      </div>
      {template.installedTools && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          Tools: {template.installedTools}
        </div>
      )}
    </button>
  )
}
