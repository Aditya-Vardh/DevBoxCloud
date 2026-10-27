import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { environmentApi, invitationApi, buildInviteUrl, configApi } from '../api/client'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Button } from '../components/Button'
import { useAsync } from '../hooks/useAsync'
import { C, R, FONT, TEMPLATE_ACCENT } from '../theme'

const POLL = 5000

function desktopHref(env) {
  if (!env?.accessUrl) return '#'
  return env.desktopUrl || (env.accessUrl.replace(/\/+$/, '') + '/desktop/vnc.html?autoconnect=true&path=websockify')
}
function terminalHref(env) {
  if (!env?.accessUrl) return '#'
  return env.terminalUrl || (env.accessUrl.replace(/\/+$/, '') + '/terminal/')
}

export function EnvironmentDetailPage() {
  const { envId } = useParams()

  const [env, setEnv]               = useState(null)
  const [pods, setPods]             = useState([])
  const [logs, setLogs]             = useState('')
  const [logLines, setLogLines]     = useState(200)
  const [tab, setTab]               = useState('overview')
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const [showTech, setShowTech]     = useState(false)
  const [lanMode, setLanMode]       = useState(null)
  const poll = useRef(null)

  const { run: runStart,   loading: starting,   error: startError   } = useAsync()
  const { run: runStop,    loading: stopping,   error: stopError    } = useAsync()
  const { run: runRestart, loading: restarting, error: restartError } = useAsync()
  const { run: runDelete,  loading: deleting,   error: deleteError  } = useAsync()
  const { run: runLogs,    loading: logsLoading } = useAsync()

  useEffect(() => {
    loadEnv()
    configApi.get().then(setLanMode).catch(() => {})
    return () => clearInterval(poll.current)
  }, [envId])

  useEffect(() => {
    clearInterval(poll.current)
    if (!env) return
    if (['PROVISIONING','DELETING'].includes(env.status) || (env.status === 'RUNNING' && !env.accessUrl))
      poll.current = setInterval(refresh, POLL)
    return () => clearInterval(poll.current)
  }, [env?.status, env?.accessUrl])

  async function loadEnv() {
    setLoading(true); setLoadError(null)
    try { setEnv(await environmentApi.status(envId)) }
    catch (e) { setLoadError(e.message) }
    finally { setLoading(false) }
  }
  async function refresh() {
    try { setEnv(await environmentApi.status(envId)) } catch (_) {}
  }
  async function handleStart()   { const r = await runStart(environmentApi.start(envId));   if (r) setEnv(r) }
  async function handleStop()    { const r = await runStop(environmentApi.stop(envId));     if (r) setEnv(r) }
  async function handleRestart() { const r = await runRestart(environmentApi.restart(envId)); if (r) setEnv(r) }
  async function handleDelete()  { setShowDelete(false); await runDelete(environmentApi.delete(envId)); if (env?.workspaceId) window.location.href = `/workspaces/${env.workspaceId}` }
  async function fetchLogs() { const r = await runLogs(environmentApi.logs(envId, logLines)); if (r !== null) setLogs(r) }
  async function fetchPods() { try { setPods(await environmentApi.pods(envId)) } catch (_) {} }

  useEffect(() => {
    if (tab === 'logs') fetchLogs()
    if (tab === 'pods') fetchPods()
  }, [tab])

  if (loading) return (
    <div style={S.page}>
      <div className="skeleton" style={{ height: 16, width: 240, marginBottom: 28, borderRadius: R.md }} />
      <div className="skeleton" style={{ height: 100, marginBottom: 14, borderRadius: R.xl }} />
      <div className="skeleton" style={{ height: 240, borderRadius: R.xl }} />
    </div>
  )
  if (loadError) return <div style={S.page}><ErrorMessage error={loadError} /></div>
  if (!env) return null

  const a = TEMPLATE_ACCENT[env.templateId] ?? TEMPLATE_ACCENT.ubuntu
  const ready    = env.status === 'RUNNING' && !!env.accessUrl
  const canStart = ['STOPPED','FAILED','PROVISIONING'].includes(env.status)
  const canStop  = ['RUNNING','PROVISIONING'].includes(env.status)
  const TABS     = ['overview','quick start','share','pods','logs']

  return (
    <div className="page-enter" style={S.page}>

      <div style={S.breadcrumb}>
        <Link to="/workspaces" style={S.bcLink}>Workspaces</Link>
        <span style={S.bcSep}>/</span>
        <Link to={`/workspaces/${env.workspaceId}`} style={S.bcLink}>{env.workspaceName}</Link>
        <span style={S.bcSep}>/</span>
        <span style={{ color: C.body }}>{env.name}</span>
      </div>

      <div style={{ ...S.identity, borderTop: `2px solid ${a.color}` }}>
        <div style={S.identLeft}>
          <span style={{ ...S.templateDot, background: a.color }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={S.envName}>{env.name}</h1>
              <StatusBadge status={env.status} />
              {env.status === 'PROVISIONING' && <Spinner size={13} color={C.amber} />}
            </div>
            <div style={S.templateLabel}>{env.templateName}</div>
            <div style={S.chips}>
              <Chip>{env.cpuRequest} CPU</Chip>
              <Chip>{env.memoryRequest} RAM</Chip>
              <Chip>{env.storageSize} Disk</Chip>
            </div>
          </div>
        </div>

        {(ready || env.status === 'PROVISIONING') && (
          <div style={S.identRight}>
            {ready ? (
              <>
                <a href={env.accessUrl} target="_blank" rel="noreferrer" style={{ ...S.launchBtn, background: a.color, color: '#111' }}>
                  Open workspace ↗
                </a>
                <a href={terminalHref(env)} target="_blank" rel="noreferrer" style={{ ...S.launchBtn, background: C.chip, color: C.body, border: `1px solid ${C.border}` }}>
                  Terminal ↗
                </a>
                <a href={desktopHref(env)} target="_blank" rel="noreferrer" style={{ ...S.launchBtn, background: C.chip, color: C.body, border: `1px solid ${C.border}` }}>
                  Desktop ↗
                </a>
              </>
            ) : (
              <span style={{ fontSize: 12, color: C.amber, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Spinner size={12} color={C.amber} /> Starting…
              </span>
            )}
          </div>
        )}
      </div>

      {env.status === 'RUNNING' && !env.accessUrl && (
        <Banner type="info">Pod ready — establishing port-forward tunnel…</Banner>
      )}
      {ready && (
        <Banner type="success">
          Workspace ready —{' '}
          <a href={env.accessUrl} target="_blank" rel="noreferrer" style={{ color: C.green, fontWeight: 600 }}>
            open workspace ↗
          </a>
        </Banner>
      )}
      {env.failureReason && <Banner type="error">Failed: {env.failureReason}</Banner>}

      <div style={S.actionBar}>
        <Button size="sm" variant="secondary"
          style={canStart && !starting ? { color: C.green, borderColor: 'rgba(52,211,153,0.25)' } : {}}
          loading={starting} loadingLabel="Starting…"
          disabled={!canStart} onClick={handleStart}>
          Start
        </Button>
        <Button size="sm" variant="secondary" loading={stopping} loadingLabel="Stopping…"
          disabled={!canStop} onClick={handleStop}>
          Stop
        </Button>
        <Button size="sm" variant="secondary" loading={restarting} loadingLabel="Restarting…"
          disabled={env.status !== 'RUNNING'} onClick={handleRestart}>
          Restart
        </Button>
        <Button size="sm" variant="ghost" onClick={refresh}>Refresh</Button>
        <Button size="sm" variant="ghost" style={{ marginLeft: 'auto', color: C.red }}
          onClick={() => setShowDelete(true)} disabled={deleting}>
          {deleting ? <><Spinner size={12} color={C.red} /> Deleting…</> : 'Delete'}
        </Button>
      </div>

      <ErrorMessage error={startError || stopError || restartError || deleteError} />

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div>
        {tab === 'overview'    && <OverviewTab env={env} showTech={showTech} setShowTech={setShowTech} />}
        {tab === 'quick start' && <QuickStartTab env={env} />}
        {tab === 'share'       && <ShareTab envId={envId} lanMode={lanMode} />}
        {tab === 'pods'        && <PodsTab pods={pods} onRefresh={fetchPods} />}
        {tab === 'logs'        && <LogsTab logs={logs} loading={logsLoading} logLines={logLines} setLogLines={setLogLines} onFetch={fetchLogs} />}
      </div>

      {showDelete && (
        <ConfirmDialog
          title={`Delete "${env.name}"?`}
          message="This permanently removes the Kubernetes Deployment, Service, and PVC. All /workspace data will be lost."
          confirmLabel="Delete environment"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}

function OverviewTab({ env, showTech, setShowTech }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <InfoSection title="Status">
        <InfoGrid rows={[
          ['Status',   <StatusBadge status={env.status} />],
          ['Template', env.templateName],
          ['Category', env.templateCategory],
          ['Started',  env.startedAt ? fmt(env.startedAt) : '—'],
          ['Stopped',  env.stoppedAt ? fmt(env.stoppedAt) : '—'],
        ]} />
      </InfoSection>

      {(env.accessUrl || env.terminalUrl || env.desktopUrl) && (
        <InfoSection title="Access">
          <InfoGrid rows={[
            ...(env.accessUrl   ? [['Workspace', <UrlCell href={env.accessUrl}   label="Open ↗" />]] : []),
            ...(env.terminalUrl ? [['Terminal',  <UrlCell href={env.terminalUrl} label="Open ↗" />]] : []),
            ...(env.desktopUrl  ? [['Desktop',   <UrlCell href={env.desktopUrl}  label="Open ↗" />]] : []),
          ]} />
        </InfoSection>
      )}

      <InfoSection title="Resources">
        <InfoGrid rows={[
          ['CPU',     env.cpuRequest],
          ['Memory',  env.memoryRequest],
          ['Storage', env.storageSize],
        ]} />
      </InfoSection>

      <div>
        <button style={S.toggleRow} onClick={() => setShowTech(!showTech)}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Technical details</span>
          <span style={{ fontSize: 11, color: C.faint }}>{showTech ? '▲' : '▼'}</span>
        </button>
        {showTech && (
          <InfoGrid rows={[
            ['ID',          <MonoVal>{env.id}</MonoVal>],
            ['Namespace',   <MonoVal>{env.k8sNamespace}</MonoVal>],
            ['Deployment',  <MonoVal>{env.k8sDeploymentName}</MonoVal>],
            ['Service',     <MonoVal>{env.k8sServiceName}</MonoVal>],
            ['PVC',         <MonoVal>{env.k8sPvcName}</MonoVal>],
            ['NodePort',    env.nodePort ?? '—'],
            ['Created',     fmt(env.createdAt)],
            ['Updated',     fmt(env.updatedAt)],
          ]} />
        )}
      </div>
    </div>
  )
}

function QuickStartTab({ env }) {
  const cmds = env.templateQuickStart ? env.templateQuickStart.split('\n').filter(Boolean) : []
  if (!cmds.length) return <p style={{ color: C.faint, fontSize: 13 }}>No quick-start commands for this template.</p>
  return (
    <div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
        Run these in the <strong style={{ color: C.body }}>Terminal</strong> after opening your workspace.
      </p>
      <div style={S.termBlock}>
        {cmds.map((cmd, i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <span style={{ color: C.termGreen, userSelect: 'none' }}>$</span>
            <span style={{ color: C.termText }}>{cmd}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>
        Files are saved to <code style={{ fontFamily: FONT.mono }}>/workspace</code> and persist across restarts.
      </p>
    </div>
  )
}

function ShareTab({ envId, lanMode }) {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied]   = useState(null)

  useEffect(() => { load() }, [envId])

  async function load() {
    setLoading(true); setError(null)
    try { setInvites(await invitationApi.list(envId)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  async function create(expiresInHours) {
    setCreating(true)
    try {
      const inv = await invitationApi.create(envId, expiresInHours ? { expiresInHours } : {})
      await load()
      const url = buildInviteUrl(inv.code)
      navigator.clipboard.writeText(url).catch(() => {})
      setCopied(inv.code); setTimeout(() => setCopied(null), 3000)
    } catch (e) { setError(e.message) }
    finally { setCreating(false) }
  }
  async function revoke(id) {
    try { await invitationApi.revoke(id); await load() }
    catch (e) { setError(e.message) }
  }

  const active = invites.filter(i => !i.revoked)

  return (
    <div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.6, maxWidth: 520 }}>
        Create an invitation link. Anyone with the link can view this environment&rsquo;s terminal and desktop URLs.
        Invitations do not grant Kubernetes access.
      </p>
      {lanMode && !lanMode.workspaceLanMode && (
        <div style={{ ...S.banner('info'), marginBottom: 16 }}>
          LAN sharing is not active. Links use 127.0.0.1 and only work on this machine.
          Set <code style={{ fontFamily: FONT.mono, fontSize: 11 }}>DEVBOX_WORKSPACE_HOST</code> to share over LAN.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Button size="sm" variant="primary" loading={creating} onClick={() => create(72)}>
          Create link (72 h)
        </Button>
        <Button size="sm" variant="secondary" loading={creating} onClick={() => create(null)}>
          No expiry
        </Button>
      </div>
      <ErrorMessage error={error} />
      {loading
        ? <Spinner size={18} />
        : active.length === 0
        ? <p style={{ fontSize: 13, color: C.faint }}>No active invitation links.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map(inv => {
              const url = buildInviteUrl(inv.code)
              const isCopied = copied === inv.code
              return (
                <div key={inv.id} style={S.inviteRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT.mono, fontSize: 11, color: C.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {url}
                    </div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>
                      {inv.expiresAt ? `Expires ${new Date(inv.expiresAt).toLocaleDateString()}` : 'No expiry'}
                      {' · '}{inv.useCount} use{inv.useCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary"
                    style={isCopied ? { color: C.green } : {}}
                    onClick={() => { navigator.clipboard.writeText(url).catch(() => {}); setCopied(inv.code); setTimeout(() => setCopied(null), 2000) }}>
                    {isCopied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button size="sm" variant="ghost" style={{ color: C.red }}
                    onClick={() => revoke(inv.id)}>Revoke</Button>
                </div>
              )
            })}
          </div>
      }
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
        ? <p style={{ fontSize: 13, color: C.faint }}>No pods found for this environment.</p>
        : <TableWrap cols={['Name','Phase','Ready','Restarts','Node','Age']} rows={pods.map(p => [
            <code style={{ fontSize: 11, fontFamily: FONT.mono, color: C.muted }}>{p.name}</code>,
            p.phase,
            <span style={{ color: p.ready ? C.green : C.red }}>{p.ready ? '✓' : '✗'}</span>,
            p.restartCount,
            p.nodeName ?? '—',
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
      <pre style={S.logBox}>{logs || 'No logs. The environment must be running.'}</pre>
    </div>
  )
}

function InfoSection({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function InfoGrid({ rows }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: R.xl, overflow: 'hidden' }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', gap: 16, padding: '9px 16px', borderBottom: i < rows.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
          <span style={{ width: 120, flexShrink: 0, fontSize: 12, color: C.muted, fontWeight: 500 }}>{k}</span>
          <span style={{ fontSize: 12, color: C.body, wordBreak: 'break-all', flex: 1 }}>{v ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

function MonoVal({ children }) {
  return <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.body }}>{children}</span>
}

function UrlCell({ href, label }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ color: C.body, fontFamily: FONT.mono, fontSize: 11, wordBreak: 'break-all' }}>{href} <span style={{ opacity: 0.6 }}>↗</span></a>
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

function Chip({ children }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: R.pill,
      background: C.chip, border: `1px solid ${C.border}`,
      fontSize: 11, color: C.muted, fontWeight: 500,
    }}>{children}</span>
  )
}

function Banner({ type, children }) {
  const colors = {
    info:    { bg: C.amberLight, border: C.amberBorder, color: C.amber },
    success: { bg: C.greenLight, border: C.greenBorder,  color: C.green },
    error:   { bg: C.redLight,   border: C.redBorder,    color: C.red   },
  }
  const c = colors[type]
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: R.lg,
      padding: '10px 14px', color: c.color, fontSize: 13, lineHeight: 1.5,
      marginBottom: 10,
    }}>
      {children}
    </div>
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
    border: `1px solid ${C.border}`,
    borderRadius: R.xl, padding: '20px 24px',
    background: C.bgSurface, marginBottom: 12,
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
  },
  identLeft:     { display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 },
  templateDot:   { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6 },
  envName:       { margin: 0, fontSize: 28, fontWeight: 400, color: C.ink, letterSpacing: '-0.03em', fontFamily: FONT.serif },
  templateLabel: { fontSize: 12, color: C.muted, marginTop: 3, marginBottom: 10 },
  chips:         { display: 'flex', gap: 6, flexWrap: 'wrap' },
  identRight:    { display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end', flexShrink: 0 },

  launchBtn: {
    display: 'inline-flex', alignItems: 'center',
    padding: '7px 14px', borderRadius: R.lg,
    fontSize: 12, fontWeight: 700, textDecoration: 'none',
    whiteSpace: 'nowrap', transition: 'opacity 0.15s',
  },

  banner: (type) => ({
    background: type === 'info' ? C.amberLight : type === 'success' ? C.greenLight : C.redLight,
    border: `1px solid ${type === 'info' ? C.amberBorder : type === 'success' ? C.greenBorder : C.redBorder}`,
    borderRadius: R.lg, padding: '10px 14px',
    color: type === 'info' ? C.amber : type === 'success' ? C.green : C.red,
    fontSize: 13, lineHeight: 1.5, marginBottom: 10,
  }),

  actionBar: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
    marginBottom: 16, alignItems: 'center',
  },

  tabs: {
    display: 'flex', gap: 0,
    borderBottom: `1px solid ${C.border}`, marginBottom: 24,
  },
  tab: {
    padding: '9px 14px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.muted,
    borderBottom: '1px solid transparent', marginBottom: -1,
    fontFamily: FONT.sans, transition: 'color 0.15s',
    letterSpacing: '0.01em',
  },
  tabActive: { color: C.ink, borderBottom: `1px solid ${C.ink}` },

  toggleRow: {
    width: '100%', display: 'flex', justifyContent: 'space-between',
    padding: '10px 0', background: 'none', border: 'none',
    cursor: 'pointer', fontFamily: FONT.sans,
    borderBottom: `1px solid ${C.border}`, marginBottom: 0,
    transition: 'opacity 0.15s',
  },

  termBlock: {
    background: C.termBg, border: `1px solid ${C.border}`,
    borderRadius: R.xl, padding: '14px 18px',
    fontFamily: FONT.mono, fontSize: 12, lineHeight: 1.9,
  },

  inviteRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    border: `1px solid ${C.border}`, borderRadius: R.xl,
    padding: '12px 14px', background: C.bgSurface,
  },

  th: {
    textAlign: 'left', padding: '9px 14px',
    fontSize: 10, fontWeight: 700, color: C.faint,
    background: C.glass, borderBottom: `1px solid ${C.border}`,
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  td: { padding: '9px 14px', fontSize: 12, color: C.body, verticalAlign: 'middle' },

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
}
