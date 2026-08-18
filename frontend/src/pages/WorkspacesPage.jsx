import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workspaceApi } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function WorkspacesPage() {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
  const [loadError, setLoadError]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
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
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>DevBox — Workspaces</h1>
        <button style={styles.btnPrimary} onClick={() => setShowCreate(true)}>
          + New Workspace
        </button>
      </div>

      <ErrorMessage error={loadError} />

      {loading && <Spinner />}

      {!loading && workspaces.length === 0 && (
        <p style={{ color: '#6b7280', marginTop: 20 }}>
          No workspaces yet. Create one to get started.
        </p>
      )}

      <div style={styles.grid}>
        {workspaces.map(ws => (
          <div key={ws.id} style={styles.card}>
            <div style={{ flex: 1 }}>
              <div style={styles.cardTitle}>{ws.name}</div>
              {ws.description && (
                <div style={styles.cardDesc}>{ws.description}</div>
              )}
              <div style={styles.cardMeta}>
                {ws.applicationCount} application{ws.applicationCount !== 1 ? 's' : ''}
                &nbsp;·&nbsp;
                Created {new Date(ws.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div style={styles.cardActions}>
              <button
                style={styles.btnSecondary}
                onClick={() => navigate(`/workspaces/${ws.id}`)}
              >
                Open
              </button>
              <button
                style={styles.btnDanger}
                onClick={() => setDeleteTarget(ws)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>New Workspace</h2>
            <form onSubmit={handleCreate}>
              <label style={styles.label}>Name *</label>
              <input name="name" required style={styles.input}
                placeholder="my-workspace" autoFocus />

              <label style={styles.label}>Description</label>
              <input name="description" style={styles.input}
                placeholder="Optional description" />

              <ErrorMessage error={createError} />

              <div style={styles.modalActions}>
                <button type="button" style={styles.btnSecondary}
                  onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" style={styles.btnPrimary} disabled={creating}>
                  {creating ? <Spinner size={14} /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          message={`Delete workspace "${deleteTarget.name}"? This will also delete all its applications and Kubernetes resources.`}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

const styles = {
  page: { maxWidth: 900, margin: '0 auto', padding: '24px 16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { margin: 0, fontSize: 22, fontWeight: 700 },
  grid: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 },
  card: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '14px 16px', background: '#f9fafb',
    border: '1px solid #e5e7eb', borderRadius: 8,
  },
  cardTitle: { fontWeight: 600, fontSize: 16 },
  cardDesc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  cardMeta: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  cardActions: { display: 'flex', gap: 8, flexShrink: 0 },
  btnPrimary: {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14,
  },
  btnSecondary: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: 13,
  },
  btnDanger: {
    padding: '6px 14px', borderRadius: 6, border: 'none',
    background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 13,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#fff', borderRadius: 10, padding: 28,
    width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  modalTitle: { margin: '0 0 18px', fontSize: 18 },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, marginTop: 12 },
  input: {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box',
  },
}
