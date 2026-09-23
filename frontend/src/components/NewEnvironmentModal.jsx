import { useState, useEffect } from 'react'
import { templateApi } from '../api/client'
import { TemplateCard } from './TemplateCard'
import { ErrorMessage } from './ErrorMessage'
import { Spinner } from './Spinner'
import { Button } from './Button'
import { C, R, SHADOW, TEMPLATE_ACCENT, FONT } from '../theme'

/**
 * Two-step modal for creating a new environment.
 *
 * Step 1 — Choose template (6 cards)
 * Step 2 — Configure name + resources
 *
 * Props:
 *   onSubmit(formData)  { name, description, templateId, cpuRequest, memoryRequest, storageSize }
 *   onCancel()
 *   loading             — spinner on submit
 *   error               — API error string
 */
export function NewEnvironmentModal({ onSubmit, onCancel, loading, error }) {
  const [step, setStep]               = useState(1)
  const [templates, setTemplates]     = useState([])
  const [tmplLoading, setTmplLoading] = useState(true)
  const [tmplError, setTmplError]     = useState(null)
  const [selected, setSelected]       = useState(null)

  useEffect(() => {
    templateApi.list()
      .then(data => { setTemplates(data); setTmplLoading(false) })
      .catch(e  => { setTmplError(e.message); setTmplLoading(false) })
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    onSubmit({
      name:          fd.get('name'),
      description:   fd.get('description') || undefined,
      templateId:    selected.id,
      cpuRequest:    fd.get('cpuRequest')    || undefined,
      memoryRequest: fd.get('memoryRequest') || undefined,
      storageSize:   fd.get('storageSize')   || undefined,
    })
  }

  const accent = selected ? (TEMPLATE_ACCENT[selected.id] || TEMPLATE_ACCENT.ubuntu) : null

  return (
    <div
      style={S.overlay}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          {/* Step indicator */}
          <div style={S.steps}>
            <StepDot n={1} active={step === 1} done={step > 1} label="Template" />
            <div style={S.stepLine(step > 1)} />
            <StepDot n={2} active={step === 2} done={false} label="Configure" />
          </div>
          <button onClick={onCancel} style={S.closeBtn} aria-label="Close">✕</button>
        </div>

        {/* ── Step 1: template grid ─────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div style={S.stepHeading}>
              <h2 style={S.stepTitle}>Choose a template</h2>
              <p style={S.stepSubtitle}>Select the runtime environment for your workspace.</p>
            </div>

            <div style={S.body}>
              <ErrorMessage error={tmplError} />
              {tmplLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Spinner size={24} />
                  <p style={{ margin: '12px 0 0', color: C.muted, fontSize: 13 }}>Loading templates…</p>
                </div>
              ) : (
                <div style={S.grid}>
                  {templates.map(t => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      selected={selected?.id === t.id}
                      onSelect={t => { setSelected(t) }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div style={S.footer}>
              <Button variant="secondary" onClick={onCancel}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!selected}
                style={{ opacity: selected ? 1 : 0.5 }}
                onClick={() => selected && setStep(2)}
              >
                Configure →
              </Button>
            </div>
          </>
        )}

        {/* ── Step 2: configuration ─────────────────────────────────────────── */}
        {step === 2 && selected && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={S.stepHeading}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 20, width: 36, height: 36,
                  background: accent.bg, border: `1px solid ${accent.border}`,
                  borderRadius: R.md,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected.icon}
                </span>
                <div>
                  <h2 style={S.stepTitle}>{selected.displayName}</h2>
                  <p style={{ ...S.stepSubtitle, margin: 0 }}>{selected.category}</p>
                </div>
              </div>
            </div>

            <div style={{ ...S.body, display: 'flex', flexDirection: 'column', gap: 0 }}>

              {/* Name */}
              <div style={S.field}>
                <label style={S.label}>
                  Environment name <span style={{ color: C.red }}>*</span>
                </label>
                <input
                  name="name" required autoFocus
                  style={S.input}
                  placeholder="e.g. my-python-env"
                  pattern="^[a-z0-9][a-z0-9\-]*[a-z0-9]$|^[a-z0-9]$"
                  title="Lowercase alphanumeric and hyphens only, e.g. my-env"
                />
                <p style={S.hint}>Lowercase letters, numbers and hyphens only.</p>
              </div>

              {/* Description */}
              <div style={S.field}>
                <label style={S.label}>Description</label>
                <input name="description" style={S.input} placeholder="Optional note about this environment" />
              </div>

              {/* Resources */}
              <div style={{ marginTop: 4 }}>
                <label style={{ ...S.label, marginBottom: 8 }}>Resources</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={S.resourceLabel}>CPU</div>
                    <input name="cpuRequest" style={S.input}
                      placeholder={selected.defaultCpu} defaultValue={selected.defaultCpu} />
                    <div style={S.hint}>Max: {selected.maxCpu}</div>
                  </div>
                  <div>
                    <div style={S.resourceLabel}>Memory</div>
                    <input name="memoryRequest" style={S.input}
                      placeholder={selected.defaultMemory} defaultValue={selected.defaultMemory} />
                    <div style={S.hint}>Max: {selected.maxMemory}</div>
                  </div>
                  <div>
                    <div style={S.resourceLabel}>Storage</div>
                    <input name="storageSize" style={S.input}
                      placeholder={selected.defaultStorage} defaultValue={selected.defaultStorage} />
                  </div>
                </div>
              </div>

              {/* Quick-start preview */}
              {selected.quickStartCommands && (
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                  }}>
                    Quick start commands
                  </div>
                  <div style={{
                    background: C.termBg, borderRadius: R.md,
                    padding: '10px 14px', fontFamily: FONT.mono, fontSize: 12,
                    lineHeight: 1.8,
                  }}>
                    {selected.quickStartCommands.split('\n').filter(Boolean).map((cmd, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: C.termGreen, userSelect: 'none', flexShrink: 0 }}>$</span>
                        <span style={{ color: C.termText }}>{cmd}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ ...S.hint, marginTop: 4 }}>
                    Run these after opening the terminal in your workspace.
                  </p>
                </div>
              )}

              {/* Image tag (read-only info) */}
              <div style={{
                marginTop: 12, padding: '7px 12px',
                background: C.bgSubtle, borderRadius: R.md,
                fontSize: 11, color: C.faint, fontFamily: FONT.mono,
              }}>
                Image: {selected.image}
              </div>

              <ErrorMessage error={error} />
            </div>

            <div style={S.footer}>
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button type="submit" variant="primary" loading={loading} loadingLabel="Creating…">
                Create Environment
              </Button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

// ── Step dot indicator ────────────────────────────────────────────────────────

function StepDot({ n, active, done, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        background: done ? C.green : active ? C.primary : C.bgSubtle,
        color: (done || active) ? '#fff' : C.faint,
        border: `2px solid ${done ? C.green : active ? C.primary : C.border}`,
        transition: 'all 0.15s',
      }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 10, fontWeight: 500, color: active ? C.primary : C.faint }}>
        {label}
      </span>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.48)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 16,
    animation: 'fadeIn 0.12s ease both',
  },
  modal: {
    background: C.bg, borderRadius: R.xl,
    width: '100%', maxWidth: 740,
    maxHeight: '92vh',
    boxShadow: SHADOW.modal,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    animation: 'modalIn 0.15s ease both',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 24px 0',
  },
  steps: {
    display: 'flex', alignItems: 'flex-start', gap: 0,
  },
  stepLine: (done) => ({
    width: 48, height: 2, alignSelf: 'center', marginBottom: 16,
    background: done ? C.green : C.border,
    transition: 'background 0.2s',
  }),
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 16, color: C.faint, padding: '0 4px', lineHeight: 1,
  },
  stepHeading: {
    padding: '14px 24px 12px',
    borderBottom: `1px solid ${C.divider}`,
  },
  stepTitle: { margin: '0 0 2px', fontSize: 16, fontWeight: 700, color: C.ink },
  stepSubtitle: { margin: 0, fontSize: 13, color: C.muted },
  body: {
    padding: '16px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    padding: '14px 24px',
    borderTop: `1px solid ${C.divider}`,
    background: C.bg,
    flexShrink: 0,
  },
  field: { marginBottom: 14 },
  label: {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: C.body, marginBottom: 5,
  },
  resourceLabel: {
    fontSize: 11, fontWeight: 600, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: 4,
  },
  input: {
    display: 'block', width: '100%',
    padding: '8px 11px', borderRadius: R.md,
    border: `1px solid ${C.borderStrong}`,
    fontSize: 14, color: C.ink, background: C.bg,
    boxSizing: 'border-box', fontFamily: 'inherit',
  },
  hint: { margin: '3px 0 0', fontSize: 11, color: C.faint },
}
