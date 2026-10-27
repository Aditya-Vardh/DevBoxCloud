import { useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { C, R, FONT, TEMPLATE_ACCENT } from '../theme'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'

const TEMPLATES = [
  { id: 'ubuntu',    n: '01', label: 'Ubuntu 24.04',    sub: 'Full Linux desktop. XFCE, git, and the tools you already know.', tools: 'xfce · git · bash' },
  { id: 'python',    n: '02', label: 'Python 3.12',     sub: 'A ready interpreter, venv, pip, and compilers for native wheels.', tools: 'pip · venv · gcc' },
  { id: 'nodejs',    n: '03', label: 'Node.js 20 LTS',  sub: 'npm, npx, and git — the modern JavaScript studio, already lit.', tools: 'npm · npx · git' },
  { id: 'java',      n: '04', label: 'OpenJDK 21',      sub: 'Maven and Gradle on a stable JDK. Build without local ceremony.', tools: 'maven · gradle' },
  { id: 'react',     n: '05', label: 'React / Vite',    sub: 'A frontend stack that compiles the moment you sit down.', tools: 'vite · node · npm' },
  { id: 'fullstack', n: '06', label: 'Full Stack',      sub: 'Node, Python, Java, and a database — one room, every layer.', tools: 'node · python · java' },
]

const CAPABILITIES = [
  { n: '01', title: 'Browser terminal', body: 'A real ttyd shell in a tab. No SSH client, no keys to babysit, no tunnel to remember.' },
  { n: '02', title: 'XFCE desktop', body: 'Graphical apps over noVNC. Open a browser, sit at a Linux desk, leave nothing installed.' },
  { n: '03', title: 'Kubernetes isolation', body: 'Each environment is a pod with its own PVC. Neighbours cannot see your files or your process.' },
  { n: '04', title: 'Under ninety seconds', body: 'Name the room, choose a runtime, and start. Provisioning is the platform’s work, not yours.' },
  { n: '05', title: 'Persistent /workspace', body: 'Disk survives stop and restart. Your tree is waiting when you come back.' },
  { n: '06', title: 'Invitation links', body: 'Share terminal and desktop URLs with optional expiry. No cluster credentials leave the room.' },
]

function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect() } },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

function Reveal({ children, delay = 0, style, as: Tag = 'div' }) {
  const ref = useReveal()
  return (
    <Tag ref={ref} className="reveal" style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </Tag>
  )
}

function useParallax() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let frame = 0
    const onMove = (e) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const x = ((e.clientX - r.left) / r.width - 0.5) * 10
        const y = ((e.clientY - r.top) / r.height - 0.5) * 8
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`
      })
    }
    const onLeave = () => { el.style.transform = 'translate3d(0,0,0)' }
    const host = el.parentElement
    host?.addEventListener('mousemove', onMove)
    host?.addEventListener('mouseleave', onLeave)
    return () => {
      host?.removeEventListener('mousemove', onMove)
      host?.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [])
  return ref
}

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: FONT.sans, background: C.bg, color: C.body, overflowX: 'hidden', minHeight: '100vh' }}>
      <header className="lp-nav">
        <div style={S.navInner}>
          <Link to="/" style={S.brand} aria-label="DevBox Cloud">
            <BrandMark size={20} />
            <span style={S.brandName}>DevBox Cloud</span>
          </Link>
          <nav className="hide-sm" style={S.navLinks} aria-label="Page">
            <a href="#manifesto" style={S.navA}>Manifesto</a>
            <a href="#runtimes" style={S.navA}>Runtimes</a>
            <a href="#method" style={S.navA}>Method</a>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            <button
              className="cta-ink"
              style={S.navCta}
              onClick={() => navigate('/workspaces')}
            >
              Enter
            </button>
          </div>
        </div>
      </header>

      <section className="lp-hero" aria-labelledby="hero-heading">
        <div className="lp-hero-grid" style={S.heroGrid}>
          <div style={S.heroCopy}>
            <div className="anim-in" style={{ animationDuration: '0.5s', animationDelay: '0.04s' }}>
              <span className="eyebrow">Kubernetes-native studio</span>
            </div>
            <h1 id="hero-heading" style={S.heroH1}>
              <span style={S.lineWrap}>
                <span className="anim-in" style={{ ...S.line, animationDelay: '0.1s' }}>Rooms for</span>
              </span>
              <span style={S.lineWrap}>
                <span className="anim-in" style={{ ...S.line, animationDelay: '0.2s' }}>
                  software<span style={S.italic}>,</span>
                </span>
              </span>
              <span style={S.lineWrap}>
                <span className="anim-in" style={{ ...S.line, animationDelay: '0.3s' }}>
                  not laptops.
                </span>
              </span>
            </h1>
            <p className="anim-in" style={{ ...S.heroSub, animationDelay: '0.4s' }}>
              Isolated workspaces with a full Linux desktop and a browser terminal.
              Six runtimes. Persistent storage. Nothing to install locally.
            </p>
            <div className="anim-in" style={{ ...S.heroCtas, animationDelay: '0.5s' }}>
              <button id="hero-get-started" className="cta-ink" style={S.ctaPrimary} onClick={() => navigate('/workspaces')}>
                Open the platform
              </button>
              <a href="#method" style={S.ctaGhost}>See the method</a>
            </div>
            <div className="anim-in" style={{ ...S.heroMeta, animationDelay: '0.6s' }}>
              <span>ttyd terminal</span>
              <span style={S.metaRule} />
              <span>XFCE / noVNC</span>
              <span style={S.metaRule} />
              <span>Persistent PVC</span>
            </div>
          </div>
          <div style={S.heroStage}>
            <WorkspaceStage />
          </div>
        </div>
      </section>

      <section id="manifesto" style={S.section} aria-labelledby="manifesto-heading">
        <div className="lp-manifesto" style={S.manifesto}>
          <div className="eyebrow">Manifesto</div>
          <div>
            <Reveal>
              <h2 id="manifesto-heading" className="display" style={S.manifestoH}>
                Development should feel like architecture: considered, isolated, and ready before you sit down.
              </h2>
            </Reveal>
            <Reveal delay={90}>
              <p style={S.manifestoP}>
                DevBox Cloud is not another dashboard for containers. It is a set of rooms —
                Kubernetes pods with a desk, a shell, and a disk that remembers you.
                You choose a runtime. The cluster does the rest.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="runtimes" style={{ ...S.section, paddingTop: 0 }} aria-labelledby="runtimes-heading">
        <div style={S.wrap}>
          <div className="lp-hero-grid" style={S.splitHead}>
            <Reveal>
              <div className="eyebrow" style={{ marginBottom: 16 }}>Runtimes</div>
              <h2 id="runtimes-heading" className="display" style={S.sectionH}>
                Six rooms.<br />One click.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p style={S.aside}>
                Every template ships with its toolchain already installed.
                Open the terminal and begin. Files live in
                {' '}<code style={{ fontFamily: FONT.mono, fontSize: 13 }}>/workspace</code>.
              </p>
            </Reveal>
          </div>
          <div style={{ marginTop: 48 }}>
            {TEMPLATES.map((t, i) => {
              const a = TEMPLATE_ACCENT[t.id]
              return (
                <Reveal key={t.id} delay={i * 40}>
                  <button
                    className="lp-runtime"
                    onClick={() => navigate('/workspaces')}
                    aria-label={`Create ${t.label} workspace`}
                  >
                    <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.faint, letterSpacing: '0.08em' }}>{t.n}</span>
                    <span>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 22, fontWeight: 500, color: C.ink, fontFamily: FONT.serif, letterSpacing: '-0.03em' }}>
                          {t.label}
                        </span>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.color, display: 'inline-block' }} />
                      </span>
                      <span style={{ display: 'block', marginTop: 6, fontSize: 13, color: C.muted, maxWidth: 520, lineHeight: 1.55 }}>
                        {t.sub}
                      </span>
                    </span>
                    <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.faint, letterSpacing: '0.02em' }} className="hide-sm">
                      {t.tools}
                    </span>
                  </button>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section style={{ ...S.section, background: C.bgSurface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }} aria-labelledby="capabilities-heading">
        <div style={S.wrap}>
          <div className="lp-hero-grid" style={S.splitHead}>
            <Reveal>
              <div className="eyebrow" style={{ marginBottom: 16 }}>Capabilities</div>
              <h2 id="capabilities-heading" className="display" style={S.sectionH}>
                The craft of a studio, the scale of a cluster.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p style={S.aside}>
                Terminal, desktop, isolation, persistence, and sharing —
                the operations you already have, composed so they feel inevitable.
              </p>
            </Reveal>
          </div>
          <div style={{ marginTop: 40 }}>
            {CAPABILITIES.map((c, i) => (
              <Reveal key={c.n} delay={i * 40}>
                <div className="lp-cap">
                  <div style={{ fontFamily: FONT.mono, fontSize: 12, color: C.faint, letterSpacing: '0.1em', paddingTop: 4 }}>{c.n}</div>
                  <div>
                    <div style={{ fontSize: 18, color: C.ink, fontFamily: FONT.serif, letterSpacing: '-0.025em', marginBottom: 8 }}>{c.title}</div>
                    <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.65, maxWidth: 560 }}>{c.body}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="method" style={S.section} aria-labelledby="method-heading">
        <div style={S.wrap}>
          <Reveal>
            <div className="eyebrow" style={{ marginBottom: 16 }}>The method</div>
            <h2 id="method-heading" className="display" style={S.sectionH}>Three gestures.</h2>
          </Reveal>
          <div className="lp-workflow" style={S.workflow}>
            {[
              { n: '01', title: 'Name a workspace', body: 'A workspace is a named group. Keep related environments together without mixing their disks.' },
              { n: '02', title: 'Choose a runtime', body: 'Ubuntu, Python, Node.js, Java, React, or Full Stack. Resources provision on the cluster automatically.' },
              { n: '03', title: 'Open and work', body: 'Terminal for a shell. Desktop for XFCE. Files persist on the PVC across stop, start, and restart.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div style={{ ...S.step, borderRight: i === 2 ? 'none' : `1px solid ${C.border}` }}>
                  <div style={S.stepN}>{s.n}</div>
                  <div style={{ fontSize: 24, color: C.ink, fontFamily: FONT.serif, letterSpacing: '-0.03em', marginBottom: 12 }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{s.body}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-cta" style={S.ctaBand} aria-labelledby="cta-heading">
        <div style={{ ...S.wrap, display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 0.7fr)', gap: 48, alignItems: 'end' }} className="lp-hero-grid">
          <Reveal>
            <div className="eyebrow" style={{ marginBottom: 20 }}>Begin</div>
            <h2 id="cta-heading" className="display" style={{ ...S.sectionH, fontSize: 'clamp(40px, 7vw, 88px)' }}>
              Your room is waiting.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ margin: '0 0 24px', fontSize: 15, color: C.muted, lineHeight: 1.65 }}>
              Open the dashboard and create the first environment. Under a minute from name to shell.
            </p>
            <button id="cta-open-dashboard" className="cta-ink" style={S.ctaPrimary} onClick={() => navigate('/workspaces')}>
              Open dashboard
            </button>
          </Reveal>
        </div>
      </section>

      <footer style={S.footer} role="contentinfo">
        <div style={S.footerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={16} />
            <span style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>DevBox Cloud</span>
          </div>
          <span style={{ fontSize: 12, color: C.faint }}>Kubernetes-backed development environments</span>
          <ThemeToggle />
        </div>
      </footer>
    </div>
  )
}

function WorkspaceStage() {
  const ref = useParallax()
  return (
    <div className="anim-in" style={{ position: 'relative', minHeight: 480, animationDelay: '0.22s' }}>
      <div ref={ref} className="lp-stage" style={{ position: 'relative', transition: 'transform 0.45s var(--ease-out)' }}>
        <div className="lp-window" style={{ position: 'relative', zIndex: 1, transform: 'rotate(-1.2deg)' }}>
          <div style={S.winBar}>
            <span style={S.dot('#f07167')} />
            <span style={S.dot('#e8b84a')} />
            <span style={S.dot('#34d399')} />
            <span style={{ marginLeft: 10, fontSize: 10, color: 'rgba(244,241,234,0.35)', fontFamily: FONT.mono }}>
              xfce — python-studio
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#34d399', fontFamily: FONT.mono, letterSpacing: '0.08em' }}>
              RUNNING
            </span>
          </div>
          <div style={S.desktop}>
            <div style={S.deskGrid}>
              {['/workspace', 'venv', 'app.py', 'notes.md'].map((name, i) => (
                <div key={name} style={{ ...S.deskIcon, animation: `floatY 5.5s ${i * 0.4}s ease-in-out infinite` }}>
                  <div style={S.iconShape} />
                  <span>{name}</span>
                </div>
              ))}
            </div>
            <div style={S.panel}>
              <span>Applications</span>
              <span style={{ opacity: 0.5 }}>python-studio</span>
              <span style={{ marginLeft: 'auto', opacity: 0.5 }}>ttyd · vnc</span>
            </div>
          </div>
        </div>
        <div className="lp-window" style={{ position: 'absolute', right: -12, bottom: -36, width: '86%', zIndex: 2, transform: 'rotate(1.4deg)' }}>
          <div style={S.winBar}>
            <span style={S.dot('#f07167')} />
            <span style={S.dot('#e8b84a')} />
            <span style={S.dot('#34d399')} />
            <span style={{ marginLeft: 10, fontSize: 10, color: 'rgba(244,241,234,0.35)', fontFamily: FONT.mono }}>
              ttyd — /workspace
            </span>
          </div>
          <div style={{ padding: '14px 16px 16px', fontFamily: FONT.mono, fontSize: 11.5, lineHeight: 1.75 }}>
            <TermLine prompt="$" cmd="python3 --version" />
            <div style={{ color: 'rgba(244,241,234,0.32)', marginLeft: 18 }}>Python 3.12.3</div>
            <TermLine prompt="$" cmd="python3 -m venv .venv && source .venv/bin/activate" />
            <TermLine prompt="(.venv) $" cmd="pip install flask" />
            <div style={{ color: 'rgba(244,241,234,0.32)', marginLeft: 18 }}>Successfully installed flask-3.0.3</div>
            <TermLine prompt="(.venv) $" cmd="" cursor />
          </div>
        </div>
      </div>
    </div>
  )
}

function TermLine({ prompt, cmd, cursor }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <span style={{ color: '#34d399', flexShrink: 0, userSelect: 'none' }}>{prompt}</span>
      <span style={{ color: 'rgba(244,241,234,0.78)' }}>{cmd}</span>
      {cursor && (
        <span style={{
          display: 'inline-block', width: 7, height: 13,
          background: 'rgba(244,241,234,0.75)',
          animation: 'blink 1s step-start infinite',
        }} />
      )}
    </div>
  )
}

const S = {
  navInner: {
    maxWidth: 1180, margin: '0 auto', padding: '0 28px',
    height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
  brandName: { fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '0.04em', textTransform: 'uppercase' },
  navLinks: { display: 'flex', alignItems: 'center', gap: 22 },
  navA: { fontSize: 12, fontWeight: 500, color: C.muted, letterSpacing: '0.04em', textTransform: 'uppercase' },
  navCta: {
    padding: '8px 16px', borderRadius: R.pill,
    background: C.ink, color: C.inverse, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', fontFamily: FONT.sans,
  },

  heroGrid: {
    maxWidth: 1180, margin: '0 auto', padding: '48px 28px 64px',
    display: 'grid', gridTemplateColumns: 'minmax(0, 1.08fr) minmax(280px, 0.92fr)',
    gap: 40, alignItems: 'center',
  },
  heroCopy: { position: 'relative', zIndex: 1 },
  heroH1: { margin: '22px 0 20px' },
  lineWrap: { display: 'block', overflow: 'hidden' },
  line: {
    display: 'block',
    fontFamily: FONT.serif,
    fontSize: 'clamp(40px, 5.6vw, 72px)',
    fontWeight: 400,
    lineHeight: 0.96,
    letterSpacing: '-0.04em',
    color: C.ink,
  },
  italic: { fontStyle: 'italic', fontWeight: 300 },
  heroSub: {
    margin: '0 0 32px',
    fontSize: 16, color: C.muted, maxWidth: 440, lineHeight: 1.7,
  },
  heroCtas: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 36 },
  ctaPrimary: {
    padding: '13px 22px', borderRadius: R.pill,
    background: C.ink, color: C.inverse, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 700, letterSpacing: '0.01em', fontFamily: FONT.sans,
  },
  ctaGhost: {
    padding: '13px 20px', borderRadius: R.pill,
    background: 'transparent', color: C.body,
    border: `1px solid ${C.borderStrong}`,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
  },
  heroMeta: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: C.faint, letterSpacing: '0.08em', textTransform: 'uppercase', flexWrap: 'wrap' },
  metaRule: { width: 18, height: 1, background: C.borderStrong },
  heroStage: { position: 'relative', zIndex: 1, padding: '12px 8px 48px' },

  winBar: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 12px',
    borderBottom: '1px solid rgba(244,241,234,0.08)',
    background: 'rgba(244,241,234,0.03)',
  },
  dot: (c) => ({ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.75, flexShrink: 0 }),
  desktop: {
    height: 248,
    background:
      'radial-gradient(ellipse at 20% 0%, rgba(232,184,74,0.08), transparent 50%), linear-gradient(180deg, #1a1914 0%, #10100c 100%)',
    position: 'relative',
  },
  deskGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 72px)', gap: 18, padding: '28px 28px 0' },
  deskIcon: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'rgba(244,241,234,0.55)', fontSize: 10, fontFamily: FONT.mono },
  iconShape: { width: 34, height: 26, borderRadius: 4, border: '1px solid rgba(244,241,234,0.18)', background: 'rgba(244,241,234,0.06)' },
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 28, display: 'flex', alignItems: 'center', gap: 14,
    padding: '0 12px', fontSize: 10, color: 'rgba(244,241,234,0.55)',
    fontFamily: FONT.mono, background: 'rgba(0,0,0,0.45)',
    borderTop: '1px solid rgba(244,241,234,0.08)',
  },

  section: { padding: '104px 0' },
  wrap: { maxWidth: 1180, margin: '0 auto', padding: '0 28px' },
  sectionH: {
    margin: 0,
    fontSize: 'clamp(32px, 4.6vw, 56px)',
    color: C.ink,
  },
  splitHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.7fr)',
    gap: 40,
    alignItems: 'end',
  },
  aside: { margin: 0, fontSize: 15, color: C.muted, lineHeight: 1.7, maxWidth: 360 },
  manifesto: {
    maxWidth: 1180, margin: '0 auto', padding: '0 28px',
    display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)',
    columnGap: 40, rowGap: 8, alignItems: 'start',
  },
  manifestoH: {
    margin: 0,
    fontSize: 'clamp(28px, 4.4vw, 52px)',
    lineHeight: 1.12, maxWidth: 920,
  },
  manifestoP: {
    margin: '28px 0 0',
    fontSize: 16, color: C.muted, lineHeight: 1.75, maxWidth: 560,
  },

  workflow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 0,
    marginTop: 56,
    borderTop: `1px solid ${C.border}`,
  },
  step: {
    padding: '32px 28px 8px 0',
    borderRight: `1px solid ${C.border}`,
    minHeight: 180,
  },
  stepN: {
    fontFamily: FONT.mono, fontSize: 11, color: C.faint,
    letterSpacing: '0.14em', marginBottom: 28,
  },

  ctaBand: { padding: '120px 0', borderTop: `1px solid ${C.border}` },
  footer: { borderTop: `1px solid ${C.border}`, padding: '22px 0' },
  footerInner: {
    maxWidth: 1180, margin: '0 auto', padding: '0 28px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: 12,
  },
}
