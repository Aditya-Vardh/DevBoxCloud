import { useState, useEffect } from 'react'
import { templateApi } from '../api/client'
import { TemplateCard } from './TemplateCard'
import { ErrorMessage } from './ErrorMessage'
import { Spinner } from './Spinner'

/**
 * Two-step modal:
 *  Step 1 — Choose a template (6 cards)
 *  Step 2 — Configure name, CPU, memory, storage
 *
 * Props:
 *  onSubmit(formData)  — called with { name, description, templateId, cpuRequest, memoryRequest, storageSize }
 *  onCancel()
 *  loading             — show spinner on submit button
 *  error               — API error string
 */
export function NewEnvironmentModal({ onSubmit, onCancel, loading, error }) {
  const [step, setStep]               = useState(1)
  const [templates, setTemplates]     = useState([])
  const [tmplLoading, setTmplLoading] = useState(true)
  const [tmplError, setTmplError]     = useState(null)
  const [selected, setSelected]       = useState(null)

  useEffect(() => {
    templateApi.list()
      .then(setTemplates)
      .catch(e => setTmplError(e.message))
      .finally(() => setTmplLoading(false))
  }, [])

  function handleTemplateSelect(t) {
    setSelected(t)
  }

  function handleNext() {
    if (!selected) return
    setStep(2)
  }

  function handleBack() {
    setStep(1)
  }

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
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <h2 style={S.title}>
            {step === 1 ? 'New Environment — Choose Template' : `Configure — ${selected?.displayName}`}
          </h2>
          <button onClick={onCancel} style={S.closeBtn} aria-label="Close">✕</button>
        </div>

        {/* Step 1: template grid */}
        {step === 1 && (
          <>
            <ErrorMessage error={tmplError} />
            {tmplLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><Spinner size={24} /></div>
            ) : (
              <div style={S.grid}>
                {templates.map(t => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selected={selected?.id === t.id}
                    onSelect={handleTemplateSelect}
                  />
                ))}
              </div>
            )}
            <div style={S.footer}>
              <button style={S.btnSecondary} onClick={onCancel}>Cancel</button>
              <button
                style={{ ...S.btnPrimary, opacity: selected ? 1 : 0.5 }}
                disabled={!selected}
                onClick={handleNext}
              >
                Next: Configure →
              </button>
            </div>
          </>
        )}

        {/* Step 2: configuration form */}
        {step === 2 && selected && (
          <form onSubmit={handleSubmit}>
            <div style={S.selectedBadge}>
              {selected.icon} {selected.displayName}
              <span style={S.imgTag}>{selected.image}</span>
            </div>

            <label style={S.label}>Environment Name * (lowercase, hyphens only)</label>
            <input
              name="name" required autoFocus
              style={S.input}
              placeholder="my-dev-env"
              pattern="^[a-z0-9][a-z0-9\-]*[a-z0-9]$|^[a-z0-9]$"
              title="Lowercase alphanumeric and hyphens only"
            />

            <label style={S.label}>Description</label>
            <input name="description" style={S.input} placeholder="Optional" />

            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>CPU Request</label>
                <input name="cpuRequest" style={S.input}
                  placeholder={selected.defaultCpu}
                  defaultValue={selected.defaultCpu} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Memory Request</label>
                <input name="memoryRequest" style={S.input}
                  placeholder={selected.defaultMemory}
                  defaultValue={selected.defaultMemory} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Storage</label>
                <input name="storageSize" style={S.input}
                  placeholder={selected.defaultStorage}
                  defaultValue={selected.defaultStorage} />
              </div>
            </div>

            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
              Port: {selected.containerPort} &nbsp;·&nbsp;
              Max CPU: {selected.maxCpu} &nbsp;·&nbsp;
              Max Memory: {selected.maxMemory}
            </div>

            <ErrorMessage error={error} />

            <div style={S.footer}>
              <button type="button" style={S.btnSecondary} onClick={handleBack}>← Back</button>
              <button type="submit" style={S.btnPrimary} disabled={loading}>
                {loading ? <Spinner size={14} /> : 'Create Environment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 10,
    width: '100%', maxWidth: 720,
    maxHeight: '92vh', overflowY: 'auto',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px 12px', borderBottom: '1px solid #f3f4f6',
  },
  title: { margin: 0, fontSize: 17, fontWeight: 700 },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 18, color: '#9ca3af', padding: '0 4px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12, padding: '16px 24px',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '16px 24px', borderTop: '1px solid #f3f4f6', marginTop: 'auto',
  },
  selectedBadge: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#eff6ff', borderRadius: 6, padding: '8px 12px',
    margin: '16px 24px 0', fontSize: 14, fontWeight: 600, color: '#1d4ed8',
  },
  imgTag: {
    marginLeft: 'auto', fontSize: 11, fontWeight: 400,
    color: '#6b7280', fontFamily: 'monospace',
  },
  label: {
    display: 'block', fontSize: 13, fontWeight: 500,
    margin: '12px 24px 4px', color: '#374151',
  },
  input: {
    display: 'block', width: 'calc(100% - 48px)',
    margin: '0 24px', padding: '8px 10px',
    borderRadius: 6, border: '1px solid #d1d5db',
    fontSize: 14, boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '8px 18px', borderRadius: 6, border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer',
    fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
  },
  btnSecondary: {
    padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: 14,
  },
}
