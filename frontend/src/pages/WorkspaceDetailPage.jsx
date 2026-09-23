import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { workspaceApi, appApi, environmentApi } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NewEnvironmentModal } from '../components/NewEnvironmentModal'
import { Button } from '../components/Button'
import { C, R, SHADOW, TEMPLATE_ACCENT } from '../theme'

function getDesktopUrl(env) {
  if (!env?.accessUrl) return null
  return env.desktopUrl || (env.accessUrl.replace(/\/+$/, '') + '/desktop/vnc.html?autoconnect=true&path=websockify')
}

function getTerminalUrl(env) {
  if (!env?.accessUrl) return null
  return env.terminalUrl || (env.accessUrl.replace(/\/+$/, '') + '/terminal/')
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
  const [deleteType, setDeleteType]     = useState(null)

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
    if (deleteType === 'env') await runDelete(environmentApi.delete(deleteTarget.id))
    else await runDelete(appApi.delete(deleteTarget.id))
    setDeleteTarget(null)
    setDeleteType(null)
    loadAll()
  }

  if (loading) return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '32px 20px' }}>
      <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 36, width: 280, marginBottom: 32 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: R.lg }} />)}
      </div>
    </div>
  )

  if (loadError) return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '32px 20px' }}>
      <ErrorMessage error={loadError} />
    </div>
  )

  const runningCount = environments.filter(e => e.status === 'RUNNING').length

  return (
    <div className="page-enter" style={S.page}>

      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <Link to="/" style={S.breadcrumbLink}>Workspaces</Link>
        <span style={S.breadcrumbSep}>/</span>
        <span style={{ color: C.body, fontWeight: 500 }}>{workspace?.name}</span>
      </div>

      {/* Workspace header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>{workspace?.name}</h1>
          {workspace?.description && <p style={S.desc}>{workspace.description}</p>}
          {runningCount > 0 && (
            <div style={S.runningPill}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
              {runningCount} environment{runningCount !== 1 ? 's' : ''} running
            </div>
          )}
        </div>
        <Button variant="primary" size="md" onClick={() => setShowNewEnv(true)}>
          + New Environment
        </Button>
      </div>

      {/* Environments */}
      <div style={S.sectionHeader}>
        <h2 style={S.sectionTitle}>Environments</h2>
        <span style={S.sectionCount}>{environments.length}</span>
      </div>

      {environments.length === 0 ? (
        <div style={S.emptyState}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.35 }}>&#9633;</div>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: C.ink, fontSize: 14 }}>No environments yet</p>
          <p style={{ margin: '0 0 16px', color: C.muted, fontSize: 13 }}>
            Choose a template to create your first development workspace.
          </p>
          <Button variant="primary" onClick={() => setShowNewEnv(true)}>
            + New Environment
          </Button>
        </div>
      ) : (
        <div style={S.envGrid}>
          {environments.map(env => (
            <EnvironmentCard
              key={env.id}
              env={env}
              onManage={() => navigate(`/environments/${env.id}`)}
              onDelete={() => { setDeleteTarget(env); setDeleteType('env') }}
            />
          ))}
        </div>
      )}

      {/* Custom Applications */}
      <div style={{ ...S.sectionHeader, marginTop: 40 }}>
        <div>
          <h2 style={S.sectionTitle}>Custom Applications</h2>
          <p style={S.sectionSubtitle}>Deploy your own Dockerized applications from a local source path.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowNewApp(true)}>
          + New Application
        </Button>
      </div>

      {apps.length === 0 ? (
        <p style={{ color: C.faint, fontSize: 13, margin: '8px 0 0' }}>No custom applications yet.</p>
      ) : (
        <div style={S.appsTable}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Status', 'Replicas', 'Port', 'Created', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.id} style={S.tr}>
                  <td style={S.td}>
                    <Link to={`/applications/${app.id}`} style={{ color: C.primary, fontWeight: 500 }}>
                      {app.name}
                    </Link>
                    {app.description && <div style={{ fontSize: 12, color: C.faint }}>{app.description}</div>}
                  </td>
                  <td style={S.td}><StatusBadge status={app.deploymentStatus} /></td>
                  <td style={S.td}>{app.replicas}</td>
                  <td style={S.td}>{app.containerPort}</td>
                  <td style={S.td}>{new Date(app.createdAt).toLocaleDateString()}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <Button size="sm" variant="secondary" style={{ marginRight: 6 }}
                      onClick={() => navigate(`/applications/${app.id}`)}>
                      Manage
                    </Button>
                    <Button size="sm" variant="danger"
                      onClick={() => { setDeleteTarget(app); setDeleteType('app') }}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {/* New Application Modal */}
      {showNewApp && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowNewApp(false)}>
          <div style={S.appModal}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>New Application Deployment</h2>
              <button style={S.closeBtn} onClick={() => setShowNewApp(false)} aria-label="Close">x</button>
            </div>
            <form onSubmit={handleCreateApp} style={{ padding: '20px 24px 24px' }}>
              <label style={S.label}>
                Name <span style={{ color: C.red }}>*</span> (lowercase, hyphens only)
              </label>
              <input name="name" required style={S.input}
                pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]|[a-z0-9]" autoFocus />

              <label style={S.label}>Description</label>
              <input name="description" style={S.input} />

              <label style={S.label}>Source Path <span style={{ color: C.red }}>*</span></label>
              <input name="sourcePath" required style={S.input} placeholder="C:\projects\my-app" />
              <p style={S.hint}>Absolute path to a directory containing a Dockerfile.</p>

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

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <Button type="button" variant="secondary" onClick={() => setShowNewApp(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={creatingApp} loadingLabel="Creating...">
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteType === 'env' ? 'environment' : 'application'} "${deleteTarget.name}"?`}
          message="This will permanently remove all Kubernetes resources. The workspace storage will also be deleted."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteType(null) }}
        />
      )}
    </div>
  )
}

// ── Environment card ──────────────────────────────────────────────────────────

function EnvironmentCard({ env, onManage, onDelete }) {
  const accent = TEMPLATE_ACCENT[env.templateId] || TEMPLATE_ACCENT.ubuntu
  const desktopHref  = getDesktopUrl(env)
  const terminalHref = getTerminalUrl(env)
  const isReady = env.status === 'RUNNING' && !!env.accessUrl

  return (
    <div style={{ ...S.envCard, borderTop: `3px solid ${accent.color}` }}>

      {/* Header: icon + name + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 22, width: 36, height: 36,
            background: accent.bg, border: `1px solid ${accent.border}`,
            borderRadius: R.md, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {env.templateIcon}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>
              <Link to={`/environments/${env.id}`} style={{ color: C.ink, textDecoration: 'none' }}>
                {env.name}
              </Link>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{env.templateName}</div>
          </div>
        </div>
        <StatusBadge status={env.status} />
      </div>

      {/* Resources */}
      <div style={S.envResRow}>
        <ResourcePill label="CPU"  value={env.cpuRequest} />
        <ResourcePill label="RAM"  value={env.memoryRequest} />
        <ResourcePill label="Disk" value={env.storageSize} />
      </div>

      {/* Access actions */}
      <div style={S.envActions}>
        {isReady ? (
          <>
            {/* Workspace landing page — template-specific identity page */}
            <a href={env.accessUrl} target="_blank" rel="noreferrer" style={{
              ...S.accessBtn, background: accent.color, borderColor: accent.color,
            }}>
              Workspace
            </a>
            {/* Browser terminal */}
            <a href={terminalHref} target="_blank" rel="noreferrer" style={{
              ...S.accessBtn, background: '#1e293b', borderColor: '#334155',
            }}>
              Terminal
            </a>
            {/* XFCE desktop via noVNC */}
            <a href={desktopHref} target="_blank" rel="noreferrer" style={{
              ...S.accessBtn, background: '#475569', borderColor: '#475569',
            }}>
              Desktop
            </a>
          </>
        ) : env.status === 'PROVISIONING' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.amberText }}>
            <Spinner size={12} color={C.amber} /> Starting...
          </span>
        ) : (
          <span style={{ fontSize: 12, color: C.faint }}>
            {env.status === 'STOPPED'
              ? 'Stopped — Start to access'
              : env.status === 'RUNNING'
              ? 'Connecting...'
              : '—'}
          </span>
        )}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <Button size="sm" variant="secondary" onClick={onManage}>Manage</Button>
          <Button size="sm" variant="ghost" style={{ color: C.red }} onClick={onDelete}>x</Button>
        </div>
      </div>
    </div>
  )
}

function ResourcePill({ label, value }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: C.bgSubtle, borderRadius: R.sm,
      padding: '4px 10px', gap: 1,
    }}>
      <span style={{ fontSize: 11, color: C.faint, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, color: C.body, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const S = {
  page:           { maxWidth: 1060, margin: '0 auto', padding: '28px 20px' },
  breadcrumb:     { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, marginBottom: 16 },
  breadcrumbLink: { color: C.muted, textDecoration: 'none' },
  breadcrumbSep:  { color: C.border, fontSize: 16 },
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 16 },
  title:          { margin: 0, fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' },
  desc:           { margin: '4px 0 0', fontSize: 13, color: C.muted },
  runningPill: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    marginTop: 8, padding: '3px 10px',
    background: C.greenLight, border: `1px solid ${C.greenBorder}`,
    borderRadius: R.full, fontSize: 12, color: C.greenText, fontWeight: 500,
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, gap: 8,
  },
  sectionTitle:    { margin: 0, fontSize: 15, fontWeight: 700, color: C.ink },
  sectionSubtitle: { margin: '2px 0 0', fontSize: 12, color: C.faint },
  sectionCount: {
    background: C.bgSubtle, border: `1px solid ${C.border}`,
    borderRadius: R.full, padding: '1px 8px',
    fontSize: 12, fontWeight: 600, color: C.muted,
  },
  envGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 14,
  },
  envCard: {
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: R.lg, padding: '16px',
    boxShadow: SHADOW.sm, display: 'flex', flexDirection: 'column', gap: 0,
  },
  envResRow:  { display: 'flex', gap: 6, marginBottom: 12 },
  envActions: {
    display: 'flex', alignItems: 'center', gap: 6,
    paddingTop: 10, borderTop: `1px solid ${C.divider}`, marginTop: 4,
  },
  accessBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 11px', borderRadius: R.sm,
    color: '#fff', fontWeight: 600, fontSize: 11,
    textDecoration: 'none', border: '1px solid transparent',
    letterSpacing: '0.01em',
  },
  emptyState: {
    padding: '32px 20px', border: `1px dashed ${C.border}`,
    borderRadius: R.lg, background: C.bgSurface, textAlign: 'center',
  },
  appsTable: {
    border: `1px solid ${C.border}`, borderRadius: R.lg,
    overflow: 'hidden', marginTop: 8,
  },
  th: {
    textAlign: 'left', padding: '9px 14px',
    fontSize: 11, fontWeight: 600, color: C.muted,
    background: C.bgSurface, borderBottom: `1px solid ${C.border}`,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  tr: { borderBottom: `1px solid ${C.divider}` },
  td: { padding: '10px 14px', fontSize: 13, verticalAlign: 'middle' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 16, animation: 'fadeIn 0.12s ease both',
  },
  appModal: {
    background: C.bg, borderRadius: R.xl, width: '100%', maxWidth: 520,
    boxShadow: SHADOW.modal, animation: 'modalIn 0.15s ease both', overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px 16px', borderBottom: `1px solid ${C.divider}`,
  },
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: C.ink },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 16, color: C.faint, padding: '0 4px', lineHeight: 1,
  },
  label: {
    display: 'block', fontSize: 13, fontWeight: 500,
    color: C.body, marginBottom: 5, marginTop: 16,
  },
  input: {
    width: '100%', padding: '8px 11px', borderRadius: R.md,
    border: `1px solid ${C.borderStrong}`, fontSize: 14,
    color: C.ink, background: C.bg, boxSizing: 'border-box', fontFamily: 'inherit',
  },
  hint: { margin: '4px 0 0', fontSize: 12, color: C.faint },
}
