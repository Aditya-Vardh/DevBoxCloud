import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { appApi } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'

const POLL_INTERVAL = 5000  // ms

export function ApplicationDetailPage() {
  const { appId } = useParams()

  const [app, setApp]               = useState(null)
  const [status, setStatus]         = useState(null)
  const [pods, setPods]             = useState([])
  const [serviceInfo, setServiceInfo] = useState(null)
  const [logs, setLogs]             = useState('')
  const [logLines, setLogLines]     = useState(200)
  const [activeTab, setActiveTab]   = useState('overview')
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState(null)
  const [scaleValue, setScaleValue] = useState(1)
  const pollRef = useRef(null)

  const { run: runBuild,    loading: building,    error: buildError }    = useAsync()
  const { run: runDeploy,   loading: deploying,   error: deployError }   = useAsync()
  const { run: runRedeploy, loading: redeploying, error: redeployError } = useAsync()
  const { run: runScale,    loading: scaling,     error: scaleError }    = useAsync()
  const { run: runStop,     loading: stopping,    error: stopError }     = useAsync()
  const { run: runLogs,     loading: loadingLogs, error: logsError }     = useAsync()

  useEffect(() => {
    loadApp()
    return () => clearInterval(pollRef.current)
  }, [appId])

  // Auto-poll status when in an active state
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
    try {
      const s = await appApi.status(appId)
      setStatus(s)
    } catch (_) {}
  }

  async function handleBuild() {
    const result = await runBuild(appApi.build(appId))
    if (result) {
      setStatus(prev => ({ ...prev, status: result.status }))
      await refreshStatus()
    }
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
    const result = await runStop(appApi.stop(appId))
    if (result) setStatus(result)
  }

  async function loadLogs() {
    const result = await runLogs(appApi.logs(appId, logLines))
    if (result !== null) setLogs(result)
  }

  async function loadPods() {
    try {
      const data = await appApi.pods(appId)
      setPods(data)
    } catch (_) {}
  }

  async function loadService() {
    try {
      const data = await appApi.service(appId)
      setServiceInfo(data)
    } catch (_) {}
  }

  useEffect(() => {
    if (activeTab === 'logs')    loadLogs()
    if (activeTab === 'pods')    loadPods()
    if (activeTab === 'service') loadService()
  }, [activeTab])

  if (loading) return <div style={{ padding: 24 }}><Spinner /></div>
  if (loadError) return <div style={{ padding: 24 }}><ErrorMessage error={loadError} /></div>
  if (!app) return null

  const isDeployed = status && !['NOT_DEPLOYED', 'BUILD_FAILED', 'BUILDING'].includes(status.status)

  return (
    <div style={styles.page}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link to="/" style={styles.link}>Workspaces</Link>
        {' / '}
        <Link to={`/workspaces/${app.workspaceId}`} style={styles.link}>
          {app.workspaceName}
        </Link>
        {' / '}
        <span style={{ fontWeight: 600 }}>{app.name}</span>
      </div>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{app.name}</h1>
          {app.description && <p style={styles.desc}>{app.description}</p>}
          <div style={styles.meta}>
            Port {app.containerPort} &nbsp;·&nbsp; {app.replicas} replica{app.replicas !== 1 ? 's' : ''}
            &nbsp;·&nbsp; Image: {app.dockerImage}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {status && <StatusBadge status={status.status} />}
        </div>
      </div>

      {/* Action bar */}
      <div style={styles.actionBar}>
        <ActionBtn
          label="Build"
          loading={building}
          onClick={handleBuild}
          disabled={building || deploying}
          color="#d97706"
        />
        <ActionBtn
          label="Deploy"
          loading={deploying}
          onClick={handleDeploy}
          disabled={building || deploying || status?.status === 'BUILDING'}
          color="#2563eb"
        />
        <ActionBtn
          label="Redeploy"
          loading={redeploying}
          onClick={handleRedeploy}
          disabled={building || redeploying || !isDeployed}
          color="#7c3aed"
        />
        <ActionBtn
          label="Stop"
          loading={stopping}
          onClick={handleStop}
          disabled={stopping || !isDeployed || status?.status === 'STOPPED'}
          color="#6b7280"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number" min="0" max="50" value={scaleValue}
            onChange={e => setScaleValue(parseInt(e.target.value) || 0)}
            style={styles.scaleInput}
          />
          <ActionBtn
            label="Scale"
            loading={scaling}
            onClick={handleScale}
            disabled={scaling || !isDeployed}
            color="#059669"
          />
        </div>
      </div>

      {/* Operation errors */}
      <ErrorMessage error={buildError || deployError || redeployError || scaleError || stopError} />

      {/* Status summary */}
      {status && (
        <div style={styles.statusBox}>
          <strong>Status:</strong> <StatusBadge status={status.status} />
          {status.message && <span style={{ marginLeft: 10, color: '#6b7280', fontSize: 13 }}>{status.message}</span>}
          <span style={{ marginLeft: 16, fontSize: 13 }}>
            Ready: {status.readyReplicas}/{status.desiredReplicas}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        {['overview', 'pods', 'logs', 'service'].map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={styles.tabContent}>
        {activeTab === 'overview' && <OverviewTab app={app} status={status} />}
        {activeTab === 'pods'     && <PodsTab pods={pods} onRefresh={loadPods} />}
        {activeTab === 'logs'     && (
          <LogsTab
            logs={logs} loading={loadingLogs} error={logsError}
            logLines={logLines} setLogLines={setLogLines}
            onRefresh={loadLogs}
          />
        )}
        {activeTab === 'service'  && <ServiceTab info={serviceInfo} onRefresh={loadService} />}
      </div>
    </div>
  )
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

function OverviewTab({ app, status }) {
  return (
    <div>
      <h3 style={styles.sectionTitle}>Application Details</h3>
      <table style={styles.detailTable}>
        <tbody>
          {[
            ['ID', app.id],
            ['Name', app.name],
            ['Source Path', app.sourcePath],
            ['Docker Image', app.dockerImage],
            ['Container Port', app.containerPort],
            ['Replicas', app.replicas],
            ['K8s Deployment', app.k8sDeploymentName],
            ['K8s Service', app.k8sServiceName],
            ['Namespace', app.k8sNamespace],
            ['Created', new Date(app.createdAt).toLocaleString()],
            ['Updated', new Date(app.updatedAt).toLocaleString()],
          ].map(([k, v]) => (
            <tr key={k}>
              <td style={styles.dtKey}>{k}</td>
              <td style={styles.dtVal}>{v ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PodsTab({ pods, onRefresh }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Pods</h3>
        <button style={styles.btnSmall} onClick={onRefresh}>Refresh</button>
      </div>
      {pods.length === 0 && <p style={{ color: '#6b7280' }}>No pods found.</p>}
      <table style={styles.table}>
        {pods.length > 0 && (
          <thead>
            <tr>{['Name', 'Phase', 'Ready', 'Restarts', 'Node', 'Age'].map(h =>
              <th key={h} style={styles.th}>{h}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {pods.map(pod => (
            <tr key={pod.name} style={styles.tr}>
              <td style={styles.td}><code style={{ fontSize: 12 }}>{pod.name}</code></td>
              <td style={styles.td}>{pod.phase}</td>
              <td style={styles.td}>{pod.ready ? '✓' : '✗'}</td>
              <td style={styles.td}>{pod.restartCount}</td>
              <td style={styles.td}>{pod.nodeName ?? '—'}</td>
              <td style={styles.td}>
                {pod.createdAt ? timeSince(pod.createdAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LogsTab({ logs, loading, error, logLines, setLogLines, onRefresh }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Logs</h3>
        <input
          type="number" value={logLines} min="10" max="2000"
          onChange={e => setLogLines(parseInt(e.target.value) || 200)}
          style={{ ...styles.scaleInput, width: 70 }}
        />
        <span style={{ fontSize: 13, color: '#6b7280' }}>lines</span>
        <button style={styles.btnSmall} onClick={onRefresh}>Fetch</button>
        {loading && <Spinner size={14} />}
      </div>
      <ErrorMessage error={error} />
      <pre style={styles.logBox}>
        {logs || 'No logs yet. Deploy the application first.'}
      </pre>
    </div>
  )
}

function ServiceTab({ info, onRefresh }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Service</h3>
        <button style={styles.btnSmall} onClick={onRefresh}>Refresh</button>
      </div>
      {!info && <p style={{ color: '#6b7280' }}>No service info available.</p>}
      {info && (
        <table style={styles.detailTable}>
          <tbody>
            {[
              ['Name', info.name],
              ['Type', info.type],
              ['Cluster IP', info.clusterIp],
              ['Port', info.port],
              ['Target Port', info.targetPort],
              ['NodePort', info.nodePort],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={styles.dtKey}>{k}</td>
                <td style={styles.dtVal}>{v ?? '—'}</td>
              </tr>
            ))}
            {info.accessUrl && (
              <tr>
                <td style={styles.dtKey}>Access URL</td>
                <td style={styles.dtVal}>
                  <a href={info.accessUrl} target="_blank" rel="noreferrer"
                     style={{ color: '#2563eb' }}>
                    {info.accessUrl}
                  </a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ActionBtn({ label, loading, onClick, disabled, color }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: '7px 14px', borderRadius: 6, border: 'none',
        background: disabled || loading ? '#e5e7eb' : color,
        color: disabled || loading ? '#9ca3af' : '#fff',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {loading ? <Spinner size={13} /> : null}
      {label}
    </button>
  )
}

function timeSince(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const styles = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '24px 16px' },
  breadcrumb: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  link: { color: '#2563eb', textDecoration: 'none' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { margin: '0 0 4px', fontSize: 22, fontWeight: 700 },
  desc: { margin: 0, color: '#6b7280', fontSize: 14 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  actionBar: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statusBox: {
    background: '#f9fafb', border: '1px solid #e5e7eb',
    borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 14,
  },
  tabs: { display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 16 },
  tab: {
    padding: '8px 18px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 14, color: '#6b7280', fontWeight: 500,
  },
  tabActive: { color: '#2563eb', borderBottom: '2px solid #2563eb', marginBottom: -2 },
  tabContent: { minHeight: 200 },
  sectionTitle: { fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 },
  detailTable: { borderCollapse: 'collapse', width: '100%', maxWidth: 600 },
  dtKey: { padding: '6px 12px 6px 0', fontWeight: 500, fontSize: 13,
           color: '#6b7280', width: 160, verticalAlign: 'top' },
  dtVal: { padding: '6px 0', fontSize: 13, wordBreak: 'break-all' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: 13, fontWeight: 600,
        borderBottom: '2px solid #e5e7eb', color: '#374151' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '8px 10px', fontSize: 13, verticalAlign: 'middle' },
  logBox: {
    background: '#111827', color: '#d1fae5', padding: 16,
    borderRadius: 6, overflowX: 'auto', overflowY: 'auto',
    maxHeight: 500, fontSize: 12, lineHeight: 1.5, margin: 0,
    fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  scaleInput: {
    width: 60, padding: '6px 8px', borderRadius: 6,
    border: '1px solid #d1d5db', fontSize: 14, textAlign: 'center',
  },
  btnSmall: {
    padding: '5px 12px', borderRadius: 5, border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: 13,
  },
}
