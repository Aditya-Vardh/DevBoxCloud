import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workspaceApi } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { ErrorMessage } from '../components/ErrorMessage'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Button } from '../components/Button'
import { BrandMark } from '../components/BrandMark'
import { C, R, FONT } from '../theme'

export function WorkspacesPage() {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces]     = useState([])
  const [loadError, setLoadError]       = useState(null)
  const [loading, setLoading]           = useState(true)
  const [showCreate, setShowCreate]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { run: runCreate, loading: creating, error: createError } = useAsync()
  const { run: runDelete } = useAsync()

  useEffect(() => { loadWorkspaces() }, [])

  async function loadWorkspaces() {
    setLoading(true); setLoadError(null)
    try { setWorkspaces(await workspaceApi.list()) }
    catch (e) { setLoadError(e.message) }
    finally { setLoading(false) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const result = await runCreate(workspaceApi.create({
      name:        fd.get('name'),
      description: fd.get('description'),
    }))
    if (result) { setShowCreate(false); e.target.reset(); loadWorkspaces() }
  }

  async function handleDelete(id) {
    await runDelete(workspaceApi.delete(id))
    setDeleteTarget(null); loadWorkspaces()
  }

  return (
    <div className="page-enter" style={S.page}>

      <div style={S.topBar}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Studio</div>
          <h1 style={S.title}>Workspaces</h1>
          <p style={S.subtitle}>
            {loading ? 'Loading' : workspaces.length === 0
              ? 'No workspaces yet'
              : `${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button id="btn-new-workspace" variant="primary" size="sm"
          onClick={() => setShowCreate(true)}>
          New workspace
        </Button>
      </div>

      <ErrorMessage error={loadError} />

      {loading && (
        <div style={S.list}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: R.xl }} />
          ))}
        </div>
      )}

      {!loading && workspaces.length === 0 && (
        <div style={S.empty}>
          <div style={S.emptyMark}>
            <BrandMark size={28} />
          </div>
          <p style={S.emptyTitle}>Create your first workspace</p>
          <p style={S.emptyBody}>
            A workspace organises your development environments.
            Each can contain multiple runtimes and applications.
          </p>
          <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
            New workspace
          </Button>
        </div>
      )}

      {!loading && workspaces.length > 0 && (
        <div style={S.list}>
          {workspaces.map((ws, i) => (
            <WorkspaceRow
              key={ws.id}
              ws={ws}
              index={i}
              onOpen={() => navigate(`/workspaces/${ws.id}`)}
              onDelete={() => setDeleteTarget(ws)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-panel" style={S.modal}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>New workspace</div>
                <div style={S.modalSub}>Organise environments into a named group</div>
              </div>
              <button style={S.closeBtn} onClick={() => setShowCreate(false)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ padding: '18px 22px 22px' }}>
              <ModalField label="Name" required hint="Used to identify this workspace">
                <input className="ui-input" name="name" required autoFocus placeholder="e.g. my-project" />
              </ModalField>
              <ModalField label="Description">
                <input className="ui-input" name="description" placeholder="Optional" />
              </ModalField>
              <ErrorMessage error={createError} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" loading={creating} loadingLabel="Creating…">
                  Create workspace
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.name}"?`}
          message="This permanently removes the workspace and all associated Kubernetes resources. This cannot be undone."
          confirmLabel="Delete workspace"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function WorkspaceRow({ ws, onOpen, onDelete, index }) {
  const created = new Date(ws.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        ...S.row,
        borderBottom: `1px solid ${C.border}`,
        opacity: 0,
        animation: `fadeIn 0.35s var(--ease-out) ${index * 40}ms both`,
        background: hovered ? C.hover : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={S.rowLeft}>
        <div style={S.wsInitial}>{ws.name.charAt(0).toUpperCase()}</div>
        <div>
          <div style={S.wsName}>{ws.name}</div>
          <div style={S.wsMeta}>
            {ws.description && <span>{ws.description}</span>}
            {ws.description && ws.environmentCount > 0 && <span style={S.metaDot}>·</span>}
            {ws.environmentCount > 0 && <span>{ws.environmentCount} env{ws.environmentCount !== 1 ? 's' : ''}</span>}
            {(ws.description || ws.environmentCount > 0) && <span style={S.metaDot}>·</span>}
            <span>Created {created}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, opacity: hovered ? 1 : 0.55, transition: 'opacity 0.15s' }}>
        <Button variant="secondary" size="sm" onClick={onOpen}>Open</Button>
        <Button variant="ghost" size="sm" style={{ color: C.red }} onClick={onDelete}>Delete</Button>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ModalField({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
        {label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ marginTop: 4, fontSize: 11, color: C.faint }}>{hint}</div>}
    </div>
  )
}

const S = {
  page: { maxWidth: 860, margin: '0 auto', padding: '56px 28px' },
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 40, gap: 16,
  },
  title: { margin: 0, fontSize: 40, fontWeight: 400, color: C.ink, letterSpacing: '-0.04em', fontFamily: FONT.serif, lineHeight: 1 },
  subtitle: { margin: '10px 0 0', fontSize: 13, color: C.faint },
  list: { display: 'flex', flexDirection: 'column', marginTop: 4, borderTop: `1px solid ${C.border}` },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '18px 10px', cursor: 'default', borderRadius: R.lg,
  },
  rowLeft: { display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 },
  wsInitial: {
    width: 40, height: 40, borderRadius: R.lg, flexShrink: 0,
    background: C.chip, border: `1px solid ${C.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 500, color: C.ink, letterSpacing: '-0.01em',
    fontFamily: FONT.serif,
  },
  wsName: { fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em', marginBottom: 3 },
  wsMeta: { fontSize: 12, color: C.faint, display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' },
  metaDot: { color: C.border },

  empty: {
    padding: '72px 28px', textAlign: 'left',
    border: `1px solid ${C.border}`, borderRadius: R.xxl,
    marginTop: 8, background: C.bgSurface,
  },
  emptyMark: { marginBottom: 20 },
  emptyTitle: { margin: '0 0 8px', fontSize: 22, fontWeight: 400, color: C.ink, letterSpacing: '-0.03em', fontFamily: FONT.serif },
  emptyBody: { margin: '0 0 24px', fontSize: 14, color: C.muted, maxWidth: 420, lineHeight: 1.65 },

  modal: { width: '100%', maxWidth: 440, overflow: 'hidden' },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 22px 16px',
    borderBottom: `1px solid ${C.border}`,
  },
  modalTitle: { fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em', marginBottom: 2 },
  modalSub: { fontSize: 12, color: C.muted },
  closeBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: C.faint, padding: 4, display: 'flex', alignItems: 'center', borderRadius: R.sm,
    flexShrink: 0,
  },
}
