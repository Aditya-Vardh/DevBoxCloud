import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { environmentApi } from '../api/client'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAsync } from '../hooks/useAsync'

const POLL_INTERVAL = 5000

const STATUS_COLOR = {
  PENDING:      '#6b7280',
  PROVISIONING: '#2563eb',
  RUNNING:      '#16a34a',
  STOPPED:      '#6b7280',
  FAILED:       '#dc2626',
  DELETING:     '#9333ea',
  DELETED:      '#d1d5db',
}

function EnvBadge({ status }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 5,
      fontSize: 13, fontWeight: 700, color: '#fff',
      background: STATUS_COLOR[status] || '#6b7280',
      letterSpacing: '0.04em',
    }}>
      {status}
    </span>
  )
}

export function EnvironmentDetailPage() {
  const { envId } = useParams()

  const [env, setEnv]             = useState(null)
  const [pods, setPods]           = useState([])
  const [logs, setLogs]           = useState('')
  const [logLines, setLogLines]   = useState(200)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const pollRef = useRef(null)

  const { run: runStart,  loading: starting,  error: startError  } = useAsync()
  const { run: runStop,   loading: stopping,  error: stopError   } = useAsync()
  const { run: runDelete, loading: deleting,  error: deleteError } = useAsync()
  const { run: runLogs,   loading: logsLoading } = useAsync()

  useEffect(() => {
    loadEnv()
    return () => clearInterval(pollRef.current)
  }, [envId])

  // Auto-poll while provisioning
  useEffect(() => {
    clearInterval(pollRef.current)
    if (env && ['PROVISIONING', 'DELETING'].includes(env.status)) {
      pollRef.current = setInterval(refreshStatus, POLL_INTERVAL)
    }
    return () => clearInterval(pollRef.current)
  }, [env?.status])

  async function loadEnv() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await environmentApi.status(envId)
      setEnv(data)
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function refreshStatus() {
    try {
      const data = await environmentApi.status(envId)
      setEnv(data)
    } catch (_) {}
  }

  async function handleStart() {
    const res = await runStart(environmentApi.start(envId))
    if (res) setEnv(res)
  }

  async function handleStop() {
    const res = await runStop(environmentApi.stop(envId))
    if (res) setEnv(res)
  }

  async function handleDelete() {
    setShowDelete(false)
    await runDelete(environmentApi.delete(envId))
    // Navigate back to workspace
    if (env?.workspaceId) {
      window.location.href = `/workspaces/${env.workspaceId}`
    }
  }

  async function fetchLogs() {
    const res = await runLogs(environmentApi.logs(envId, logLines))
    if (res !== null) setLogs(res)
  }

  async function fetchPods() {
    try {
      const data = await environmentApi.pods(envId)
      setPods(data)
    } catch (_) {}
  }

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs()
    if (activeTab === 'pods') fetchPods()
  }, [activeTab])

  if (loading) return <div style={{ padding: 32 }}><Spinner size={24} /></div>
  if (loadError) return <div style={{ padding: 24 }}><ErrorMessage error={loadError} /></div>
  if (!env) return null

  const canStart  = ['STOPPED', 'FAILED', 'PROVISIONING'].includes(env.status)
  const canStop   = env.status === 'RUNNING' || env.status === 'PROVISIONING'
  const isRunning = env.status === 'RUNNING'

  return (
    <div style={S.page}>
      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <Link to="/" style={S.link}>Workspaces</Link>
        {' / '}
        <Link to={`/workspaces/${env.workspaceId}`} style={S.link}>{env.workspaceName}</Link>
        {' / '}
        <span style={{ fontWeight: 600 }}>{env.name}</span>
      </div>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>{env.templateIcon}</span>
            <h1 style={S.title}>{env.name}</h1>
            <EnvBadge status={env.status} />
          </div>
          {env.description && <p style={S.desc}>{env.description}</p>}
          <div style={S.meta}>
            {env.templateName} &nbsp;·&nbsp;
            CPU: {env.cpuRequest} &nbsp;·&nbsp;
            Memory: {env.memoryRequest} &nbsp;·&nbsp;
            Storage: {env.storageSize}
          </div>
        </div>

        {/* Open Workspace button — primary CTA when running */}
        {isRunning && env.accessUrl && (
          <a href={env.accessUrl} target="_blank" rel="noreferrer" style={S.btnOpen}>
            Open Workspace ↗
          </a>
        )}
      </div>

      {/* Auto-provisioning notice */}
      {env.status === 'PROVISIONING' && (
        <div style={S.provisioningBanner}>
          <Spinner size={14} />
          <span>Provisioning Kubernetes resources… This usually takes 15-60 seconds.</span>
        </div>
      )}

      {/* Failure reason */}
      {env.failureReason && (
        <div style={S.failBanner}>{env.failureReason}</div>
      )}

      {/* Action bar */}
      <div style={S.actionBar}>
        <ActionBtn label="Start"  loading={starting} onClick={handleStart}
          disabled={!canStart || starting} color="#16a34a" />
        <ActionBtn label="Stop"   loading={stopping} onClick={handleStop}
          disabled={!canStop  || stopping} color="#6b7280" />
        <ActionBtn label="Refresh status" loading={false} onClick={refreshStatus}
          disabled={false} color="#2563eb" />
        <button
          style={{ ...S.btnDanger, marginLeft: 'auto' }}
          onClick={() => setShowDelete(true)}
          disabled={deleting}
        >
          {deleting ? <Spinner size={13} /> : 'Delete Environment'}
        </button>
      </div>

      <ErrorMessage error={startError || stopError || deleteError} />

      {/* URL info when running but no accessUrl yet */}
      {isRunning && !env.accessUrl && (
        <div style={S.infoBox}>
          Environment is running. NodePort: {env.nodePort ?? '(assigned soon)'}
          <br />
          <small style={{ color: '#6b7280' }}>
            Run <code>minikube ip</code> to get the IP, then open http://&lt;ip&gt;:{env.nodePort}.
          </small>
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabs}>
        {['overview', 'pods', 'logs'].map(tab => (
          <button key={tab}
            style={{ ...S.tab, ...(activeTab === tab ? S.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={S.tabContent}>
        {activeTab === 'overview' && <OverviewTab env={env} />}
        {activeTab === 'pods'     && <PodsTab pods={pods} onRefresh={fetchPods} />}
        {activeTab === 'logs'     && (
          <LogsTab logs={logs} loading={logsLoading}
            logLines={logLines} setLogLines={setLogLines} onFetch={fetchLogs} />
        )}
      </div>

      {showDelete && (
        <ConfirmDialog
          message={`Delete environment "${env.name}"? This permanently removes all Kubernetes resources and storage.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

function OverviewTab({ env }) {
  return (
    <div>
      <h3 style={S.sectionTitle}>Environment Details</h3>
      <table style={S.detailTable}>
        <tbody>
          {[
            ['ID',              env.id],
            ['Template',        `${env.templateIcon} ${env.templateName}`],
            ['Status',          env.status],
            ['CPU Request',     env.cpuRequest],
            ['Memory Request',  env.memoryRequest],
            ['Storage',         env.storageSize],
            ['Namespace',       env.k8sNamespace],
            ['Deployment',      env.k8sDeploymentName],
            ['Service',         env.k8sServiceName],
            ['PVC',             env.k8sPvcName],
            ['NodePort',        env.nodePort ?? '—'],
            ['Access URL',      env.accessUrl ?? '—'],
            ['Created',         new Date(env.createdAt).toLocaleString()],
            ['Updated',         new Date(env.updatedAt).toLocaleString()],
            ['Started',         env.startedAt ? new Date(env.startedAt).toLocaleString() : '—'],
            ['Stopped',         env.stoppedAt ? new Date(env.stoppedAt).toLocaleString() : '—'],
          ].map(([k, v]) => (
            <tr key={k}>
              <td style={S.dtKey}>{k}</td>
              <td style={S.dtVal}>
                {k === 'Access URL' && env.accessUrl
                  ? <a href={env.accessUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{env.accessUrl}</a>
                  : (v ?? '—')}
              </td>
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
        <h3 style={{ ...S.sectionTitle, margin: 0 }}>Pods</h3>
        <button style={S.btnSmall} onClick={onRefresh}>Refresh</button>
      </div>
      {pods.length === 0
        ? <p style={{ color: '#6b7280' }}>No pods found.</p>
        : (
          <table style={S.table}>
            <thead>
              <tr>{['Name','Phase','Ready','Restarts','Node','Age'].map(h =>
                <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {pods.map(pod => (
                <tr key={pod.name} style={S.tr}>
                  <td style={S.td}><code style={{ fontSize: 11 }}>{pod.name}</code></td>
                  <td style={S.td}>{pod.phase}</td>
                  <td style={S.td}>{pod.ready ? '✓' : '✗'}</td>
                  <td style={S.td}>{pod.restartCount}</td>
                  <td style={S.td}>{pod.nodeName ?? '—'}</td>
                  <td style={S.td}>{pod.createdAt ? timeSince(pod.createdAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  )
}

function LogsTab({ logs, loading, logLines, setLogLines, onFetch }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ ...S.sectionTitle, margin: 0 }}>Logs</h3>
        <input type="number" value={logLines} min="10" max="2000"
          onChange={e => setLogLines(parseInt(e.target.value) || 200)}
          style={{ ...S.scaleInput, width: 70 }} />
        <span style={{ fontSize: 13, color: '#6b7280' }}>lines</span>
        <button style={S.btnSmall} onClick={onFetch}>Fetch</button>
        {loading && <Spinner size={14} />}
      </div>
      <pre style={S.logBox}>
        {logs || 'No logs yet. Environment must be running to retrieve logs.'}
      </pre>
    </div>
  )
}

function ActionBtn({ label, loading, onClick, disabled, color }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      padding: '7px 14px', borderRadius: 6, border: 'none',
      background: disabled || loading ? '#e5e7eb' : color,
      color: disabled || loading ? '#9ca3af' : '#fff',
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      fontSize: 13, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {loading ? <Spinner size={13} /> : null}
      {label}
    </button>
  )
}

function timeSince(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const S = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '24px 16px' },
  breadcrumb: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  link: { color: '#2563eb', textDecoration: 'none' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { margin: 0, fontSize: 22, fontWeight: 700 },
  desc: { margin: '0 0 4px', color: '#6b7280', fontSize: 14 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  provisioningBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: 6, padding: '10px 14px', marginBottom: 14,
    fontSize: 13, color: '#1d4ed8',
  },
  failBanner: {
    background: '#fee2e2', border: '1px solid #fca5a5',
    borderRadius: 6, padding: '10px 14px', marginBottom: 14,
    fontSize: 13, color: '#b91c1c',
  },
  infoBox: {
    background: '#f0fdf4', border: '1px solid #86efac',
    borderRadius: 6, padding: '10px 14px', marginBottom: 14,
    fontSize: 13, color: '#166534',
  },
  actionBar: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' },
  btnOpen: {
    display: 'inline-block', padding: '10px 20px',
    borderRadius: 7, background: '#16a34a', color: '#fff',
    fontWeight: 700, fontSize: 14, textDecoration: 'none',
    flexShrink: 0,
  },
  btnDanger: {
    padding: '7px 14px', borderRadius: 6, border: '1px solid #fca5a5',
    background: '#fee2e2', color: '#dc2626', cursor: 'pointer',
    fontSize: 13, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  btnSmall: {
    padding: '5px 12px', borderRadius: 5, border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: 13,
  },
  tabs: { display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 16 },
  tab: {
    padding: '8px 18px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 14, color: '#6b7280', fontWeight: 500,
  },
  tabActive: { color: '#2563eb', borderBottom: '2px solid #2563eb', marginBottom: -2 },
  tabContent: { minHeight: 200 },
  sectionTitle: { fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 },
  detailTable: { borderCollapse: 'collapse', width: '100%', maxWidth: 680 },
  dtKey: { padding: '5px 12px 5px 0', fontWeight: 500, fontSize: 13, color: '#6b7280', width: 160, verticalAlign: 'top' },
  dtVal: { padding: '5px 0', fontSize: 13, wordBreak: 'break-all' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: 13, fontWeight: 600, borderBottom: '2px solid #e5e7eb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '8px 10px', fontSize: 13 },
  logBox: {
    background: '#111827', color: '#d1fae5', padding: 16,
    borderRadius: 6, overflowX: 'auto', overflowY: 'auto',
    maxHeight: 500, fontSize: 12, lineHeight: 1.5, margin: 0,
    fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  scaleInput: {
    padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db',
    fontSize: 14, textAlign: 'center',
  },
}
