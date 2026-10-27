import { useNavigate } from 'react-router-dom'
import { C, R, SHADOW, TEMPLATE_ACCENT, FONT } from '../theme'

const TEMPLATES = [
  {
    id: 'ubuntu',
    icon: '🐧',
    name: 'Ubuntu',
    subtitle: 'Ubuntu 24.04 LTS',
    desc: 'Full Linux desktop with XFCE, browser terminal, bash, git, curl, vim, and build tools.',
    tools: ['bash', 'git', 'curl', 'vim', 'htop', 'build-essential'],
  },
  {
    id: 'python',
    icon: '🐍',
    name: 'Python',
    subtitle: 'Python 3.12',
    desc: 'Python 3.12 with pip, venv, and virtualenv. Both python and python3 available.',
    tools: ['python3', 'pip3', 'venv', 'virtualenv', 'git'],
  },
  {
    id: 'nodejs',
    icon: '🟩',
    name: 'Node.js',
    subtitle: 'Node.js 20 LTS',
    desc: 'Node.js 20 LTS with npm and npx. Ready for any JavaScript or TypeScript project.',
    tools: ['node', 'npm', 'npx', 'git'],
  },
  {
    id: 'java',
    icon: '☕',
    name: 'Java',
    subtitle: 'OpenJDK 21',
    desc: 'OpenJDK 21 with javac, Maven, and Gradle. Ideal for enterprise Java development.',
    tools: ['java', 'javac', 'mvn', 'gradle', 'git'],
  },
  {
    id: 'react',
    icon: '⚛️',
    name: 'React',
    subtitle: 'React / Vite',
    desc: 'Node.js 20 with full React + Vite support. Scaffold modern web apps instantly.',
    tools: ['node', 'npm', 'npx', 'git'],
  },
  {
    id: 'fullstack',
    icon: '🚀',
    name: 'Full Stack',
    subtitle: 'Multi-language',
    desc: 'Node.js + Python + Java + Maven + PostgreSQL client + Docker CLI in one workspace.',
    tools: ['node', 'python3', 'java', 'mvn', 'psql', 'docker'],
  },
]

const FEATURES = [
  {
    icon: '💻',
    title: 'Browser Terminal',
    desc: 'Full ttyd terminal runs inside your browser. No SSH, no client setup.',
  },
  {
    icon: '🖥️',
    title: 'XFCE Desktop',
    desc: 'Graphical XFCE4 desktop via noVNC and TigerVNC. Run GUI apps from any browser.',
  },
  {
    icon: '⎈',
    title: 'Kubernetes-backed',
    desc: 'Every workspace runs as an isolated Kubernetes pod with a PVC for persistent data.',
  },
  {
    icon: '⚡',
    title: 'Persistent Storage',
    desc: 'Files in /workspace survive pod restarts. Pick up right where you left off.',
  },
  {
    icon: '🔒',
    title: 'Isolated Environments',
    desc: 'Namespace isolation keeps your code and data separate from every other workspace.',
  },
  {
    icon: '🔗',
    title: 'Share & Collaborate',
    desc: 'Share workspace access with teammates via secure invitation links.',
  },
]

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: FONT.sans, background: C.bg, color: C.body, minHeight: '100vh' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header style={S.nav}>
        <div style={S.navInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={S.logoMark}>⬡</span>
            <span style={S.logoText}>DevBox</span>
            <span style={S.logoTagline}>Cloud Development</span>
          </div>
          <button style={S.navCta} onClick={() => navigate('/workspaces')}>
            Open Dashboard →
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={S.hero}>
        <div style={S.heroInner}>
          <div style={S.heroLabel}>Cloud Development Platform</div>
          <h1 style={S.heroHeading}>
            Development environments,<br />
            <span style={{ color: C.primary }}>ready in seconds.</span>
          </h1>
          <p style={S.heroDesc}>
            DevBox gives you isolated, Kubernetes-backed development workspaces with a
            full Linux desktop and browser terminal — for six popular runtimes.
            No local setup. No conflicts. Just open a tab and code.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button style={S.heroCta} onClick={() => navigate('/workspaces')}>
              Get started — it's free
            </button>
            <a href="#environments" style={S.heroCtaSecondary}>
              View environments ↓
            </a>
          </div>

          {/* Terminal preview */}
          <div style={S.terminalCard}>
            <div style={S.terminalBar}>
              <span style={S.termDot('red')} />
              <span style={S.termDot('amber')} />
              <span style={S.termDot('green')} />
              <span style={S.termTitle}>DevBox — Python 3.12</span>
            </div>
            <div style={S.termBody}>
              <TermLine prompt user="pyth" cmd="python3 --version" />
              <TermOut>Python 3.12.3</TermOut>
              <TermLine prompt user="pyth" cmd="python3 -m venv .venv && source .venv/bin/activate" />
              <TermLine prompt user="pyth" prefix="(.venv)" cmd="pip install flask" />
              <TermOut>Collecting flask<br />Successfully installed flask-3.0.3 ✓</TermOut>
              <TermLine prompt user="pyth" prefix="(.venv)" cmd="" cursor />
            </div>
          </div>
        </div>
      </section>

      {/* ── Environments ────────────────────────────────────────────────────── */}
      <section id="environments" style={S.section}>
        <div style={S.sectionInner}>
          <SectionLabel>Six environments</SectionLabel>
          <SectionTitle>Pick the right runtime, instantly.</SectionTitle>
          <SectionDesc>
            Every environment ships with its full toolchain pre-installed. Open the terminal and start coding.
          </SectionDesc>
          <div style={S.envGrid}>
            {TEMPLATES.map(t => {
              const a = TEMPLATE_ACCENT[t.id] || TEMPLATE_ACCENT.ubuntu
              return (
                <div key={t.id}
                  style={{ ...S.envCard, borderTop: `3px solid ${a.color}`, cursor: 'pointer' }}
                  className="card-hover card-hover-lift"
                  onClick={() => navigate('/workspaces')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('/workspaces')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ ...S.envIcon, background: a.bg, border: `1px solid ${a.border}` }}>
                      {t.icon}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: a.color, fontWeight: 600 }}>{t.subtitle}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: C.muted, margin: '0 0 10px', lineHeight: 1.55 }}>
                    {t.desc}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {t.tools.map(tool => (
                      <span key={tool} style={{
                        padding: '2px 7px', borderRadius: R.sm,
                        background: a.bg, border: `1px solid ${a.border}`,
                        color: a.color, fontSize: 10, fontWeight: 600,
                        fontFamily: FONT.mono,
                      }}>
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section style={{ ...S.section, background: C.bgSurface }}>
        <div style={S.sectionInner}>
          <SectionLabel>Platform features</SectionLabel>
          <SectionTitle>Built for real development work.</SectionTitle>
          <div style={S.featGrid}>
            {FEATURES.map(f => (
              <div key={f.title} style={S.featCard}>
                <div style={S.featIcon}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 5 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section style={S.section}>
        <div style={S.sectionInner}>
          <SectionLabel>How it works</SectionLabel>
          <SectionTitle>Three steps to a running workspace.</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 40 }}>
            {[
              { n: '1', title: 'Create a workspace', desc: 'Give your workspace a name and group your environments inside it.' },
              { n: '2', title: 'Choose a template', desc: 'Pick Python, Node.js, Java, React, Full Stack, or Ubuntu. Resources provision automatically.' },
              { n: '3', title: 'Open and code', desc: 'Click "Terminal" for a browser shell or "Desktop" for a full XFCE GUI. Files persist.' },
            ].map(step => (
              <div key={step.n} style={S.stepCard}>
                <div style={S.stepNum}>{step.n}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 6 }}>{step.title}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section style={{ ...S.section, background: C.primary }}>
        <div style={{ ...S.sectionInner, textAlign: 'center', padding: '64px 24px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Ready to start building?
          </h2>
          <p style={{ margin: '0 0 32px', fontSize: 15, color: 'rgba(255,255,255,0.8)' }}>
            Open the dashboard and create your first workspace in under a minute.
          </p>
          <button style={{ ...S.heroCta, background: '#fff', color: C.primary, border: 'none' }}
            onClick={() => navigate('/workspaces')}>
            Open Dashboard →
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={S.footer}>
        <div style={S.footerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⬡</span>
            <span style={{ fontWeight: 700, color: C.ink }}>DevBox Cloud</span>
          </div>
          <span style={{ fontSize: 12, color: C.faint }}>
            Kubernetes-backed development environments · CNAD32 Project
          </span>
          <button
            onClick={() => navigate('/workspaces')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: 12, fontWeight: 600 }}>
            Dashboard →
          </button>
        </div>
      </footer>
    </div>
  )
}

// ── Tiny helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      display: 'inline-block', marginBottom: 8,
      padding: '3px 10px', borderRadius: R.full,
      background: '#eff6ff', border: '1px solid #bfdbfe',
      fontSize: 11, fontWeight: 700, color: C.primary,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>
      {children}
    </h2>
  )
}

function SectionDesc({ children }) {
  return (
    <p style={{ margin: '0 0 36px', fontSize: 14, color: C.muted, maxWidth: 520 }}>
      {children}
    </p>
  )
}

function TermLine({ user, cmd, cursor, prefix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
      {prefix && <span style={{ color: '#fbbf24', flexShrink: 0 }}>{prefix}</span>}
      <span style={{ color: '#4ade80', flexShrink: 0 }}>{user}@devbox</span>
      <span style={{ color: '#64748b' }}>:</span>
      <span style={{ color: '#60a5fa' }}>/workspace</span>
      <span style={{ color: '#64748b' }}>$</span>
      <span style={{ color: '#f8fafc' }}> {cmd}</span>
      {cursor && <span style={{ display: 'inline-block', width: 8, height: 14, background: '#60a5fa', verticalAlign: 'text-bottom', animation: 'blink 1s step-start infinite' }}>▋</span>}
    </div>
  )
}

function TermOut({ children }) {
  return (
    <div style={{ color: '#94a3b8', fontSize: 12, marginLeft: 8, marginTop: 2, lineHeight: 1.6 }}>
      {children}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  nav: {
    position: 'sticky', top: 0, zIndex: 50,
    background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${C.border}`,
    boxShadow: SHADOW.sm,
  },
  navInner: {
    maxWidth: 1080, margin: '0 auto', padding: '0 24px',
    height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  logoMark: { fontSize: 20, lineHeight: 1, color: C.primary },
  logoText: { fontWeight: 800, fontSize: 16, color: C.ink, letterSpacing: '-0.01em' },
  logoTagline: { fontSize: 11, color: C.muted, fontWeight: 500, marginTop: 1 },
  navCta: {
    padding: '7px 16px', borderRadius: R.md,
    background: C.primary, color: '#fff',
    border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: 13,
  },

  hero: {
    background: 'linear-gradient(180deg, #f8faff 0%, #fff 60%)',
    borderBottom: `1px solid ${C.border}`,
  },
  heroInner: {
    maxWidth: 800, margin: '0 auto', padding: '72px 24px 64px',
    textAlign: 'center',
  },
  heroLabel: {
    display: 'inline-block', marginBottom: 16,
    padding: '4px 12px', borderRadius: R.full,
    background: '#eff6ff', border: `1px solid #bfdbfe`,
    fontSize: 11, fontWeight: 700, color: C.primary,
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  heroHeading: {
    margin: '0 0 16px',
    fontSize: 42, fontWeight: 900, lineHeight: 1.15,
    color: C.ink, letterSpacing: '-0.035em',
  },
  heroDesc: {
    margin: '0 auto 32px',
    fontSize: 16, color: C.muted, maxWidth: 580, lineHeight: 1.65,
  },
  heroCta: {
    display: 'inline-block', padding: '12px 24px', borderRadius: R.lg,
    background: C.primary, color: '#fff',
    border: `1px solid ${C.primary}`,
    fontWeight: 700, fontSize: 14, cursor: 'pointer',
    textDecoration: 'none',
  },
  heroCtaSecondary: {
    display: 'inline-flex', alignItems: 'center', padding: '12px 24px', borderRadius: R.lg,
    background: 'transparent', color: C.body,
    border: `1px solid ${C.border}`,
    fontWeight: 600, fontSize: 14, cursor: 'pointer',
    textDecoration: 'none',
  },

  terminalCard: {
    marginTop: 48, borderRadius: R.xl, overflow: 'hidden',
    border: `1px solid #1e293b`, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    maxWidth: 620, marginLeft: 'auto', marginRight: 'auto',
    textAlign: 'left',
  },
  terminalBar: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
    background: '#1e293b', borderBottom: '1px solid #0f172a',
  },
  termTitle: { fontSize: 11, color: '#64748b', marginLeft: 8, flexGrow: 1 },
  termDot: (color) => ({
    width: 10, height: 10, borderRadius: '50%',
    background: color === 'red' ? '#f87171' : color === 'amber' ? '#fbbf24' : '#4ade80',
    display: 'inline-block', flexShrink: 0,
  }),
  termBody: {
    background: '#0f172a', padding: '14px 18px 18px',
    fontFamily: FONT.mono, fontSize: 12, lineHeight: 1.7,
  },

  section: { padding: '72px 0' },
  sectionInner: { maxWidth: 1080, margin: '0 auto', padding: '0 24px' },

  envGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
    marginTop: 0,
  },
  envCard: {
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: R.xl, padding: '18px',
    boxShadow: SHADOW.sm,
    transition: 'box-shadow 0.15s',
  },
  envIcon: {
    width: 38, height: 38, borderRadius: R.md,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, flexShrink: 0,
  },

  featGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16, marginTop: 0,
  },
  featCard: {
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: R.xl, padding: '20px',
    boxShadow: SHADOW.sm,
  },
  featIcon: { fontSize: 24, marginBottom: 10 },

  stepCard: {
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: R.xl, padding: '20px 24px',
    boxShadow: SHADOW.sm,
  },
  stepNum: {
    width: 32, height: 32, borderRadius: '50%',
    background: C.primary, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 14, marginBottom: 12,
  },

  footer: {
    background: C.bgSurface, borderTop: `1px solid ${C.border}`,
    padding: '20px 0',
  },
  footerInner: {
    maxWidth: 1080, margin: '0 auto', padding: '0 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, flexWrap: 'wrap',
  },
}
