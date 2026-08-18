/**
 * Thin fetch wrapper.
 * - Throws an Error with the server's message if response is not ok.
 * - All methods return parsed JSON (or plain text for logs).
 */

const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, opts)

  if (res.status === 204) return null

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.text()

  if (!res.ok) {
    const msg =
      (data && data.message) ||
      (typeof data === 'string' ? data : `HTTP ${res.status}`)
    const err = new Error(msg)
    err.status = res.status
    err.fieldErrors = data && data.fieldErrors
    throw err
  }

  return data
}

const get  = (path)         => request('GET',    path)
const post = (path, body)   => request('POST',   path, body)
const put  = (path, body)   => request('PUT',    path, body)
const del  = (path)         => request('DELETE', path)

// ── Workspaces ───────────────────────────────────────────────────────────────
export const workspaceApi = {
  list:   ()         => get('/workspaces'),
  get:    (id)       => get(`/workspaces/${id}`),
  create: (data)     => post('/workspaces', data),
  update: (id, data) => put(`/workspaces/${id}`, data),
  delete: (id)       => del(`/workspaces/${id}`),
}

// ── Applications ─────────────────────────────────────────────────────────────
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

  status:  (id)           => get(`/applications/${id}/status`),
  pods:    (id)           => get(`/applications/${id}/pods`),
  logs:    (id, lines)    => get(`/applications/${id}/logs?lines=${lines ?? 200}`),
  service: (id)           => get(`/applications/${id}/service`),
}

// ── Health ───────────────────────────────────────────────────────────────────
export const healthApi = {
  basic:        () => get('/health'),
  dependencies: () => get('/health/dependencies'),
}
