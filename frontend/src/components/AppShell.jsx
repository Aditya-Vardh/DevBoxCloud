import { Link, useLocation } from 'react-router-dom'
import { C, R, FONT } from '../theme'
import { BrandMark } from './BrandMark'
import { ThemeToggle } from './ThemeToggle'

export function AppShell({ children }) {
  const { pathname } = useLocation()
  const inWorkspaces = pathname.startsWith('/workspaces') || pathname.startsWith('/environments') || pathname.startsWith('/applications')

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT.sans, color: C.body }}>
      <nav className="lp-nav" role="navigation" aria-label="Main navigation" style={{ height: 60 }}>
        <div style={S.navInner}>
          <Link to="/" style={S.brand} aria-label="DevBox Cloud home">
            <BrandMark size={18} />
            <span style={S.brandName}>DevBox</span>
          </Link>

          <div style={S.navCenter}>
            <NavLink to="/workspaces" active={inWorkspaces}>Workspaces</NavLink>
          </div>

          <div style={S.navRight}>
            <ThemeToggle />
            <Link to="/workspaces" className="cta-ink" style={S.navCta}>Open app</Link>
          </div>
        </div>
      </nav>

      <main style={{ minHeight: 'calc(100vh - 60px)' }}>
        {children}
      </main>
    </div>
  )
}

function NavLink({ to, active, children }) {
  return (
    <Link to={to} style={{ ...S.navLink, color: active ? C.ink : C.muted }}>
      {children}
      {active && <span style={S.activeBar} />}
    </Link>
  )
}

const S = {
  navInner: {
    maxWidth: 1180, margin: '0 auto', padding: '0 28px',
    height: '100%', display: 'flex', alignItems: 'center',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 9,
    textDecoration: 'none', flexShrink: 0, marginRight: 32,
  },
  brandName: {
    fontSize: 13, fontWeight: 700, color: C.ink,
    letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: FONT.sans,
  },
  navCenter: { display: 'flex', alignItems: 'center', gap: 2, flex: 1 },
  navLink: {
    position: 'relative',
    padding: '6px 10px', borderRadius: R.md,
    fontSize: 13, fontWeight: 500, textDecoration: 'none',
    fontFamily: FONT.sans,
  },
  activeBar: {
    position: 'absolute', bottom: -16, left: '50%',
    transform: 'translateX(-50%)',
    width: 16, height: 1,
    background: C.ink, display: 'block',
  },
  navRight: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 },
  navCta: {
    padding: '7px 14px', borderRadius: R.pill,
    background: C.ink, color: C.inverse,
    fontSize: 12, fontWeight: 700,
    textDecoration: 'none', letterSpacing: '0.01em',
    fontFamily: FONT.sans, lineHeight: 1,
    border: 'none', cursor: 'pointer',
  },
}
