import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { workspaceApi, appApi, environmentApi } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NewEnvironmentModal } from '../components/NewEnvironmentModal'

const ENV_STATUS_COLORS = {
  PENDING:      '#6b7280',
  PROVISIONING: '#2563eb',
  RUNNING:      '#16a34a',
  STOPPED:      '#6b7280',
  FAILED:       '#dc2626',
  DELETING:     '#9333ea',
  DELETED:      '#d1d5db',
}

function EnvStatusBadge({ status }) {
  const color = ENV_STATUS_COLORS[status] || '#6b7280'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 12, fontWeight: 600, color: '#fff', backgroundColor: color,
    }}>
      {status ?? '—'}
    </span>
  )
}

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams()
  const navigate = useNavigate()

  const [workspace, setWorkspace]       = useState(null)
  const [environments, setEnvironments] = useState([])
  const [apps, setApps]                 = useState([])
  const [loading, setLoading]           = useState(true)
  const [loadError, setLoadError]       = useState(null)
  const [showNewEnv, setShowNewEnv]     = useState(false)
  const [showNewApp, setShowNewApp]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteType, setDeleteType]     = useState(null)  // 'env' | 'app'

  const { run: runCreateEnv, loading: creatingEnv, error: createEnvError } = useAsync()
  const { run: runCreateApp, loading: creatingApp, error: createAppError } = useAsync()
  const { run: runDelete } = useAsync()

  useEffect(() => { loadAll() }, [workspaceId])

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [ws, envs, appsData] = await Promise.all([
        workspaceApi.get(workspaceId),
        environmentApi.listByWorkspace(workspaceId),
        appApi.listByWorkspace(workspaceId),
      ])
      setWorkspace(ws)
      setEnvironments(envs)
      setApps(appsData)
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateEnv(data) {
    const result = await runCreateEnv(environmentApi.create(workspaceId, data))
    if (result) {
      setShowNewEnv(false)
      navigate(`/environments/${result.id}`)
    }
  }

  async function handleCreateApp(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const result = await runCreateApp(appApi.create(workspaceId, {
      name:          fd.get('name'),
      description:   fd.get('description'),
      sourcePath:    fd.get('sourcePath'),
      containerPort: parseInt(fd.get('containerPort') || '8080', 10),
      replicas:      parseInt(fd.get('replicas') || '1', 10),
    }))
    if (result) {
      setShowNewApp(false)
      e.target.reset()
      loadAll()
    }
  }

  async function handleDelete() {
    if (deleteType === 'env') {
      await runDelete(environmentApi.delete(deleteTarget.id))
    } else {
      await runDelete(appApi.delete(deleteTarget.id))
    }
    setDeleteTarget(null)
    setDeleteType(null)
    loadAll()
  }

  if (loading) return <div style={{ padding: 24 }}><Spinner /></div>
  if (loadError) return <div style={{ padding: 24 }}><ErrorMessage error={loadError} /></div>

  return (
    <div style={S.page}>
      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <Link to="/" style={S.link}>Workspaces</Link>
        {' / '}
        <span style={{ fontWeight: 600 }}>{workspace?.name}</span>
      </div>

      {/* Workspace header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>{workspace?.name}</h1>
          {workspace?.description && <p style={S.desc}>{workspace.description}</p>}
        </div>
        <button style={S.btnPrimary} onClick={() => setShowNewEnv(true)}>
          + New Environment
        </button>
      </div>

      {/* ── Environments (PRIMARY) ─────────────────────────────────────────── */}
      <h2 style={S.sectionTitle}>Environments</h2>

      {environments.length === 0 ? (
        <div style={S.emptyBox}>
          <p style={{ margin: '0 0 12px', color: '#6b7280' }}>
            No environments yet. Choose a template to create your first workspace.
          </p>
          <button style={S.btnPrimary} onClick={() => setShowNewEnv(true)}>
            + New Environment
          </button>
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              {['', 'Name', 'Template', 'Status', 'CPU / Memory', 'Access', 'Created', 'Actions'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {environments.map(env => (
              <tr key={env.id} style={S.tr}>
                <td style={{ ...S.td, fontSize: 20 }}>{env.templateIcon}</td>
                <td style={S.td}>
                  <Link to={`/environments/${env.id}`} style={S.link}>
                    {env.name}
                  </Link>
                  {env.description && (
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{env.description}</div>
                  )}
                </td>
                <td style={S.td}>{env.templateName}</td>
                <td style={S.td}><EnvStatusBadge status={env.status} /></td>
                <td style={S.td}>
                  <span style={{ fontSize: 12 }}>
                    {env.cpuRequest} / {env.memoryRequest}
                  </span>
                </td>
                <td style={S.td}>
                  {env.accessUrl ? (
                    <a href={env.accessUrl} target="_blank" rel="noreferrer"
                       style={{ ...S.link, fontSize: 12 }}>
                      Open Workspace ↗
                    </a>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>
                      {env.status === 'RUNNING' ? 'URL pending' : '—'}
                    </span>
                  )}
                </td>
                <td style={S.td}>{new Date(env.createdAt).toLocaleDateString()}</td>
                <td style={S.td}>
                  <button style={S.btnSmall}
                    onClick={() => navigate(`/environments/${env.id}`)}>
                    Manage
                  </button>
                  <button
                    style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => { setDeleteTarget(env); setDeleteType('env') }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Applications (SECONDARY — custom Docker deployments) ───────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 40 }}>
        <h2 style={{ ...S.sectionTitle, margin: 0 }}>Custom Application Deployments</h2>
        <button style={S.btnSecondary} onClick={() => setShowNewApp(true)}>
          + New Application
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 12px' }}>
        Deploy your own Dockerized applications from a local source path.
      </p>

      {apps.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>No custom applications yet.</p>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              {['Name', 'Status', 'Replicas', 'Port', 'Created', 'Actions'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apps.map(app => (
              <tr key={app.id} style={S.tr}>
                <td style={S.td}>
                  <Link to={`/applications/${app.id}`} style={S.link}>{app.name}</Link>
                  {app.description && (
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{app.description}</div>
                  )}
                </td>
                <td style={S.td}><StatusBadge status={app.deploymentStatus} /></td>
                <td style={S.td}>{app.replicas}</td>
                <td style={S.td}>{app.containerPort}</td>
                <td style={S.td}>{new Date(app.createdAt).toLocaleDateString()}</td>
                <td style={S.td}>
                  <button style={S.btnSmall}
                    onClick={() => navigate(`/applications/${app.id}`)}>
                    Manage
                  </button>
                  <button
                    style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => { setDeleteTarget(app); setDeleteType('app') }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* New Environment Modal */}
      {showNewEnv && (
        <NewEnvironmentModal
          onSubmit={handleCreateEnv}
          onCancel={() => setShowNewEnv(false)}
          loading={creatingEnv}
          error={createEnvError}
        />
      )}

      {/* New Application Modal (unchanged flow) */}
      {showNewApp && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h2 style={S.modalTitle}>New Application Deployment</h2>
            <form onSubmit={handleCreateApp}>
              <label style={S.label}>Name * (lowercase, hyphens only)</label>
              <input name="name" required style={S.input}
                pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]|[a-z0-9]" autoFocus />
              <label style={S.label}>Description</label>
              <input name="description" style={S.input} />
              <label style={S.label}>Source Path * (absolute path containing Dockerfile)</label>
              <input name="sourcePath" required style={S.input}
                placeholder="C:\projects\my-app" />
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Container Port</label>
                  <input name="containerPort" type="number" defaultValue="8080"
                    min="1" max="65535" style={S.input} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Replicas</label>
                  <input name="replicas" type="number" defaultValue="1"
                    min="1" max="50" style={S.input} />
                </div>
              </div>
              <ErrorMessage error={createAppError} />
              <div style={S.modalActions}>
                <button type="button" style={S.btnSecondary}
                  onClick={() => setShowNewApp(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={creatingApp}>
                  {creatingApp ? <Spinner size={14} /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          message={`Delete ${deleteType === 'env' ? 'environment' : 'application'} "${deleteTarget.name}"? This will remove all Kubernetes resources.`}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteType(null) }}
        />
      )}
    </div>
  )
}

const S = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '24px 16px' },
  breadcrumb: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  link: { color: '#2563eb', textDecoration: 'none' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { margin: '0 0 4px', fontSize: 22, fontWeight: 700 },
  desc: { margin: 0, color: '#6b7280', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#111827' },
  emptyBox: {
    background: '#f9fafb', border: '1px dashed #d1d5db',
    borderRadius: 8, padding: '24px 20px',
  },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 4 },
  th: {
    textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600,
    borderBottom: '2px solid #e5e7eb', color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 10px', fontSize: 14, verticalAlign: 'middle' },
  btnPrimary: {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500,
  },
  btnSecondary: {
    padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db',
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
