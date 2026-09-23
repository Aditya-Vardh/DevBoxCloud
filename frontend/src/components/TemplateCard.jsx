import { TEMPLATE_ACCENT, C, R } from '../theme'

/**
 * TemplateCard — selectable template button in the New Environment modal.
 *
 * Props: template, selected (bool), onSelect(template)
 */
export function TemplateCard({ template, selected, onSelect }) {
  const accent = TEMPLATE_ACCENT[template.id] || TEMPLATE_ACCENT.ubuntu

  // Show only meaningful tool badges (skip infrastructure-level ones)
  const SKIP = new Set(['xfce4', 'tigervnc', 'novnc', 'ttyd', 'nano', 'less', 'procps'])
  const tools = (template.installedTools || '')
    .split(',')
    .map(t => t.trim())
    .filter(t => t && !SKIP.has(t))
    .slice(0, 8)  // cap to avoid overflow

  return (
    <button
      onClick={() => onSelect(template)}
      aria-pressed={selected}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '14px',
        borderRadius: R.lg,
        border: selected
          ? `2px solid ${accent.color}`
          : `1px solid ${C.border}`,
        background: selected ? accent.bg : C.bg,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        minHeight: 160,
        boxSizing: 'border-box',
        outline: 'none',
        boxShadow: selected ? `0 0 0 3px ${accent.border}` : 'none',
        transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s',
      }}
    >
      {/* Icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, width: '100%' }}>
        <span style={{
          fontSize: 20, lineHeight: 1, flexShrink: 0,
          width: 34, height: 34,
          background: selected ? accent.color : C.bgSubtle,
          borderRadius: R.sm,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.12s',
        }}>
          {template.icon}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color: C.ink, lineHeight: 1.25 }}>
          {template.displayName}
        </span>
      </div>

      {/* Category */}
      <span style={{
        display: 'inline-block', padding: '1px 7px', borderRadius: R.full,
        background: selected ? accent.color : C.bgSubtle,
        color: selected ? '#fff' : C.muted,
        fontSize: 10, fontWeight: 600, marginBottom: 7,
        letterSpacing: '0.02em',
        transition: 'background 0.12s, color 0.12s',
      }}>
        {template.category}
      </span>

      {/* Description */}
      <span style={{
        fontSize: 11, color: selected ? C.body : C.muted,
        lineHeight: 1.5, marginBottom: 8, flexGrow: 1,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {template.description}
      </span>

      {/* Tool badges */}
      {tools.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 'auto' }}>
          {tools.map(tool => (
            <span key={tool} style={{
              padding: '1px 5px', borderRadius: R.sm,
              background: selected ? accent.border : C.bgSubtle,
              color: selected ? accent.color : C.faint,
              fontSize: 9, fontWeight: 600,
              fontFamily: 'monospace', letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}>
              {tool}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
