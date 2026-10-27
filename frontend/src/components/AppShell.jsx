import { Link, useLocation } from 'react-router-dom'
import { C, R, SHADOW } from '../theme'

const NAV_LINKS = [
  { to: '/workspaces', label: 'Workspaces' },
]

export function AppShell({ children }) {
  const location = useLocation()

  return (
    <div style={{ minHeight: '100vh', background: C.bgSurface }}>
      <nav style={S.nav}>
        <div style={S.navInner}>
          <Link to="/" style={S.brand}>
            <span style={S.brandMark}>⬡</span>
            <span style={S.brandName}>DevBox</span>
          </Link>
          <div style={S.navLinks}>
            {NAV_LINKS.map(link => {
              const active = location.pathname.startsWith(link.to)
              return (
                <Link key={link.to} to={link.to} style={{
                  ...S.navLink,
                  color: active ? C.primary : C.body,
                  fontWeight: active ? 600 : 400,
                }}>
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
      <main style={S.main}>{children}</main>
    </div>
  )
}

const S = {
  nav: {
    position: 'sticky', top: 0, zIndex: 40,
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(8px)',
    borderBottom: `1px solid ${C.border}`,
    boxShadow: SHADOW.sm,
  },
  navInner: {
    maxWidth: 1100, margin: '0 auto', padding: '0 20px',
    height: 52, display: 'flex', alignItems: 'center', gap: 20,
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 7,
    textDecoration: 'none', marginRight: 8,
  },
  brandMark: { fontSize: 18, color: C.primary, lineHeight: 1 },
  brandName: { fontWeight: 800, fontSize: 15, color: C.ink, letterSpacing: '-0.01em' },
  navLinks: { display: 'flex', alignItems: 'center', gap: 4 },
  navLink: {
    padding: '5px 10px', borderRadius: R.md,
    fontSize: 13, textDecoration: 'none', color: C.body,
    transition: 'background 0.12s',
  },
  main: { minHeight: 'calc(100vh - 52px)' },
}
