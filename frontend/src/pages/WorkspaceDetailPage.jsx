import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { workspaceApi, appApi } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams()
  const navigate = useNavigate()

  const [workspace, setWorkspace]   = useState(null)
  const [apps, setApps]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { run: runCreate, loading: creating, error: createError } = useAsync()
  const { run: runDelete } = useAsync()

  useEffect(() => { loadAll() }, [workspaceId])

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [ws, appsData] = await Promise.all([
        workspaceApi.get(workspaceId),
        appApi.listByWorkspace(workspaceId),
      ])
      setWorkspace(ws)
      setApps(appsData)
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const result = await runCreate(appApi.create(workspaceId, {
      name:          fd.get('name'),
      description:   fd.get('description'),
      sourcePath:    fd.get('sourcePath'),
      containerPort: parseInt(fd.get('containerPort') || '8080', 10),
      replicas:      parseInt(fd.get('replicas') || '1', 10),
    }))
    if (result) {
      setShowCreate(false)
      e.target.reset()
      loadAll()
    }
  }

  async function handleDelete(id) {
    await runDelete(appApi.delete(id))
    setDeleteTarget(null)
    loadAll()
  }

  if (loading) return <div style={{ padding: 24 }}><Spinner /></div>
  if (loadError) return <div style={{ padding: 24 }}><ErrorMessage error={loadError} /></div>

  return (
    <div style={styles.page}>
      <div style={styles.breadcrumb}>
        <Link to="/" style={styles.link}>Workspaces</Link>
        <span> / </span>
        <span style={{ fontWeight: 600 }}>{workspace?.name}</span>
      </div>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{workspace?.name}</h1>
          {workspace?.description && (
            <p style={styles.desc}>{workspace.description}</p>
          )}
        </div>
        <button style={styles.btnPrimary} onClick={() => setShowCreate(true)}>
          + New Application
        </button>
      </div>

      {apps.length === 0 && (
        <p style={{ color: '#6b7280', marginTop: 20 }}>
          No applications yet. Create one to get started.
        </p>
      )}

      <table style={styles.table}>
        {apps.length > 0 && (
          <thead>
            <tr>
              {['Name', 'Status', 'Replicas', 'Port', 'Created', 'Actions'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {apps.map(app => (
            <tr key={app.id} style={styles.tr}>
              <td style={styles.td}>
                <Link to={`/applications/${app.id}`} style={styles.link}>
                  {app.name}
                </Link>
                {app.description && (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{app.description}</div>
                )}
              </td>
              <td style={styles.td}><StatusBadge status={app.deploymentStatus} /></td>
              <td style={styles.td}>{app.replicas}</td>
              <td style={styles.td}>{app.containerPort}</td>
              <td style={styles.td}>{new Date(app.createdAt).toLocaleDateString()}</td>
              <td style={styles.td}>
                <button
                  style={styles.btnSmall}
                  onClick={() => navigate(`/applications/${app.id}`)}
                >
                  Manage
                </button>
                <button
                  style={{ ...styles.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }}
                  onClick={() => setDeleteTarget(app)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Create modal */}
      {showCreate && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>New Application</h2>
            <form onSubmit={handleCreate}>
              <label style={styles.label}>Name * (lowercase, hyphens only)</label>
              <input name="name" required style={styles.input}
                placeholder="my-app" pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]|[a-z0-9]"
                title="Lowercase alphanumeric and hyphens only" autoFocus />

              <label style={styles.label}>Description</label>
              <input name="description" style={styles.input} />

              <label style={styles.label}>Source Path * (absolute path with Dockerfile)</label>
              <input name="sourcePath" required style={styles.input}
                placeholder="C:\projects\my-app or /home/user/my-app" />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Container Port</label>
                  <input name="containerPort" type="number" defaultValue="8080"
                    min="1" max="65535" style={styles.input} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Replicas</label>
                  <input name="replicas" type="number" defaultValue="1"
                    min="1" max="50" style={styles.input} />
                </div>
              </div>

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

      {deleteTarget && (
        <ConfirmDialog
          message={`Delete application "${deleteTarget.name}"? This will remove all Kubernetes resources.`}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

const styles = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '24px 16px' },
  breadcrumb: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  link: { color: '#2563eb', textDecoration: 'none' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { margin: '0 0 4px', fontSize: 22, fontWeight: 700 },
  desc: { margin: 0, color: '#6b7280', fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 8 },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: 13, fontWeight: 600,
        borderBottom: '2px solid #e5e7eb', color: '#374151' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 10px', fontSize: 14, verticalAlign: 'middle' },
  btnPrimary: {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14,
  },
  btnSecondary: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: 13,
  },
  btnSmall: {
    padding: '4px 10px', borderRadius: 4, border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: 12, marginRight: 6,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#fff', borderRadius: 10, padding: 28,
    width: 500, maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  modalTitle: { margin: '0 0 18px', fontSize: 18 },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, marginTop: 12 },
  input: {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box',
  },
}
