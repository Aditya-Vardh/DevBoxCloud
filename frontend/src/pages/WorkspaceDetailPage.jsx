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
import { C, R, FONT, TEMPLATE_ACCENT } from '../theme'

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

  useEffect(() => {
    loadAll()
    const timer = setInterval(() => {
      environmentApi.listByWorkspace(workspaceId).then(setEnvironments).catch(() => {})
    }, 8000)
    return () => clearInterval(timer)
  }, [workspaceId])

  async function loadAll() {
    setLoading(true); setLoadError(null)
    try {
      const [ws, envs, appsData] = await Promise.all([
        workspaceApi.get(workspaceId),
        environmentApi.listByWorkspace(workspaceId),
        appApi.listByWorkspace(workspaceId),
      ])
      setWorkspace(ws); setEnvironments(envs); setApps(appsData)
    } catch (e) { setLoadError(e.message) }
    finally { setLoading(false) }
  }

  async function handleCreateEnv(data) {
    const result = await runCreateEnv(environmentApi.create(workspaceId, data))
    if (result) { setShowNewEnv(false); navigate(`/environments/${result.id}`) }
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
    if (result) { setShowNewApp(false); e.target.reset(); loadAll() }
  }

  async function handleDelete() {
    if (deleteType === 'env') await runDelete(environmentApi.delete(deleteTarget.id))
    else await runDelete(appApi.delete(deleteTarget.id))
    setDeleteTarget(null); setDeleteType(null); loadAll()
  }

  if (loading) return (
    <div style={S.page}>
      <div className="skeleton" style={{ height: 16, width: 200, marginBottom: 32, borderRadius: R.md }} />
      <div className="skeleton" style={{ height: 32, width: 280, marginBottom: 40, borderRadius: R.lg }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: R.xl }} />)}
      </div>
    </div>
  )
  if (loadError) return (
    <div style={S.page}><ErrorMessage error={loadError} /></div>
  )

  return (
    <div className="page-enter" style={S.page}>

      <div style={S.breadcrumb}>
        <Link to="/workspaces" style={S.bcLink}>Workspaces</Link>
        <span style={S.bcSep}>/</span>
        <span style={{ color: C.body }}>{workspace?.name}</span>
      </div>

      <div style={S.header}>
        <div>
          <h1 style={S.title}>{workspace?.name}</h1>
          {workspace?.description && <p style={S.desc}>{workspace.description}</p>}
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowNewEnv(true)}>
          New environment
        </Button>
      </div>

      <Section
        title="Environments"
        count={environments.length}
        action={<Button variant="ghost" size="sm" onClick={() => setShowNewEnv(true)}>Add</Button>}
      >
        {environments.length === 0
          ? <EmptySection text="No environments yet. Create one to get started." />
          : <div style={S.envGrid}>
              {environments.map((env, i) => (
                <EnvironmentCard
                  key={env.id} env={env} index={i}
                  onManage={() => navigate(`/environments/${env.id}`)}
                  onDelete={() => { setDeleteTarget(env); setDeleteType('env') }}
                />
              ))}
            </div>
        }
      </Section>

      <Section
        title="Custom applications"
        count={apps.length}
        action={<Button variant="ghost" size="sm" onClick={() => setShowNewApp(true)}>Add</Button>}
        style={{ marginTop: 48 }}
      >
        {apps.length === 0
          ? <EmptySection text="No custom applications yet." />
          : <div style={S.appsTable}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Name', 'Status', 'Replicas', 'Port', ''].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apps.map(app => (
                    <tr key={app.id} style={S.tr}>
                      <td style={S.td}>
                        <Link to={`/applications/${app.id}`} style={{ color: C.ink, fontWeight: 600, fontSize: 13 }}>
                          {app.name}
                        </Link>
                        {app.description && <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{app.description}</div>}
                      </td>
                      <td style={S.td}><StatusBadge status={app.deploymentStatus} /></td>
                      <td style={S.td}>{app.replicas}</td>
                      <td style={S.td}>{app.containerPort}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/applications/${app.id}`)}>Manage</Button>
                        <Button size="sm" variant="ghost" style={{ color: C.red, marginLeft: 4 }}
                          onClick={() => { setDeleteTarget(app); setDeleteType('app') }}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </Section>

      {showNewEnv && (
        <NewEnvironmentModal
          onSubmit={handleCreateEnv}
          onCancel={() => setShowNewEnv(false)}
          loading={creatingEnv}
          error={createEnvError}
        />
      )}

      {showNewApp && (
        <AppModal
          onSubmit={handleCreateApp}
          onClose={() => setShowNewApp(false)}
          loading={creatingApp}
          error={createAppError}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.name}"?`}
          message="This permanently removes all Kubernetes resources associated with this item."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteType(null) }}
        />
      )}
    </div>
  )
}

function EnvironmentCard({ env, onManage, onDelete, index }) {
  const a = TEMPLATE_ACCENT[env.templateId] ?? TEMPLATE_ACCENT.ubuntu
  const ready = env.status === 'RUNNING' && !!env.accessUrl
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        ...S.envCard,
        opacity: 0,
        animation: `fadeIn 0.3s var(--ease-out) ${index * 50}ms both`,
        background: hovered ? C.hover : C.bgSurface,
        transition: 'background 0.15s, border-color 0.15s',
        borderColor: hovered ? C.borderStrong : C.border,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...S.envDot, background: a.color }} />
          <div>
            <Link to={`/environments/${env.id}`} style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
              {env.name}
            </Link>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{env.templateName}</div>
          </div>
        </div>
        <StatusBadge status={env.status} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <Chip>{env.cpuRequest} CPU</Chip>
        <Chip>{env.memoryRequest} RAM</Chip>
        <Chip>{env.storageSize} Disk</Chip>
      </div>

      <div style={S.envActions}>
        {ready ? (
          <>
            <a href={env.accessUrl} target="_blank" rel="noreferrer" style={S.accessLink(a.color)}>
              Workspace ↗
            </a>
            <a href={getTerminalUrl(env)} target="_blank" rel="noreferrer" style={S.accessLink(C.muted)}>
              Terminal ↗
            </a>
            <a href={getDesktopUrl(env)} target="_blank" rel="noreferrer" style={S.accessLink(C.muted)}>
              Desktop ↗
            </a>
          </>
        ) : env.status === 'PROVISIONING' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.amber }}>
            <Spinner size={11} color={C.amber} /> Starting…
          </span>
        ) : (
          <span style={{ fontSize: 11, color: C.faint }}>
            {env.status === 'STOPPED' ? 'Start to access' : '—'}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <Button size="sm" variant="secondary" onClick={onManage}>Manage</Button>
          <Button size="sm" variant="ghost" style={{ color: C.red }} onClick={onDelete}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  )
}

function AppModal({ onSubmit, onClose, loading, error }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={S.modal}>
        <div style={S.modalHead}>
          <div>
            <div style={S.modalTitle}>New application</div>
            <div style={S.modalSub}>Deploy a Dockerized app from a local source path</div>
          </div>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <form onSubmit={onSubmit} style={{ padding: '18px 22px 22px' }}>
          <ModalField label="Name" required hint="Lowercase letters, numbers, hyphens">
            <input className="ui-input" name="name" required autoFocus
              pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]|[a-z0-9]" />
          </ModalField>
          <ModalField label="Description">
            <input className="ui-input" name="description" />
          </ModalField>
          <ModalField label="Source path" required hint="Absolute path to a directory with a Dockerfile">
            <input className="ui-input" name="sourcePath" required placeholder="C:\projects\my-app" />
          </ModalField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ModalField label="Container port">
              <input className="ui-input" name="containerPort" type="number" defaultValue="8080" min="1" max="65535" />
            </ModalField>
            <ModalField label="Replicas">
              <input className="ui-input" name="replicas" type="number" defaultValue="1" min="1" max="50" />
            </ModalField>
          </div>
          <ErrorMessage error={error} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" loading={loading} loadingLabel="Creating…">Create</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ title, count, action, children, style }) {
  return (
    <div style={style}>
      <div style={S.sectionHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={S.sectionTitle}>{title}</span>
          {count !== undefined && <span style={S.sectionCount}>{count}</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptySection({ text }) {
  return <p style={{ fontSize: 13, color: C.faint, margin: '12px 0' }}>{text}</p>
}

function Chip({ children }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: R.pill,
      background: C.chip, border: `1px solid ${C.border}`,
      fontSize: 11, color: C.muted, fontWeight: 500,
    }}>
      {children}
    </span>
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
  page:       { maxWidth: 1080, margin: '0 auto', padding: '48px 28px' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted, marginBottom: 24 },
  bcLink:     { color: C.muted, textDecoration: 'none', transition: 'color 0.15s' },
  bcSep:      { color: C.border },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 40, gap: 16,
  },
  title:   { margin: 0, fontSize: 36, fontWeight: 400, color: C.ink, letterSpacing: '-0.04em', fontFamily: FONT.serif, lineHeight: 1.05 },
  desc:    { margin: '5px 0 0', fontSize: 13, color: C.muted },

  sectionHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border}`,
  },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: C.body, letterSpacing: '-0.01em' },
  sectionCount: {
    fontSize: 11, color: C.faint, fontWeight: 600,
    background: C.chip, borderRadius: R.pill,
    padding: '1px 8px',
  },

  envGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  envCard: {
    border: `1px solid ${C.border}`, borderRadius: R.xl,
    padding: '18px',
    display: 'flex', flexDirection: 'column',
  },
  envDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 3 },
  envActions: {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    paddingTop: 12, borderTop: `1px solid ${C.border}`, marginTop: 'auto',
  },
  accessLink: (color) => ({
    fontSize: 11, fontWeight: 600, color, textDecoration: 'none',
    padding: '3px 0', letterSpacing: '0.01em',
    transition: 'opacity 0.15s',
  }),

  appsTable: {
    border: `1px solid ${C.border}`, borderRadius: R.xl,
    overflow: 'hidden', background: C.bgSurface,
  },
  th: {
    textAlign: 'left', padding: '10px 16px',
    fontSize: 10, fontWeight: 700, color: C.faint,
    background: C.glass, borderBottom: `1px solid ${C.border}`,
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  tr: { borderBottom: `1px solid ${C.divider}` },
  td: { padding: '10px 16px', fontSize: 13, color: C.body, verticalAlign: 'middle' },

  overlay: {},
  modal: {
    width: '100%', maxWidth: 480,
    overflow: 'hidden',
  },
  modalHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 22px 16px', borderBottom: `1px solid ${C.border}`,
  },
  modalTitle: { fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em', marginBottom: 2 },
  modalSub: { fontSize: 12, color: C.muted },
  closeBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: C.faint, padding: 4, display: 'flex', borderRadius: R.sm,
    transition: 'color 0.15s', flexShrink: 0,
  },
}
