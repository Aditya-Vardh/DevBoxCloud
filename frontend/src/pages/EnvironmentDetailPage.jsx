import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { environmentApi } from '../api/client'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Button } from '../components/Button'
import { useAsync } from '../hooks/useAsync'
import { C, R, SHADOW, TEMPLATE_ACCENT, FONT } from '../theme'

const POLL_INTERVAL = 5000

function isReady(env) {
  return env && env.status === 'RUNNING' && !!env.accessUrl
}

/**
 * Returns the URL for the noVNC desktop page.
 * Prefers the pre-built desktopUrl from the backend; falls back to constructing it.
 */
function desktopHref(env) {
  if (!env?.accessUrl) return '#'
  if (env.desktopUrl) return env.desktopUrl
  return env.accessUrl.replace(/\/+$/, '') + '/desktop/vnc.html?autoconnect=true&path=websockify'
}

/**
 * Returns the URL for the browser terminal (ttyd via /terminal/).
 * Prefers the pre-built terminalUrl from the backend; falls back to constructing it.
 */
function terminalHref(env) {
  if (!env?.accessUrl) return '#'
  if (env.terminalUrl) return env.terminalUrl
  return env.accessUrl.replace(/\/+$/, '') + '/terminal/'
}

/**
 * Returns the workspace landing page URL (/).
 * This is always the base accessUrl — it shows the template-specific HTML page.
 */
function workspaceHref(env) {
  if (!env?.accessUrl) return '#'
  return env.accessUrl
}

export function EnvironmentDetailPage() {
  const { envId } = useParams()

  const [env, setEnv]               = useState(null)
  const [pods, setPods]             = useState([])
  const [logs, setLogs]             = useState('')
  const [logLines, setLogLines]     = useState(200)
  const [activeTab, setActiveTab]   = useState('overview')
  const [showTech, setShowTech]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState(null)
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

  useEffect(() => {
    clearInterval(pollRef.current)
    if (!env) return
    const shouldPoll = ['PROVISIONING', 'DELETING'].includes(env.status)
      || (env.status === 'RUNNING' && !env.accessUrl)
    if (shouldPoll) pollRef.current = setInterval(refreshStatus, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [env?.status, env?.accessUrl])

  async function loadEnv() {
    setLoading(true)
    setLoadError(null)
    try { setEnv(await environmentApi.status(envId)) }
    catch (e) { setLoadError(e.message) }
    finally { setLoading(false) }
  }

  async function refreshStatus() {
    try { setEnv(await environmentApi.status(envId)) } catch (_) {}
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
    if (env?.workspaceId) window.location.href = `/workspaces/${env.workspaceId}`
  }
  async function fetchLogs() {
    const res = await runLogs(environmentApi.logs(envId, logLines))
    if (res !== null) setLogs(res)
  }
  async function fetchPods() {
    try { setPods(await environmentApi.pods(envId)) } catch (_) {}
  }

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs()
    if (activeTab === 'pods') fetchPods()
  }, [activeTab])

  if (loading) return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
      <div className="skeleton" style={{ height: 20, width: 220, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 200 }} />
    </div>
  )

  if (loadError) return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
      <ErrorMessage error={loadError} />
    </div>
  )
  if (!env) return null

  const accent = TEMPLATE_ACCENT[env.templateId] || TEMPLATE_ACCENT.ubuntu
  const ready   = isReady(env)
  const canStart = ['STOPPED', 'FAILED', 'PROVISIONING'].includes(env.status)
  const canStop  = env.status === 'RUNNING' || env.status === 'PROVISIONING'

  // Quick-start commands from backend
  const quickStartCmds = env.templateQuickStart
    ? env.templateQuickStart.split('\n').filter(Boolean)
    : []

  return (
    <div className="page-enter" style={S.page}>

      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <Link to="/" style={S.bcLink}>Workspaces</Link>
        <span style={S.bcSep}>/</span>
        <Link to={`/workspaces/${env.workspaceId}`} style={S.bcLink}>{env.workspaceName}</Link>
        <span style={S.bcSep}>/</span>
        <span style={{ color: C.body, fontWeight: 500 }}>{env.name}</span>
      </div>

      {/* ── Identity panel ────────────────────────────────────────────────────── */}
      <div style={{ ...S.identityPanel, borderTopColor: accent.color }}>
        <div style={S.identityLeft}>
          <div style={{
            width: 52, height: 52, borderRadius: R.lg, flexShrink: 0,
            background: accent.bg, border: `2px solid ${accent.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            {env.templateIcon}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={S.envName}>{env.name}</h1>
              <StatusBadge status={env.status} />
            </div>
            <div style={S.templateLabel}>{env.templateName}</div>
            <div style={S.metaRow}>
              <MetaChip>{env.cpuRequest} CPU</MetaChip>
              <MetaChip>{env.memoryRequest} RAM</MetaChip>
              <MetaChip>{env.storageSize} Disk</MetaChip>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div style={S.ctaCol}>
          {ready ? (
            <>
              <a href={workspaceHref(env)} target="_blank" rel="noreferrer" style={{
                ...S.ctaBtn, background: accent.color, borderColor: accent.color,
              }}>
                ⬡ Open Workspace ↗
              </a>
              <a href={desktopHref(env)} target="_blank" rel="noreferrer" style={{
                ...S.ctaBtn, background: C.ink, borderColor: C.ink, fontSize: 12,
              }}>
                🖥 Desktop ↗
              </a>
              <a href={terminalHref(env)} target="_blank" rel="noreferrer" style={{
                ...S.ctaBtn, background: '#1e293b', borderColor: '#334155', fontSize: 12,
              }}>
                💻 Terminal ↗
              </a>
            </>
          ) : env.status === 'PROVISIONING' ? (
            <div style={S.startingIndicator}>
              <Spinner size={14} color={C.amber} />
              <span>Starting workspace…</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Status banners ─────────────────────────────────────────────────────── */}
      {env.status === 'PROVISIONING' && (
        <div style={S.banner('info')}>
          <Spinner size={13} color={C.amberText} />
          <span>
            Launching VNC desktop, workspace gateway, and nginx — takes <strong>30–75 seconds</strong>.
            Auto-refreshing every {POLL_INTERVAL / 1000}s.
          </span>
        </div>
      )}
      {env.status === 'RUNNING' && !env.accessUrl && (
        <div style={S.banner('info')}>
          <Spinner size={13} color={C.amberText} />
          <span>Pod is <strong>Ready</strong> — establishing port-forward tunnel…</span>
        </div>
      )}
      {ready && (
        <div style={S.banner('success')}>
          <span style={{ color: C.green, fontWeight: 700 }}>✓</span>
          Workspace ready —{' '}
          <a href={workspaceHref(env)} target="_blank" rel="noreferrer"
            style={{ color: C.greenText, fontWeight: 600 }}>
            Open workspace ↗
          </a>
          {' '}· Gateway: <code style={S.gatewayCode}>{env.accessUrl}</code>
        </div>
      )}
      {env.failureReason && (
        <div style={S.banner('error')}>
          <strong>Failed:</strong> {env.failureReason}
        </div>
      )}

      {/* ── Action bar ─────────────────────────────────────────────────────────── */}
      <div style={S.actionBar}>
        <Button variant="primary" loading={starting} loadingLabel="Starting…"
          disabled={!canStart || starting} onClick={handleStart}
          style={{ background: canStart && !starting ? C.green : undefined }}>
          Start
        </Button>
        <Button variant="secondary" loading={stopping} loadingLabel="Stopping…"
          disabled={!canStop || stopping} onClick={handleStop}>
          Stop
        </Button>
        <Button variant="ghost" onClick={refreshStatus}>
          ↻ Refresh
        </Button>
        <Button variant="danger" style={{ marginLeft: 'auto' }}
          onClick={() => setShowDelete(true)} disabled={deleting}>
          {deleting ? <><Spinner size={13} /> Deleting…</> : 'Delete Environment'}
        </Button>
      </div>

      <ErrorMessage error={startError || stopError || deleteError} />

      {/* ── Tabs ───────────────────────────────────────────────────────────────── */}
      <div style={S.tabs}>
        {['overview', 'quick start', 'pods', 'logs'].map(tab => (
          <button key={tab}
            style={{ ...S.tab, ...(activeTab === tab ? S.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={S.tabContent}>
        {activeTab === 'overview'     && <OverviewTab env={env} accent={accent} showTech={showTech} setShowTech={setShowTech} />}
        {activeTab === 'quick start'  && <QuickStartTab cmds={quickStartCmds} templateName={env.templateName} />}
        {activeTab === 'pods'         && <PodsTab pods={pods} onRefresh={fetchPods} />}
        {activeTab === 'logs'         && <LogsTab logs={logs} loading={logsLoading}
                                           logLines={logLines} setLogLines={setLogLines} onFetch={fetchLogs} />}
      </div>

      {showDelete && (
        <ConfirmDialog
          title={`Delete "${env.name}"?`}
          message="This permanently removes the Kubernetes Deployment, Service, and PVC. All data in /workspace will be lost."
          confirmLabel="Delete Environment"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OverviewTab({ env, accent, showTech, setShowTech }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Workspace info */}
      <Section title="Workspace">
        <InfoGrid>
          <InfoRow label="Environment" value={env.name} mono />
          <InfoRow label="Template" value={`${env.templateIcon} ${env.templateName}`} />
          <InfoRow label="Category" value={env.templateCategory} />
          <InfoRow label="Status" value={<StatusBadge status={env.status} />} />
          <InfoRow label="Started" value={env.startedAt ? fmtDate(env.startedAt) : '—'} />
          <InfoRow label="Stopped" value={env.stoppedAt ? fmtDate(env.stoppedAt) : '—'} />
        </InfoGrid>
      </Section>

      {/* Access */}
      {(env.accessUrl || env.desktopUrl || env.terminalUrl) && (
        <Section title="Access URLs">
          <InfoGrid>
            {env.accessUrl   && <InfoRow label="Workspace"  value={<UrlLink href={env.accessUrl}  label="Landing page (/ )" />} />}
            {env.terminalUrl && <InfoRow label="Terminal"   value={<UrlLink href={env.terminalUrl} label="/terminal/" />} />}
            {env.desktopUrl  && <InfoRow label="Desktop"    value={<UrlLink href={env.desktopUrl}  label="/desktop/vnc.html" />} />}
          </InfoGrid>
        </Section>
      )}

      {/* Resources */}
      <Section title="Resources">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ResourceCard label="CPU" value={env.cpuRequest} accent={accent} />
          <ResourceCard label="Memory" value={env.memoryRequest} accent={accent} />
          <ResourceCard label="Storage" value={env.storageSize} accent={accent} />
        </div>
      </Section>

      {/* Technical details — collapsible */}
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: 'hidden',
      }}>
        <button
          style={S.techToggle}
          onClick={() => setShowTech(!showTech)}
          aria-expanded={showTech}
        >
          <span style={{ fontWeight: 600, fontSize: 13, color: C.body }}>Technical Details</span>
          <span style={{ color: C.faint, fontSize: 12 }}>{showTech ? '▲ hide' : '▼ show'}</span>
        </button>
        {showTech && (
          <div style={{ padding: '0 16px 16px', background: C.bgSurface }}>
            <InfoGrid>
              <InfoRow label="ID"         value={env.id}                 mono />
              <InfoRow label="Namespace"  value={env.k8sNamespace}       mono />
              <InfoRow label="Deployment" value={env.k8sDeploymentName}  mono />
              <InfoRow label="Service"    value={env.k8sServiceName}     mono />
              <InfoRow label="PVC"        value={env.k8sPvcName}         mono />
              <InfoRow label="NodePort"   value={env.nodePort ?? '—'}    />
              <InfoRow label="Created"    value={fmtDate(env.createdAt)} />
              <InfoRow label="Updated"    value={fmtDate(env.updatedAt)} />
            </InfoGrid>
          </div>
        )}
      </div>

    </div>
  )
}

function QuickStartTab({ cmds, templateName }) {
  if (!cmds || cmds.length === 0) {
    return <p style={{ color: C.muted, fontSize: 14 }}>No quick-start commands defined for this template.</p>
  }
  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.muted }}>
        Run these commands in the <strong>Terminal</strong> to get started with {templateName}.
      </p>
      <div style={{
        background: C.termBg, borderRadius: R.lg, padding: '16px 18px',
        fontFamily: FONT.mono, fontSize: 13, lineHeight: 1.8,
      }}>
        {cmds.map((cmd, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ color: C.termGreen, userSelect: 'none', flexShrink: 0 }}>$</span>
            <span style={{ color: C.termText }}>{cmd}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 12, color: C.faint }}>
        Files created in the terminal are saved to <code style={{ fontFamily: FONT.mono }}>/workspace</code> and persist across restarts.
      </p>
    </div>
  )
}

function PodsTab({ pods, onRefresh }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={S.secTitle}>Pods</h3>
        <Button size="sm" variant="secondary" onClick={onRefresh}>↻ Refresh</Button>
      </div>
      {pods.length === 0
        ? <EmptyMsg>No pods found for this environment.</EmptyMsg>
        : (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Name', 'Phase', 'Ready', 'Restarts', 'Node', 'Age'].map(h =>
                  <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {pods.map(pod => (
                  <tr key={pod.name} style={S.tr}>
                    <td style={S.td}><code style={{ fontSize: 11, fontFamily: FONT.mono }}>{pod.name}</code></td>
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
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ ...S.secTitle, margin: 0 }}>Container Logs</h3>
        <input type="number" value={logLines} min="10" max="2000"
          onChange={e => setLogLines(parseInt(e.target.value) || 200)}
          style={{
            width: 70, padding: '5px 8px', borderRadius: R.sm,
            border: `1px solid ${C.borderStrong}`, fontSize: 13,
            fontFamily: 'inherit', textAlign: 'center',
          }} />
        <span style={{ fontSize: 12, color: C.faint }}>lines</span>
        <Button size="sm" variant="secondary" onClick={onFetch}>Fetch</Button>
        {loading && <Spinner size={14} />}
      </div>
      <pre style={S.logBox}>
        {logs || 'No logs yet. The environment must be running.'}
      </pre>
    </div>
  )
}

// ── Shared small components ───────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function InfoGrid({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>{children}</div>
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${C.divider}`, padding: '7px 0', gap: 16 }}>
      <span style={{ width: 130, flexShrink: 0, fontSize: 13, color: C.muted, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.body, fontFamily: mono ? FONT.mono : undefined, wordBreak: 'break-all' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function UrlLink({ href, label }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      style={{ color: C.primary, fontSize: 13, wordBreak: 'break-all' }}>
      <span style={{ fontFamily: FONT.mono }}>{label || href}</span> ↗
    </a>
  )
}

function ResourceCard({ label, value, accent }) {
  return (
    <div style={{
      flex: '1 1 100px', minWidth: 90,
      background: accent.bg, border: `1px solid ${accent.border}`,
      borderRadius: R.lg, padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: accent.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: accent.color }}>{value}</span>
    </div>
  )
}

function MetaChip({ children }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: R.full,
      background: C.bgSubtle, border: `1px solid ${C.border}`,
      fontSize: 11, fontWeight: 500, color: C.muted,
    }}>
      {children}
    </span>
  )
}

function EmptyMsg({ children }) {
  return <p style={{ color: C.muted, fontSize: 13, margin: '8px 0' }}>{children}</p>
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeSince(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const S = {
  page: { maxWidth: 960, margin: '0 auto', padding: '28px 20px' },

  breadcrumb: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, marginBottom: 18 },
  bcLink: { color: C.muted, textDecoration: 'none' },
  bcSep: { color: C.border, fontSize: 16 },

  identityPanel: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 16, flexWrap: 'wrap',
    background: C.bg, border: `1px solid ${C.border}`,
    borderTop: '3px solid', borderRadius: R.xl,
    padding: '20px 24px', marginBottom: 14,
    boxShadow: SHADOW.md,
  },
  identityLeft: { display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1, minWidth: 0 },
  envName: { margin: 0, fontSize: 20, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' },
  templateLabel: { fontSize: 13, color: C.muted, marginTop: 3, fontWeight: 500 },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 },

  ctaCol: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 },
  ctaBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: R.md,
    color: '#fff', fontWeight: 700, fontSize: 13,
    textDecoration: 'none', border: '1px solid',
    whiteSpace: 'nowrap',
  },
  startingIndicator: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 13, color: C.amberText, fontWeight: 500,
    padding: '8px 0',
  },

  banner: (type) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: R.md, marginBottom: 10,
    fontSize: 13, lineHeight: 1.5,
    ...(type === 'info'    ? { background: C.amberLight, border: `1px solid ${C.amberBorder}`, color: C.amberText } :
        type === 'success' ? { background: C.greenLight,  border: `1px solid ${C.greenBorder}`, color: C.greenText } :
                             { background: C.redLight,    border: `1px solid ${C.redBorder}`,  color: C.redText }),
  }),

  gatewayCode: {
    fontFamily: FONT.mono, fontSize: 12, padding: '1px 4px',
    background: C.greenLight, borderRadius: R.sm,
  },

  actionBar: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' },

  tabs: { display: 'flex', borderBottom: `2px solid ${C.border}`, marginBottom: 20, gap: 2 },
  tab: {
    padding: '8px 16px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 500,
    borderBottom: '2px solid transparent', marginBottom: -2,
    fontFamily: 'inherit',
  },
  tabActive: { color: C.primary, borderBottom: `2px solid ${C.primary}` },
  tabContent: { minHeight: 180 },

  secTitle: { fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 10px' },

  techToggle: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', background: C.bgSurface,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    borderBottom: `1px solid ${C.border}`,
  },

  th: {
    textAlign: 'left', padding: '9px 14px',
    fontSize: 11, fontWeight: 600, color: C.muted,
    background: C.bgSurface, borderBottom: `1px solid ${C.border}`,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  tr: { borderBottom: `1px solid ${C.divider}` },
  td: { padding: '9px 14px', fontSize: 13, verticalAlign: 'middle' },

  logBox: {
    background: C.termBg, color: C.termText,
    padding: '16px 18px', borderRadius: R.lg,
    overflowX: 'auto', overflowY: 'auto',
    maxHeight: 480, fontSize: 12, lineHeight: 1.6,
    margin: 0, fontFamily: FONT.mono, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
}
