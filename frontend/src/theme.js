/**
 * DevBox design tokens — single source of truth for colors, spacing, radii.
 * All inline-style objects should reference these constants rather than raw hex.
 */

export const C = {
  // Brand
  primary:       '#2563eb',
  primaryHover:  '#1d4ed8',
  primaryLight:  '#eff6ff',
  primaryBorder: '#bfdbfe',
  primaryText:   '#1d4ed8',

  // Status
  green:         '#16a34a',
  greenLight:    '#f0fdf4',
  greenBorder:   '#86efac',
  greenText:     '#166534',

  amber:         '#d97706',
  amberLight:    '#fffbeb',
  amberBorder:   '#fde68a',
  amberText:     '#92400e',

  red:           '#dc2626',
  redLight:      '#fee2e2',
  redBorder:     '#fca5a5',
  redText:       '#b91c1c',

  purple:        '#7c3aed',
  purpleLight:   '#f5f3ff',

  // Neutrals
  ink:           '#111827',
  body:          '#374151',
  muted:         '#6b7280',
  faint:         '#9ca3af',

  border:        '#e5e7eb',
  borderStrong:  '#d1d5db',
  divider:       '#f3f4f6',

  bg:            '#ffffff',
  bgSurface:     '#f9fafb',
  bgSubtle:      '#f3f4f6',

  // Terminal / logs
  termBg:        '#0f172a',
  termText:      '#e2e8f0',
  termGreen:     '#4ade80',
  termBlue:      '#60a5fa',
  termYellow:    '#fbbf24',
  termGray:      '#64748b',
}

export const R = {
  sm:   4,
  md:   6,
  lg:   8,
  xl:   10,
  xxl:  12,
  full: 9999,
}

export const SHADOW = {
  sm:   '0 1px 2px rgba(0,0,0,0.06)',
  md:   '0 2px 8px rgba(0,0,0,0.08)',
  lg:   '0 4px 16px rgba(0,0,0,0.10)',
  xl:   '0 8px 32px rgba(0,0,0,0.14)',
  modal:'0 20px 60px rgba(0,0,0,0.20)',
}

// Status metadata — single source for colors, labels, dot colors
export const STATUS_META = {
  PENDING:      { label: 'Pending',    dot: C.faint,    bg: C.bgSubtle,  text: C.muted   },
  PROVISIONING: { label: 'Starting',   dot: C.amber,    bg: C.amberLight,text: C.amberText },
  RUNNING:      { label: 'Running',    dot: C.green,    bg: C.greenLight, text: C.greenText },
  STOPPED:      { label: 'Stopped',    dot: C.faint,    bg: C.bgSubtle,  text: C.muted   },
  FAILED:       { label: 'Failed',     dot: C.red,      bg: C.redLight,  text: C.redText },
  DELETING:     { label: 'Deleting',   dot: C.purple,   bg: C.purpleLight,text: C.purple },
  DELETED:      { label: 'Deleted',    dot: C.faint,    bg: C.bgSubtle,  text: C.muted   },
  // Application statuses
  NOT_DEPLOYED: { label: 'Not deployed', dot: C.faint,  bg: C.bgSubtle,  text: C.muted   },
  BUILDING:     { label: 'Building',   dot: C.amber,    bg: C.amberLight,text: C.amberText },
  BUILD_FAILED: { label: 'Build failed',dot: C.red,     bg: C.redLight,  text: C.redText },
  DEPLOYING:    { label: 'Deploying',  dot: C.primary,  bg: C.primaryLight,text:C.primaryText },
  DEGRADED:     { label: 'Degraded',   dot: C.amber,    bg: C.amberLight,text: C.amberText },
}

// Template accent colors (used for identity theming)
export const TEMPLATE_ACCENT = {
  ubuntu:    { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' }, // orange
  python:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' }, // blue
  nodejs:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' }, // green
  java:      { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }, // red
  react:     { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' }, // cyan
  fullstack: { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' }, // purple
}

export const FONT = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
}
