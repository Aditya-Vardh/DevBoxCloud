import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workspaceApi } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Button } from '../components/Button'
import { C, R, SHADOW } from '../theme'

export function WorkspacesPage() {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces]     = useState([])
  const [loadError, setLoadError]       = useState(null)
  const [loading, setLoading]           = useState(true)
  const [showCreate, setShowCreate]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { run: runCreate, loading: creating, error: createError } = useAsync()
  const { run: runDelete, loading: deleting } = useAsync()

  useEffect(() => { loadWorkspaces() }, [])

  async function loadWorkspaces() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await workspaceApi.list()
      setWorkspaces(data)
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const result = await runCreate(workspaceApi.create({
      name: fd.get('name'),
      description: fd.get('description'),
    }))
    if (result) {
      setShowCreate(false)
      e.target.reset()
      loadWorkspaces()
    }
  }

  async function handleDelete(id) {
    await runDelete(workspaceApi.delete(id))
    setDeleteTarget(null)
    loadWorkspaces()
  }

  return (
    <div className="page-enter" style={S.page}>

      {/* Top bar */}
      <div style={S.topBar}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>⬡</span>
            <h1 style={S.title}>DevBox</h1>
          </div>
          <p style={S.subtitle}>Cloud development workspaces</p>
        </div>
        <Button variant="primary" size="lg" icon="+" onClick={() => setShowCreate(true)}>
          New Workspace
        </Button>
      </div>

      <ErrorMessage error={loadError} />

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 76, borderRadius: R.lg }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && workspaces.length === 0 && (
        <div style={S.emptyState}>
          <div style={S.emptyIcon}>⬡</div>
          <h2 style={S.emptyTitle}>No workspaces yet</h2>
          <p style={S.emptyDesc}>
            Create a workspace to organize your development environments.
            Each workspace can contain multiple environments using different runtimes.
          </p>
          <Button variant="primary" size="lg" onClick={() => setShowCreate(true)}>
            Create your first workspace
          </Button>
        </div>
      )}

      {/* Workspace list */}
      {!loading && workspaces.length > 0 && (
        <div style={S.list}>
          {workspaces.map(ws => (
            <WorkspaceCard
              key={ws.id}
              ws={ws}
              onOpen={() => navigate(`/workspaces/${ws.id}`)}
              onDelete={() => setDeleteTarget(ws)}
            />
          ))}
        </div>
      )}

      {/* Create workspace modal */}
      {showCreate && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>New Workspace</h2>
              <button style={S.closeBtn} onClick={() => setShowCreate(false)} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ padding: '20px 24px 24px' }}>
              <label style={S.label}>Name <span style={{ color: C.red }}>*</span></label>
              <input
                name="name" required autoFocus
                style={S.input}
                placeholder="e.g. my-project"
              />
              <p style={S.hint}>Used to organise your environments. Can contain any characters.</p>

              <label style={S.label}>Description</label>
              <input
                name="description"
                style={S.input}
                placeholder="What are you building? (optional)"
              />

              <ErrorMessage error={createError} />

              <div style={S.modalFooter}>
                <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={creating} loadingLabel="Creating…">
                  Create Workspace
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.name}"?`}
          message="This will permanently delete the workspace and all its Kubernetes resources. This action cannot be undone."
          confirmLabel={deleting ? 'Deleting…' : 'Delete Workspace'}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function WorkspaceCard({ ws, onOpen, onDelete }) {
  const created = new Date(ws.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div style={S.card}>
      {/* Left: icon + info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        <div style={S.wsIcon}>
          {ws.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={S.wsName}>{ws.name}</div>
          {ws.description && (
            <div style={S.wsDesc}>{ws.description}</div>
          )}
          <div style={S.wsMeta}>
            <span>Created {created}</span>
            {ws.applicationCount > 0 && (
              <>
                <span style={S.metaDot}>·</span>
                <span>{ws.applicationCount} application{ws.applicationCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button variant="primary" size="sm" onClick={onOpen}>
          Open
        </Button>
        <Button variant="ghost" size="sm" style={{ color: C.red }} onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  )
}

const S = {
  page: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '32px 20px',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: C.ink,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: C.muted,
    marginTop: 2,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '14px 18px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: R.lg,
    boxShadow: SHADOW.sm,
    transition: 'box-shadow 0.15s, border-color 0.15s',
  },
  wsIcon: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    background: C.primaryLight,
    color: C.primaryText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
    border: `1px solid ${C.primaryBorder}`,
  },
  wsName: {
    fontWeight: 600,
    fontSize: 14,
    color: C.ink,
    marginBottom: 1,
  },
  wsDesc: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 420,
  },
  wsMeta: {
    fontSize: 12,
    color: C.faint,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  metaDot: {
    color: C.border,
  },

  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: '64px 24px',
    border: `1px dashed ${C.border}`,
    borderRadius: R.xl,
    background: C.bgSurface,
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 16,
    color: C.border,
  },
  emptyTitle: {
    margin: '0 0 8px',
    fontSize: 18,
    fontWeight: 700,
    color: C.ink,
  },
  emptyDesc: {
    margin: '0 0 24px',
    fontSize: 14,
    color: C.muted,
    maxWidth: 400,
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: 1.6,
  },

  // Modal
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 16,
    animation: 'fadeIn 0.12s ease both',
  },
  modal: {
    background: C.bg,
    borderRadius: R.xl,
    width: '100%',
    maxWidth: 440,
    boxShadow: SHADOW.modal,
    animation: 'modalIn 0.15s ease both',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px 16px',
    borderBottom: `1px solid ${C.divider}`,
  },
  modalTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: C.ink,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: C.faint,
    padding: '0 4px',
    lineHeight: 1,
  },
  modalFooter: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: C.body,
    marginBottom: 5,
    marginTop: 16,
  },
  input: {
    width: '100%',
    padding: '8px 11px',
    borderRadius: R.md,
    border: `1px solid ${C.borderStrong}`,
    fontSize: 14,
    color: C.ink,
    background: C.bg,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  hint: {
    margin: '4px 0 0',
    fontSize: 12,
    color: C.faint,
  },
}
