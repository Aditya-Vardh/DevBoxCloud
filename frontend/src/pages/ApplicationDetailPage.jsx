import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { appApi } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { C, R, FONT } from '../theme'

const POLL = 5000

export function ApplicationDetailPage() {
  const { appId } = useParams()

  const [app, setApp]               = useState(null)
  const [status, setStatus]         = useState(null)
  const [pods, setPods]             = useState([])
  const [serviceInfo, setService]   = useState(null)
  const [logs, setLogs]             = useState('')
  const [logLines, setLogLines]     = useState(200)
  const [tab, setTab]               = useState('overview')
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState(null)
  const [scaleValue, setScaleValue] = useState(1)
  const [showStop, setShowStop]     = useState(false)
  const pollRef = useRef(null)

  const { run: runBuild,    loading: building,    error: buildError    } = useAsync()
  const { run: runDeploy,   loading: deploying,   error: deployError   } = useAsync()
  const { run: runRedeploy, loading: redeploying, error: redeployError } = useAsync()
  const { run: runScale,    loading: scaling,     error: scaleError    } = useAsync()
  const { run: runStop,     loading: stopping,    error: stopError     } = useAsync()
  const { run: runLogs,     loading: logsLoading } = useAsync()

  useEffect(() => { loadApp(); return () => clearInterval(pollRef.current) }, [appId])

  useEffect(() => {
    clearInterval(pollRef.current)
    if (status && ['DEPLOYING','BUILDING','DELETING'].includes(status.status))
      pollRef.current = setInterval(refreshStatus, POLL)
    return () => clearInterval(pollRef.current)
  }, [status?.status])

  async function loadApp() {
    setLoading(true); setLoadError(null)
    try {
      const [a, s] = await Promise.all([appApi.get(appId), appApi.status(appId)])
      setApp(a); setStatus(s); setScaleValue(a.replicas)
    } catch (e) { setLoadError(e.message) }
    finally { setLoading(false) }
  }
  async function refreshStatus() {
    try { setStatus(await appApi.status(appId)) } catch (_) {}
  }
  async function handleBuild()    { const r = await runBuild(appApi.build(appId));        if (r) { setStatus(p => ({ ...p, status: r.status })); await refreshStatus() } }
  async function handleDeploy()   { const r = await runDeploy(appApi.deploy(appId));      if (r) setStatus(r) }
  async function handleRedeploy() { const r = await runRedeploy(appApi.redeploy(appId));  if (r) setStatus(r) }
  async function handleScale()    { const r = await runScale(appApi.scale(appId, scaleValue)); if (r) setStatus(r) }
  async function handleStop()     { setShowStop(false); const r = await runStop(appApi.stop(appId)); if (r) setStatus(r) }
  async function loadLogs()       { const r = await runLogs(appApi.logs(appId, logLines)); if (r !== null) setLogs(r) }
  async function loadPods()       { try { setPods(await appApi.pods(appId)) } catch (_) {} }
  async function loadService()    { try { setService(await appApi.service(appId)) } catch (_) {} }

  useEffect(() => {
    if (tab === 'logs')    loadLogs()
    if (tab === 'pods')    loadPods()
    if (tab === 'service') loadService()
  }, [tab])

  if (loading) return (
    <div style={S.page}>
      <div className="skeleton" style={{ height: 16, width: 200, marginBottom: 28, borderRadius: R.md }} />
      <div className="skeleton" style={{ height: 90, marginBottom: 14, borderRadius: R.xl }} />
      <div className="skeleton" style={{ height: 44, marginBottom: 14, borderRadius: R.lg }} />
      <div className="skeleton" style={{ height: 240, borderRadius: R.xl }} />
    </div>
  )
  if (loadError) return <div style={S.page}><ErrorMessage error={loadError} /></div>
  if (!app) return null

  const isDeployed = status && !['NOT_DEPLOYED','BUILD_FAILED','BUILDING'].includes(status.status)
  const isStopped  = status?.status === 'STOPPED'
  const isRunning  = status?.status === 'RUNNING'
  const isActive   = status && ['BUILDING','DEPLOYING','DELETING'].includes(status.status)
  const TABS = ['overview','pods','logs','service']

  return (
    <div className="page-enter" style={S.page}>

      <div style={S.breadcrumb}>
        <Link to="/workspaces" style={S.bcLink}>Workspaces</Link>
        <span style={S.bcSep}>/</span>
        <Link to={`/workspaces/${app.workspaceId}`} style={S.bcLink}>{app.workspaceName}</Link>
        <span style={S.bcSep}>/</span>
        <span style={{ color: C.body }}>{app.name}</span>
      </div>

      <div style={S.identity}>
        <div style={S.identLeft}>
          <div style={S.avatar}>{app.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={S.title}>{app.name}</h1>
              {status && <StatusBadge status={status.status} />}
              {isActive && <Spinner size={13} color={C.amber} />}
            </div>
            {app.description && <p style={S.desc}>{app.description}</p>}
            <div style={S.chips}>
              <Chip>Port {app.containerPort}</Chip>
              <Chip>{app.replicas} replica{app.replicas !== 1 ? 's' : ''}</Chip>
              {app.dockerImage && <Chip mono>{app.dockerImage}</Chip>}
            </div>
          </div>
        </div>
        {status && (
          <div style={S.statusBox}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Ready</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, fontFamily: FONT.mono, letterSpacing: '-0.02em' }}>
              {status.readyReplicas ?? 0}<span style={{ color: C.faint }}>/{status.desiredReplicas ?? app.replicas}</span>
            </div>
            {status.message && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, maxWidth: 160, lineHeight: 1.4 }}>{status.message}</div>}
          </div>
        )}
      </div>

      {isRunning && status?.accessUrl && (
        <div style={S.accessBanner}>
          <span style={{ color: C.green, fontWeight: 700 }}>Running</span>
          {' — '}
          <a href={status.accessUrl} target="_blank" rel="noreferrer"
            style={{ color: C.green, fontFamily: FONT.mono, fontSize: 12, fontWeight: 600 }}>
            {status.accessUrl} ↗
          </a>
        </div>
      )}

      <div style={S.actionBar}>
        <Button size="sm" variant="secondary"
          style={{ color: C.amber, borderColor: 'rgba(251,191,36,0.22)' }}
          loading={building} loadingLabel="Building…"
          disabled={building || deploying} onClick={handleBuild}>
          Build
        </Button>
        <Button size="sm" variant="primary"
          loading={deploying} loadingLabel="Deploying…"
          disabled={building || deploying || status?.status === 'BUILDING'}
          onClick={handleDeploy}>
          Deploy
        </Button>
        <Button size="sm" variant="secondary"
          style={{ color: C.purple, borderColor: 'rgba(167,139,250,0.22)' }}
          loading={redeploying} loadingLabel="Redeploying…"
          disabled={building || redeploying || !isDeployed} onClick={handleRedeploy}>
          Redeploy
        </Button>

        <div style={S.scaleGroup}>
          <span style={S.scaleLabel}>Replicas</span>
          <input type="number" min="0" max="50"
            value={scaleValue}
            onChange={e => setScaleValue(parseInt(e.target.value) || 0)}
            style={S.scaleInput} />
          <Button size="sm" variant="ghost"
            style={{ color: C.green }}
            loading={scaling} loadingLabel="Scaling…"
            disabled={scaling || !isDeployed} onClick={handleScale}>
            Scale
          </Button>
        </div>

        <Button size="sm" variant="ghost" style={{ marginLeft: 'auto', color: C.muted }}
          loading={stopping} loadingLabel="Stopping…"
          disabled={stopping || !isDeployed || isStopped}
          onClick={() => setShowStop(true)}>
          Stop
        </Button>
        <Button size="sm" variant="ghost" style={{ color: C.body }} onClick={refreshStatus}>
          Refresh
        </Button>
      </div>

      <ErrorMessage error={buildError || deployError || redeployError || scaleError || stopError} />

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}
            onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div>
        {tab === 'overview' && <OverviewTab app={app} status={status} />}
        {tab === 'pods'     && <PodsTab pods={pods} onRefresh={loadPods} />}
        {tab === 'logs'     && <LogsTab logs={logs} loading={logsLoading} logLines={logLines} setLogLines={setLogLines} onFetch={loadLogs} />}
        {tab === 'service'  && <ServiceTab info={serviceInfo} onRefresh={loadService} />}
      </div>

      {showStop && (
        <ConfirmDialog
          title={`Stop "${app.name}"?`}
          message="This scales the deployment to 0 replicas. The application will be unreachable until redeployed."
          confirmLabel="Stop application"
          confirmVariant="secondary"
          onConfirm={handleStop}
          onCancel={() => setShowStop(false)}
        />
      )}
    </div>
  )
}

function OverviewTab({ app }) {
  const rows = [
    ['ID',           app.id],
    ['Source path',  app.sourcePath],
    ['Docker image', app.dockerImage],
    ['Port',         app.containerPort],
    ['Replicas',     app.replicas],
    ['Deployment',   app.k8sDeploymentName],
    ['Service',      app.k8sServiceName],
    ['Namespace',    app.k8sNamespace],
    ['Created',      fmt(app.createdAt)],
    ['Updated',      fmt(app.updatedAt)],
  ]
  const MONO = new Set(['ID','Source path','Docker image','Deployment','Service','Namespace'])
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: R.xl, overflow: 'hidden' }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', gap: 16, padding: '9px 16px', borderBottom: i < rows.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
          <span style={{ width: 130, flexShrink: 0, fontSize: 12, color: C.muted, fontWeight: 500 }}>{k}</span>
          <span style={{ fontSize: MONO.has(k) ? 11 : 13, color: C.body, fontFamily: MONO.has(k) ? FONT.mono : undefined, wordBreak: 'break-all' }}>
            {v ?? '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function PodsTab({ pods, onRefresh }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.body }}>Pods</span>
        <Button size="sm" variant="secondary" onClick={onRefresh}>Refresh</Button>
      </div>
      {pods.length === 0
        ? <p style={{ color: C.faint, fontSize: 13 }}>No pods found. Deploy first.</p>
        : <TableWrap cols={['Name','Phase','Ready','Restarts','Node','Age']}
            rows={pods.map(p => [
              <code style={{ fontSize: 11, fontFamily: FONT.mono, color: C.muted }}>{p.name}</code>,
              p.phase,
              <span style={{ color: p.ready ? C.green : C.red }}>{p.ready ? '✓' : '✗'}</span>,
              p.restartCount, p.nodeName ?? '—',
              p.createdAt ? ago(p.createdAt) : '—',
            ])} />
      }
    </div>
  )
}

function LogsTab({ logs, loading, logLines, setLogLines, onFetch }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.body }}>Container logs</span>
        <input type="number" value={logLines} min="10" max="2000"
          onChange={e => setLogLines(parseInt(e.target.value) || 200)}
          style={S.numInput} />
        <span style={{ fontSize: 12, color: C.faint }}>lines</span>
        <Button size="sm" variant="secondary" onClick={onFetch}>Fetch</Button>
        {loading && <Spinner size={14} />}
      </div>
      <pre style={S.logBox}>{logs || 'No logs yet. Deploy the application first.'}</pre>
    </div>
  )
}

function ServiceTab({ info, onRefresh }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.body }}>Service</span>
        <Button size="sm" variant="secondary" onClick={onRefresh}>Refresh</Button>
      </div>
      {!info
        ? <p style={{ color: C.faint, fontSize: 13 }}>No service info available. Deploy first.</p>
        : <div style={{ border: `1px solid ${C.border}`, borderRadius: R.xl, overflow: 'hidden' }}>
            {[
              ['Name',        info.name],
              ['Type',        info.type],
              ['Cluster IP',  info.clusterIp],
              ['Port',        info.port],
              ['Target Port', info.targetPort],
              ['NodePort',    info.nodePort],
            ].map(([k, v], i, arr) => (
              <div key={k} style={{ display: 'flex', gap: 16, padding: '9px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
                <span style={{ width: 120, flexShrink: 0, fontSize: 12, color: C.muted, fontWeight: 500 }}>{k}</span>
                <span style={{ fontSize: 13, color: C.body }}>{v ?? '—'}</span>
              </div>
            ))}
            {info.accessUrl && (
              <div style={{ display: 'flex', gap: 16, padding: '9px 16px' }}>
                <span style={{ width: 120, flexShrink: 0, fontSize: 12, color: C.muted, fontWeight: 500 }}>Access URL</span>
                <a href={info.accessUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: C.body, fontFamily: FONT.mono, wordBreak: 'break-all' }}>
                  {info.accessUrl} ↗
                </a>
              </div>
            )}
          </div>
      }
    </div>
  )
}

function TableWrap({ cols, rows }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: R.xl, overflow: 'hidden', background: C.bgSurface }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{cols.map(c => <th key={c} style={S.th}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.divider}` }}>
              {row.map((cell, j) => <td key={j} style={S.td}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Chip({ children, mono }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: R.pill,
      background: C.chip, border: `1px solid ${C.border}`,
      fontSize: 11, color: C.muted, fontWeight: 500,
      fontFamily: mono ? FONT.mono : undefined,
    }}>{children}</span>
  )
}

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function ago(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'; if (m < 60) return `${m}m`; return `${Math.floor(m/60)}h ${m%60}m`
}

const S = {
  page:       { maxWidth: 960, margin: '0 auto', padding: '48px 28px' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted, marginBottom: 24 },
  bcLink:     { color: C.muted, textDecoration: 'none' },
  bcSep:      { color: C.border },

  identity: {
    border: `1px solid ${C.border}`, borderRadius: R.xl,
    padding: '20px 24px', background: C.bgSurface,
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 12,
  },
  identLeft: { display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: R.xl, flexShrink: 0,
    background: C.chip, border: `1px solid ${C.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 800, color: C.body, letterSpacing: '-0.01em',
  },
  title:  { margin: 0, fontSize: 28, fontWeight: 400, color: C.ink, letterSpacing: '-0.03em', fontFamily: FONT.serif },
  desc:   { margin: '4px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 },
  chips:  { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },

  statusBox: {
    background: C.glass, border: `1px solid ${C.border}`,
    borderRadius: R.xl, padding: '12px 16px', flexShrink: 0,
  },

  accessBanner: {
    background: C.greenLight, border: `1px solid ${C.greenBorder}`,
    borderRadius: R.lg, padding: '10px 14px', marginBottom: 12,
    fontSize: 13, color: C.green,
  },

  actionBar: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
    marginBottom: 16, alignItems: 'center',
  },
  scaleGroup: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: C.glass, border: `1px solid ${C.border}`,
    borderRadius: R.lg, padding: '4px 8px',
  },
  scaleLabel: { fontSize: 10, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em' },
  scaleInput: {
    width: 52, padding: '4px 6px', borderRadius: R.md,
    border: `1px solid ${C.borderStrong}`, fontSize: 13,
    textAlign: 'center', fontFamily: FONT.mono,
    background: C.input, color: C.body, outline: 'none',
  },

  tabs: {
    display: 'flex', borderBottom: `1px solid ${C.border}`,
    marginBottom: 22, gap: 0,
  },
  tab: {
    padding: '9px 14px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.muted,
    borderBottom: '1px solid transparent', marginBottom: -1,
    fontFamily: FONT.sans, transition: 'color 0.15s', letterSpacing: '0.01em',
  },
  tabActive: { color: C.ink, borderBottom: `1px solid ${C.ink}` },

  logBox: {
    background: C.termBg, color: C.termText,
    padding: '14px 18px', borderRadius: R.xl, border: `1px solid ${C.border}`,
    overflowX: 'auto', overflowY: 'auto', maxHeight: 460,
    fontSize: 12, lineHeight: 1.7, margin: 0,
    fontFamily: FONT.mono, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  numInput: {
    width: 60, padding: '4px 8px', borderRadius: R.md,
    border: `1px solid ${C.borderStrong}`, fontSize: 13,
    textAlign: 'center', fontFamily: FONT.sans,
    background: C.input, color: C.body, outline: 'none',
  },
  th: {
    textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700,
    color: C.faint, background: C.glass,
    borderBottom: `1px solid ${C.border}`,
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  td: { padding: '9px 14px', fontSize: 12, color: C.body, verticalAlign: 'middle' },
}
