import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { appApi } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { C, R, SHADOW, FONT } from '../theme'

const POLL_INTERVAL = 5000

export function ApplicationDetailPage() {
  const { appId } = useParams()

  const [app, setApp]             = useState(null)
  const [status, setStatus]       = useState(null)
  const [pods, setPods]           = useState([])
  const [serviceInfo, setServiceInfo] = useState(null)
  const [logs, setLogs]           = useState('')
  const [logLines, setLogLines]   = useState(200)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [scaleValue, setScaleValue] = useState(1)
  const [showStop, setShowStop]   = useState(false)
  const pollRef = useRef(null)

  const { run: runBuild,    loading: building,    error: buildError }    = useAsync()
  const { run: runDeploy,   loading: deploying,   error: deployError }   = useAsync()
  const { run: runRedeploy, loading: redeploying, error: redeployError } = useAsync()
  const { run: runScale,    loading: scaling,     error: scaleError }    = useAsync()
  const { run: runStop,     loading: stopping,    error: stopError }     = useAsync()
  const { run: runLogs,     loading: loadingLogs } = useAsync()

  useEffect(() => {
    loadApp()
    return () => clearInterval(pollRef.current)
  }, [appId])

  useEffect(() => {
    clearInterval(pollRef.current)
    if (status && ['DEPLOYING', 'BUILDING', 'DELETING'].includes(status.status)) {
      pollRef.current = setInterval(refreshStatus, POLL_INTERVAL)
    }
    return () => clearInterval(pollRef.current)
  }, [status?.status])

  async function loadApp() {
    setLoading(true)
    setLoadError(null)
    try {
      const [appData, statusData] = await Promise.all([
        appApi.get(appId),
        appApi.status(appId),
      ])
      setApp(appData)
      setStatus(statusData)
      setScaleValue(appData.replicas)
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function refreshStatus() {
    try { setStatus(await appApi.status(appId)) } catch (_) {}
  }

  async function handleBuild() {
    const result = await runBuild(appApi.build(appId))
    if (result) { setStatus(prev => ({ ...prev, status: result.status })); await refreshStatus() }
  }
  async function handleDeploy() {
    const result = await runDeploy(appApi.deploy(appId))
    if (result) setStatus(result)
  }
  async function handleRedeploy() {
    const result = await runRedeploy(appApi.redeploy(appId))
    if (result) setStatus(result)
  }
  async function handleScale() {
    const result = await runScale(appApi.scale(appId, scaleValue))
    if (result) setStatus(result)
  }
  async function handleStop() {
    setShowStop(false)
    const result = await runStop(appApi.stop(appId))
    if (result) setStatus(result)
  }
  async function loadLogs() {
    const result = await runLogs(appApi.logs(appId, logLines))
    if (result !== null) setLogs(result)
  }
  async function loadPods() {
    try { setPods(await appApi.pods(appId)) } catch (_) {}
  }
  async function loadService() {
    try { setServiceInfo(await appApi.service(appId)) } catch (_) {}
  }

  useEffect(() => {
    if (activeTab === 'logs')    loadLogs()
    if (activeTab === 'pods')    loadPods()
    if (activeTab === 'service') loadService()
  }, [activeTab])

  if (loading) return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
      <div className="skeleton" style={{ height: 20, width: 220, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 48, width: '60%', marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  )
  if (loadError) return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
      <ErrorMessage error={loadError} />
    </div>
  )
  if (!app) return null

  const isDeployed = status && !['NOT_DEPLOYED', 'BUILD_FAILED', 'BUILDING'].includes(status.status)
  const isStopped  = status?.status === 'STOPPED'
  const isRunning  = status?.status === 'RUNNING'
  const isActive   = status && ['BUILDING', 'DEPLOYING', 'DELETING'].includes(status.status)

  return (
    <div className="page-enter" style={S.page}>

      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <Link to="/" style={S.bcLink}>Workspaces</Link>
        <span style={S.bcSep}>/</span>
        <Link to={`/workspaces/${app.workspaceId}`} style={S.bcLink}>{app.workspaceName}</Link>
        <span style={S.bcSep}>/</span>
        <span style={{ color: C.body, fontWeight: 500 }}>{app.name}</span>
      </div>

      {/* Header card */}
      <div style={S.headerCard}>
        <div style={S.headerLeft}>
          {/* App initial avatar */}
          <div style={S.appAvatar}>{app.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={S.title}>{app.name}</h1>
              {status && <StatusBadge status={status.status} />}
              {isActive && <Spinner size={14} color={C.amber} />}
            </div>
            {app.description && <p style={S.desc}>{app.description}</p>}
            <div style={S.metaRow}>
              <MetaChip>Port {app.containerPort}</MetaChip>
              <MetaChip>{app.replicas} replica{app.replicas !== 1 ? 's' : ''}</MetaChip>
              {app.dockerImage && (
                <span style={{ ...S.metaChip, fontFamily: FONT.mono }}>
                  {app.dockerImage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status summary */}
        {status && (
          <div style={S.statusSummary}>
            <div style={S.statusRow}>
              <span style={S.statusLabel}>Ready</span>
              <span style={S.statusValue}>
                {status.readyReplicas ?? 0} / {status.desiredReplicas ?? app.replicas}
              </span>
            </div>
            {status.message && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4, maxWidth: 180, lineHeight: 1.4 }}>
                {status.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={S.actionBar}>
        <Button
          variant="secondary"
          size="sm"
          loading={building}
          loadingLabel="Building..."
          disabled={building || deploying}
          onClick={handleBuild}
          style={{ borderColor: C.amber, color: C.amber }}
        >
          Build
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={deploying}
          loadingLabel="Deploying..."
          disabled={building || deploying || status?.status === 'BUILDING'}
          onClick={handleDeploy}
        >
          Deploy
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={redeploying}
          loadingLabel="Redeploying..."
          disabled={building || redeploying || !isDeployed}
          onClick={handleRedeploy}
          style={{ color: C.purple, borderColor: C.purple }}
        >
          Redeploy
        </Button>

        {/* Scale control */}
        <div style={S.scaleGroup}>
          <label style={S.scaleLabel}>Replicas</label>
          <input
            type="number" min="0" max="50"
            value={scaleValue}
            onChange={e => setScaleValue(parseInt(e.target.value) || 0)}
            style={S.scaleInput}
          />
          <Button
            variant="secondary"
            size="sm"
            loading={scaling}
            loadingLabel="Scaling..."
            disabled={scaling || !isDeployed}
            onClick={handleScale}
            style={{ color: C.green, borderColor: C.green }}
          >
            Scale
          </Button>
        </div>

        {/* Stop — right-aligned, requires confirmation */}
        <Button
          variant="secondary"
          size="sm"
          loading={stopping}
          loadingLabel="Stopping..."
          disabled={stopping || !isDeployed || isStopped}
          onClick={() => setShowStop(true)}
          style={{ marginLeft: 'auto', color: C.muted }}
        >
          Stop
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={refreshStatus}
          style={{ color: C.primary }}
        >
          Refresh
        </Button>
      </div>

      {/* Errors */}
      <ErrorMessage error={buildError || deployError || redeployError || scaleError || stopError} />

      {/* Access URL banner when running */}
      {isRunning && status?.accessUrl && (
        <div style={S.accessBanner}>
          <span style={{ color: C.green, fontWeight: 700 }}>Running</span>
          {' — '}
          <a href={status.accessUrl} target="_blank" rel="noreferrer"
            style={{ color: C.greenText, fontWeight: 600, fontFamily: FONT.mono, fontSize: 12 }}>
            {status.accessUrl} ↗
          </a>
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabs}>
        {['overview', 'pods', 'logs', 'service'].map(tab => (
          <button key={tab}
            style={{ ...S.tab, ...(activeTab === tab ? S.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={S.tabContent}>
        {activeTab === 'overview' && <OverviewTab app={app} status={status} />}
        {activeTab === 'pods'     && <PodsTab pods={pods} onRefresh={loadPods} />}
        {activeTab === 'logs'     && (
          <LogsTab logs={logs} loading={loadingLogs}
            logLines={logLines} setLogLines={setLogLines} onFetch={loadLogs} />
        )}
        {activeTab === 'service'  && <ServiceTab info={serviceInfo} onRefresh={loadService} />}
      </div>

      {showStop && (
        <ConfirmDialog
          title={`Stop "${app.name}"?`}
          message="This will scale the deployment to 0 replicas. The application will be unreachable until redeployed."
          confirmLabel="Stop Application"
          confirmVariant="secondary"
          onConfirm={handleStop}
          onCancel={() => setShowStop(false)}
        />
      )}
    </div>
  )
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

function OverviewTab({ app, status }) {
  const rows = [
    ['ID',              app.id],
    ['Name',            app.name],
    ['Source Path',     app.sourcePath],
    ['Docker Image',    app.dockerImage],
    ['Container Port',  app.containerPort],
    ['Replicas',        app.replicas],
    ['K8s Deployment',  app.k8sDeploymentName],
    ['K8s Service',     app.k8sServiceName],
    ['Namespace',       app.k8sNamespace],
    ['Created',         new Date(app.createdAt).toLocaleString()],
    ['Updated',         new Date(app.updatedAt).toLocaleString()],
  ]
  return (
    <div>
      <SectionHeading>Application Details</SectionHeading>
      <div style={S.infoBlock}>
        {rows.map(([k, v]) => (
          <div key={k} style={S.infoRow}>
            <span style={S.infoKey}>{k}</span>
            <span style={{
              ...S.infoVal,
              fontFamily: ['ID', 'K8s Deployment', 'K8s Service', 'Namespace', 'Docker Image', 'Source Path'].includes(k)
                ? FONT.mono : undefined,
              fontSize: ['ID', 'K8s Deployment', 'K8s Service', 'Docker Image', 'Source Path'].includes(k) ? 11 : 13,
            }}>
              {v ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PodsTab({ pods, onRefresh }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <SectionHeading style={{ margin: 0 }}>Pods</SectionHeading>
        <Button size="sm" variant="secondary" onClick={onRefresh}>Refresh</Button>
      </div>
      {pods.length === 0
        ? <EmptyMsg>No pods found. Deploy the application first.</EmptyMsg>
        : (
          <div style={S.tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Phase', 'Ready', 'Restarts', 'Node', 'Age'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pods.map(pod => (
                  <tr key={pod.name} style={S.tr}>
                    <td style={S.td}>
                      <code style={{ fontSize: 11, fontFamily: FONT.mono }}>{pod.name}</code>
                    </td>
                    <td style={S.td}>{pod.phase}</td>
                    <td style={S.td}>
                      <span style={{ color: pod.ready ? C.green : C.red, fontWeight: 700 }}>
                        {pod.ready ? '✓' : '✗'}
                      </span>
                    </td>
                    <td style={S.td}>{pod.restartCount}</td>
                    <td style={S.td}>{pod.nodeName ?? '—'}</td>
                    <td style={S.td}>{pod.createdAt ? timeSince(pod.createdAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}

function LogsTab({ logs, loading, logLines, setLogLines, onFetch }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <SectionHeading style={{ margin: 0 }}>Container Logs</SectionHeading>
        <input
          type="number" value={logLines} min="10" max="2000"
          onChange={e => setLogLines(parseInt(e.target.value) || 200)}
          style={S.lineInput}
        />
        <span style={{ fontSize: 12, color: C.faint }}>lines</span>
        <Button size="sm" variant="secondary" onClick={onFetch}>Fetch</Button>
        {loading && <Spinner size={14} />}
      </div>
      <pre style={S.logBox}>
        {logs || 'No logs yet. Deploy the application first.'}
      </pre>
    </div>
  )
}

function ServiceTab({ info, onRefresh }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <SectionHeading style={{ margin: 0 }}>Service</SectionHeading>
        <Button size="sm" variant="secondary" onClick={onRefresh}>Refresh</Button>
      </div>
      {!info
        ? <EmptyMsg>No service info available. Deploy the application first.</EmptyMsg>
        : (
          <div style={S.infoBlock}>
            {[
              ['Name',        info.name],
              ['Type',        info.type],
              ['Cluster IP',  info.clusterIp],
              ['Port',        info.port],
              ['Target Port', info.targetPort],
              ['NodePort',    info.nodePort],
            ].map(([k, v]) => (
              <div key={k} style={S.infoRow}>
                <span style={S.infoKey}>{k}</span>
                <span style={S.infoVal}>{v ?? '—'}</span>
              </div>
            ))}
            {info.accessUrl && (
              <div style={S.infoRow}>
                <span style={S.infoKey}>Access URL</span>
                <a href={info.accessUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: 13, color: C.primary, fontFamily: FONT.mono, wordBreak: 'break-all' }}>
                  {info.accessUrl} ↗
                </a>
              </div>
            )}
          </div>
        )
      }
    </div>
  )
}

// ── Shared micro-components ───────────────────────────────────────────────────

function SectionHeading({ children, style }) {
  return (
    <h3 style={{
      margin: '0 0 12px', fontSize: 13, fontWeight: 700,
      color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
      ...style,
    }}>
      {children}
    </h3>
  )
}

function MetaChip({ children }) {
  return (
    <span style={S.metaChip}>{children}</span>
  )
}

function EmptyMsg({ children }) {
  return <p style={{ color: C.muted, fontSize: 13, margin: '8px 0' }}>{children}</p>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeSince(isoString) {
  const m = Math.floor((Date.now() - new Date(isoString)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page:       { maxWidth: 960, margin: '0 auto', padding: '28px 20px' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, marginBottom: 18 },
  bcLink:     { color: C.muted, textDecoration: 'none' },
  bcSep:      { color: C.border, fontSize: 16 },

  headerCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 16, flexWrap: 'wrap',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: R.xl, padding: '20px 24px', marginBottom: 16,
    boxShadow: SHADOW.md,
  },
  headerLeft: { display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 },
  appAvatar: {
    width: 48, height: 48, borderRadius: R.lg, flexShrink: 0,
    background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 700, color: C.primaryText,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' },
  desc:  { margin: '3px 0 0', fontSize: 13, color: C.muted },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  metaChip: {
    display: 'inline-block', padding: '2px 8px', borderRadius: R.full,
    background: C.bgSubtle, border: `1px solid ${C.border}`,
    fontSize: 11, fontWeight: 500, color: C.muted,
  },

  statusSummary: {
    background: C.bgSurface, border: `1px solid ${C.border}`,
    borderRadius: R.lg, padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0,
  },
  statusRow:  { display: 'flex', gap: 10, alignItems: 'center' },
  statusLabel:{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', width: 50 },
  statusValue:{ fontSize: 15, fontWeight: 700, color: C.ink },

  actionBar: {
    display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
    marginBottom: 14,
  },
  scaleGroup: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: C.bgSurface, border: `1px solid ${C.border}`,
    borderRadius: R.md, padding: '4px 8px',
  },
  scaleLabel: { fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em' },
  scaleInput: {
    width: 52, padding: '4px 6px', borderRadius: R.sm,
    border: `1px solid ${C.borderStrong}`, fontSize: 13,
    textAlign: 'center', fontFamily: 'inherit', color: C.ink,
  },

  accessBanner: {
    background: C.greenLight, border: `1px solid ${C.greenBorder}`,
    borderRadius: R.md, padding: '10px 14px', marginBottom: 14,
    fontSize: 13, color: C.greenText,
  },

  tabs:      { display: 'flex', borderBottom: `2px solid ${C.border}`, marginBottom: 20, gap: 2 },
  tab:       {
    padding: '8px 16px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 500,
    borderBottom: '2px solid transparent', marginBottom: -2, fontFamily: 'inherit',
  },
  tabActive: { color: C.primary, borderBottom: `2px solid ${C.primary}` },
  tabContent:{ minHeight: 180 },

  // Info table (key/value rows)
  infoBlock: { display: 'flex', flexDirection: 'column', gap: 0 },
  infoRow:   { display: 'flex', borderBottom: `1px solid ${C.divider}`, padding: '7px 0', gap: 16 },
  infoKey:   { width: 140, flexShrink: 0, fontSize: 13, color: C.muted, fontWeight: 500 },
  infoVal:   { fontSize: 13, color: C.body, wordBreak: 'break-all' },

  // Data table (pods)
  tableWrap: { border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: 'hidden' },
  th: {
    textAlign: 'left', padding: '9px 14px',
    fontSize: 11, fontWeight: 600, color: C.muted,
    background: C.bgSurface, borderBottom: `1px solid ${C.border}`,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  tr: { borderBottom: `1px solid ${C.divider}` },
  td: { padding: '9px 14px', fontSize: 13, verticalAlign: 'middle' },

  // Logs
  logBox: {
    background: C.termBg, color: C.termText,
    padding: '16px 18px', borderRadius: R.lg,
    overflowX: 'auto', overflowY: 'auto',
    maxHeight: 460, fontSize: 12, lineHeight: 1.6, margin: 0,
    fontFamily: FONT.mono, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  lineInput: {
    width: 64, padding: '5px 7px', borderRadius: R.sm,
    border: `1px solid ${C.borderStrong}`, fontSize: 13,
    textAlign: 'center', fontFamily: 'inherit',
  },
}
