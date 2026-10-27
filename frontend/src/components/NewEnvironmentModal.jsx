import { useState, useEffect } from 'react'
import { templateApi } from '../api/client'
import { TemplateCard } from './TemplateCard'
import { ErrorMessage } from './ErrorMessage'
import { Spinner } from './Spinner'
import { Button } from './Button'
import { C, R, FONT } from '../theme'

export function NewEnvironmentModal({ onSubmit, onCancel, loading, error }) {
  const [step, setStep]             = useState(1)
  const [templates, setTemplates]   = useState([])
  const [tmplLoading, setTmplLoad]  = useState(true)
  const [tmplError, setTmplError]   = useState(null)
  const [selected, setSelected]     = useState(null)

  useEffect(() => {
    templateApi.list()
      .then(d => { setTemplates(d); setTmplLoad(false) })
      .catch(e => { setTmplError(e.message); setTmplLoad(false) })
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

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="modal-panel" style={S.modal}>

        <div style={S.header}>
          <div style={S.steps}>
            <StepPip n={1} active={step === 1} done={step > 1} />
            <div style={{ ...S.stepLine, background: step > 1 ? C.body : C.border }} />
            <StepPip n={2} active={step === 2} done={false} />
          </div>
          <div style={S.headerText}>
            <span style={S.headerTitle}>
              {step === 1 ? 'Choose a template' : selected?.displayName}
            </span>
            {step === 1
              ? <span style={S.headerSub}>Select the runtime for your environment</span>
              : <span style={S.headerSub}>{selected?.category}</span>
            }
          </div>
          <button style={S.closeBtn} onClick={onCancel} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {step === 1 && (
          <>
            <div style={S.body}>
              <ErrorMessage error={tmplError} />
              {tmplLoading
                ? <div style={{ padding: '60px 0', textAlign: 'center' }}><Spinner size={22} /></div>
                : <div className="tmpl-grid" style={S.grid}>
                    {templates.map(t => (
                      <TemplateCard key={t.id} template={t}
                        selected={selected?.id === t.id}
                        onSelect={setSelected} />
                    ))}
                  </div>
              }
            </div>
            <div style={S.footer}>
              <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
              <Button variant="primary" size="sm"
                disabled={!selected}
                style={!selected ? { opacity: 0.35 } : {}}
                onClick={() => selected && setStep(2)}>
                Configure
              </Button>
            </div>
          </>
        )}

        {step === 2 && selected && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={S.body}>

              <Field label="Name" required hint="Lowercase letters, numbers, hyphens only">
                <input className="ui-input" name="name" required autoFocus
                  placeholder="my-python-env"
                  pattern="^[a-z0-9][a-z0-9\-]*[a-z0-9]$|^[a-z0-9]$" />
              </Field>

              <Field label="Description">
                <input className="ui-input" name="description" placeholder="Optional" />
              </Field>

              <div style={{ marginTop: 20 }}>
                <div style={S.fieldLabel}>Resources</div>
                <div className="res-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
                  <div>
                    <div style={S.resourceLabel}>CPU</div>
                    <input className="ui-input" name="cpuRequest" placeholder={selected.defaultCpu} defaultValue={selected.defaultCpu} />
                    <div style={S.hint}>Max: {selected.maxCpu}</div>
                  </div>
                  <div>
                    <div style={S.resourceLabel}>Memory</div>
                    <input className="ui-input" name="memoryRequest" placeholder={selected.defaultMemory} defaultValue={selected.defaultMemory} />
                    <div style={S.hint}>Max: {selected.maxMemory}</div>
                  </div>
                  <div>
                    <div style={S.resourceLabel}>Storage</div>
                    <input className="ui-input" name="storageSize" placeholder={selected.defaultStorage} defaultValue={selected.defaultStorage} />
                  </div>
                </div>
              </div>

              {selected.quickStartCommands && (
                <div style={{ marginTop: 20 }}>
                  <div style={S.fieldLabel}>Quick start</div>
                  <div style={S.termPreview}>
                    {selected.quickStartCommands.split('\n').filter(Boolean).map((cmd, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10 }}>
                        <span style={{ color: C.termGreen, userSelect: 'none' }}>$</span>
                        <span style={{ color: C.termText }}>{cmd}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16, fontSize: 11, color: C.faint, fontFamily: FONT.mono }}>
                {selected.image}
              </div>

              <ErrorMessage error={error} />
            </div>

            <div style={S.footer}>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
              <Button type="submit" variant="primary" size="sm" loading={loading} loadingLabel="Creating…">
                Create environment
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function StepPip({ n, active, done }) {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700,
      background: done ? C.green : active ? C.ink : C.chip,
      color: done || active ? C.inverse : C.faint,
      border: `1px solid ${done ? C.green : active ? C.ink : C.border}`,
      transition: 'all 0.18s',
      flexShrink: 0,
    }}>
      {done ? '✓' : n}
    </div>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ ...S.fieldLabel, display: 'block', marginBottom: 7 }}>
        {label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <div style={S.hint}>{hint}</div>}
    </div>
  )
}

const S = {
  modal: {
    width: '100%', maxWidth: 720,
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: R.xxl,
  },
  header: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '20px 22px 18px',
    borderBottom: `1px solid ${C.border}`,
  },
  steps: { display: 'flex', alignItems: 'center', gap: 0, paddingTop: 2, flexShrink: 0 },
  stepLine: {
    width: 32, height: 1, margin: '0 4px', transition: 'background 0.2s',
  },
  headerText: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  headerTitle: { fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' },
  headerSub: { fontSize: 12, color: C.muted },
  closeBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: C.faint, padding: 4, display: 'flex', alignItems: 'center', borderRadius: R.sm,
    flexShrink: 0,
  },
  body: { padding: '18px 22px', overflowY: 'auto', flex: 1 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
  },
  footer: {
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    padding: '14px 22px',
    borderTop: `1px solid ${C.border}`,
    background: C.modal, flexShrink: 0,
  },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' },
  resourceLabel: { fontSize: 10, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 },
  hint: { margin: '4px 0 0', fontSize: 11, color: C.faint, lineHeight: 1.4 },
  termPreview: {
    background: C.termBg, border: `1px solid ${C.border}`,
    borderRadius: R.lg, padding: '12px 14px',
    fontFamily: FONT.mono, fontSize: 11, lineHeight: 1.9, marginTop: 8,
  },
}
