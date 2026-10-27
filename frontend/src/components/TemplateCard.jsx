import { TEMPLATE_ACCENT, C, R, FONT } from '../theme'

export function TemplateCard({ template, selected, onSelect }) {
  const a = TEMPLATE_ACCENT[template.id] ?? TEMPLATE_ACCENT.ubuntu

  const SKIP = new Set(['xfce4', 'tigervnc', 'novnc', 'ttyd', 'nano', 'less', 'procps'])
  const tools = (template.installedTools ?? '')
    .split(',').map(t => t.trim())
    .filter(t => t && !SKIP.has(t))
    .slice(0, 6)

  return (
    <button
      onClick={() => onSelect(template)}
      aria-pressed={selected}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '16px',
        border: selected ? `1px solid ${C.borderStrong}` : `1px solid ${C.border}`,
        borderRadius: R.xl,
        background: selected ? C.hover : 'transparent',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        minHeight: 150, boxSizing: 'border-box',
        fontFamily: FONT.sans, outline: 'none',
        transition: 'border-color 0.18s, background 0.18s',
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = C.borderStrong; e.currentTarget.style.background = C.hover } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, width: '100%' }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: a.color,
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
          {template.displayName}
        </span>
      </div>

      <span style={{ fontSize: 11, color: C.muted, marginBottom: 2, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {template.category}
      </span>

      <span style={{
        fontSize: 12, color: C.muted, lineHeight: 1.55, marginBottom: 12, flexGrow: 1,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {template.description}
      </span>

      {tools.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tools.map(t => (
            <span key={t} className="chip" style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.01em' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
