const BASE = '/api'

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 204) return null
  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : await res.text()
  if (!res.ok) {
    const msg = (data && data.message) || (typeof data === 'string' ? data : `HTTP ${res.status}`)
    const err = new Error(msg)
    err.status = res.status
    err.fieldErrors = data && data.fieldErrors
    throw err
  }
  return data
}

const get  = (path)       => request('GET',    path)
const post = (path, body) => request('POST',   path, body)
const put  = (path, body) => request('PUT',    path, body)
const del  = (path)       => request('DELETE', path)

export const workspaceApi = {
  list:   ()         => get('/workspaces'),
  get:    (id)       => get(`/workspaces/${id}`),
  create: (data)     => post('/workspaces', data),
  update: (id, data) => put(`/workspaces/${id}`, data),
  delete: (id)       => del(`/workspaces/${id}`),
}

export const appApi = {
  listByWorkspace: (wsId)         => get(`/workspaces/${wsId}/applications`),
  get:             (id)           => get(`/applications/${id}`),
  create:          (wsId, data)   => post(`/workspaces/${wsId}/applications`, data),
  update:          (id, data)     => put(`/applications/${id}`, data),
  delete:          (id)           => del(`/applications/${id}`),
  build:    (id)           => post(`/applications/${id}/build`),
  deploy:   (id)           => post(`/applications/${id}/deploy`),
  redeploy: (id)           => post(`/applications/${id}/redeploy`),
  stop:     (id)           => post(`/applications/${id}/stop`),
  scale:    (id, replicas) => post(`/applications/${id}/scale`, { replicas }),
  status:  (id)            => get(`/applications/${id}/status`),
  pods:    (id)            => get(`/applications/${id}/pods`),
  logs:    (id, lines)     => get(`/applications/${id}/logs?lines=${lines ?? 200}`),
  service: (id)            => get(`/applications/${id}/service`),
}

export const healthApi = {
  basic:        () => get('/health'),
  dependencies: () => get('/health/dependencies'),
}

export const templateApi = {
  list: ()   => get('/templates'),
  get:  (id) => get(`/templates/${id}`),
}

export const environmentApi = {
  listByWorkspace: (wsId)       => get(`/workspaces/${wsId}/environments`),
  get:             (id)         => get(`/environments/${id}`),
  create:          (wsId, data) => post(`/workspaces/${wsId}/environments`, data),
  delete:          (id)         => del(`/environments/${id}`),
  start:   (id)        => post(`/environments/${id}/start`),
  stop:    (id)        => post(`/environments/${id}/stop`),
  restart: (id)        => post(`/environments/${id}/restart`),
  status:  (id)        => get(`/environments/${id}/status`),
  pods:    (id)        => get(`/environments/${id}/pods`),
  logs:    (id, lines) => get(`/environments/${id}/logs?lines=${lines ?? 200}`),
}

export const invitationApi = {
  create: (envId, data) => post(`/environments/${envId}/invitations`, data || {}),
  list:   (envId)       => get(`/environments/${envId}/invitations`),
  revoke: (invId)       => del(`/invitations/${invId}`),
  info:   (code)        => get(`/invitations/info/${code}`),
  redeem: (code)        => post(`/invitations/redeem/${code}`),
}

export const configApi = {
  get: () => get('/config'),
}

// Cached once — used to build correct LAN-accessible invite URLs
let _cfgPromise = null
export function getServerConfig() {
  if (!_cfgPromise) _cfgPromise = configApi.get().catch(() => ({ workspaceHost: '127.0.0.1' }))
  return _cfgPromise
}

// Build an invite URL that works from any device on the same network.
// Uses window.location.host (the address the user loaded the frontend from)
// so the link works whether accessed from localhost or a LAN IP.
export function buildInviteUrl(code) {
  const origin = `${window.location.protocol}//${window.location.host}`
  return `${origin}/invite/${code}`
}
