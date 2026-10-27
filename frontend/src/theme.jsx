import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export const C = {
  primary:       'var(--ink)',
  primaryHover:  'var(--primary-hover)',
  primaryLight:  'var(--chip)',
  primaryBorder: 'var(--border-s)',
  primaryText:   'var(--ink)',

  green:         'var(--green)',
  greenLight:    'var(--green-light)',
  greenBorder:   'var(--green-border)',
  greenText:     'var(--green)',

  amber:         'var(--amber)',
  amberLight:    'var(--amber-light)',
  amberBorder:   'var(--amber-border)',
  amberText:     'var(--amber)',

  red:           'var(--red)',
  redLight:      'var(--red-light)',
  redBorder:     'var(--red-border)',
  redText:       'var(--red)',

  purple:        'var(--purple)',
  purpleLight:   'var(--purple-light)',

  ink:           'var(--ink)',
  body:          'var(--body)',
  muted:         'var(--muted)',
  faint:         'var(--faint)',

  border:        'var(--border)',
  borderStrong:  'var(--border-s)',
  divider:       'var(--divider)',

  bg:            'var(--bg)',
  bgSurface:     'var(--bg-surface)',
  bgSubtle:      'var(--bg-subtle)',
  bgGlass:       'var(--glass)',

  hover:         'var(--hover)',
  chip:          'var(--chip)',
  input:         'var(--input)',
  modal:         'var(--modal)',
  overlay:       'var(--overlay)',
  nav:           'var(--nav)',
  inverse:       'var(--inverse)',

  termBg:        'var(--term-bg)',
  termText:      'var(--term-text)',
  termGreen:     'var(--term-green)',
  termBlue:      'var(--term-blue)',
  termYellow:    'var(--term-yellow)',
  termGray:      'var(--term-gray)',
}

export const R = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  xxl:  24,
  pill: 9999,
}

export const SHADOW = {
  sm:    'var(--shadow-sm)',
  md:    'var(--shadow-md)',
  lg:    'var(--shadow-lg)',
  xl:    'var(--shadow-xl)',
  modal: 'var(--shadow-modal)',
}

export const STATUS_META = {
  PENDING:      { label: 'Pending',      dot: C.faint,   bg: C.chip,          text: C.muted  },
  PROVISIONING: { label: 'Starting',     dot: C.amber,   bg: C.amberLight,    text: C.amber  },
  RUNNING:      { label: 'Running',      dot: C.green,   bg: C.greenLight,    text: C.green  },
  STOPPED:      { label: 'Stopped',      dot: C.faint,   bg: C.chip,          text: C.muted  },
  FAILED:       { label: 'Failed',       dot: C.red,     bg: C.redLight,      text: C.red    },
  DELETING:     { label: 'Deleting',     dot: C.purple,  bg: C.purpleLight,   text: C.purple },
  DELETED:      { label: 'Deleted',      dot: C.faint,   bg: C.chip,          text: C.muted  },
  NOT_DEPLOYED: { label: 'Not deployed', dot: C.faint,   bg: C.chip,          text: C.muted  },
  BUILDING:     { label: 'Building',     dot: C.amber,   bg: C.amberLight,    text: C.amber  },
  BUILD_FAILED: { label: 'Build failed', dot: C.red,     bg: C.redLight,      text: C.red    },
  DEPLOYING:    { label: 'Deploying',    dot: C.ink,     bg: C.chip,          text: C.body   },
  DEGRADED:     { label: 'Degraded',     dot: C.amber,   bg: C.amberLight,    text: C.amber  },
}

export const TEMPLATE_ACCENT = {
  ubuntu:    { color: '#d97706', bg: 'rgba(217,119,6,0.10)',   border: 'rgba(217,119,6,0.22)'  },
  python:    { color: '#2563eb', bg: 'rgba(37,99,235,0.10)',   border: 'rgba(37,99,235,0.22)'  },
  nodejs:    { color: '#059669', bg: 'rgba(5,150,105,0.10)',   border: 'rgba(5,150,105,0.22)'  },
  java:      { color: '#dc2626', bg: 'rgba(220,38,38,0.10)',   border: 'rgba(220,38,38,0.22)'  },
  react:     { color: '#0891b2', bg: 'rgba(8,145,178,0.10)',   border: 'rgba(8,145,178,0.22)'  },
  fullstack: { color: '#7c3aed', bg: 'rgba(124,58,237,0.10)',  border: 'rgba(124,58,237,0.22)' },
}

export const FONT = {
  sans:    "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif:   "'Fraunces', 'Times New Roman', serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
}

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof document === 'undefined') return 'dark'
    return document.documentElement.getAttribute('data-theme') || 'dark'
  })

  const apply = useCallback((next) => {
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('devbox-theme', next) } catch (_) {}
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', next === 'light' ? '#f3efe6' : '#080806')
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    apply(theme === 'dark' ? 'light' : 'dark')
  }, [theme, apply])

  const value = useMemo(() => ({ theme, toggleTheme, setTheme: apply }), [theme, toggleTheme, apply])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
