import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invitationApi } from '../api/client'
import { Button } from '../components/Button'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { C, R, SHADOW } from '../theme'

export function InvitePage() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [info, setInfo]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [redeeming, setRedeem]  = useState(false)
  const [redeemErr, setRedeemErr] = useState(null)
  const [redeemed, setRedeemed] = useState(null)

  useEffect(() => {
    if (!code) { setError('No invitation code in URL.'); setLoading(false); return }
    invitationApi.info(code)
      .then(setInfo)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [code])

  async function handleRedeem() {
    setRedeem(true)
    setRedeemErr(null)
    try {
      const env = await invitationApi.redeem(code)
      setRedeemed(env)
      setTimeout(() => navigate(`/environments/${env.id}`), 2000)
    } catch (e) {
      setRedeemErr(e.message)
    } finally {
      setRedeem(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bgSurface,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: C.bg, borderRadius: R.xl,
        border: `1px solid ${C.border}`,
        boxShadow: SHADOW.lg,
        width: '100%', maxWidth: 460,
        padding: '32px 28px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
        <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>
          Workspace Invitation
        </h1>

        {loading && (
          <div style={{ padding: '24px 0' }}>
            <Spinner size={24} />
            <p style={{ margin: '12px 0 0', color: C.muted, fontSize: 13 }}>Checking invitation…</p>
          </div>
        )}

        {error && (
          <>
            <ErrorMessage error={error} />
            <Button variant="secondary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
              Go to home
            </Button>
          </>
        )}

        {!loading && !error && info && !redeemed && (
          <>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: C.muted, lineHeight: 1.55 }}>
              You've been invited to access a development workspace.
            </p>

            <div style={{
              border: `1px solid ${C.border}`, borderRadius: R.lg,
              overflow: 'hidden', marginBottom: 20, textAlign: 'left',
            }}>
              {[
                ['Environment', info.environmentName],
                ['Template',   info.templateName],
                ['Status',     info.valid ? 'Valid' : 'Expired or revoked'],
                ...(info.expiresAt ? [['Expires', new Date(info.expiresAt).toLocaleString()]] : []),
              ].map(([label, val]) => (
                <div key={label} style={{
                  display: 'flex', padding: '9px 14px',
                  borderBottom: `1px solid ${C.divider}`, fontSize: 13,
                }}>
                  <span style={{ width: 110, flexShrink: 0, color: C.muted, fontWeight: 500 }}>{label}</span>
                  <span style={{ color: C.ink, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>

            {!info.valid && (
              <div style={{
                padding: '10px 14px', borderRadius: R.md, marginBottom: 16,
                background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13,
              }}>
                This invitation is no longer valid.
              </div>
            )}

            <ErrorMessage error={redeemErr} />

            {info.valid && (
              <Button variant="primary" loading={redeeming} loadingLabel="Accepting…"
                style={{ width: '100%' }} onClick={handleRedeem}>
                Accept invitation
              </Button>
            )}
            {!info.valid && (
              <Button variant="secondary" style={{ width: '100%' }} onClick={() => navigate('/')}>
                Back to home
              </Button>
            )}
          </>
        )}

        {redeemed && (
          <>
            <div style={{
              padding: '14px', borderRadius: R.lg, marginBottom: 16,
              background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontSize: 13,
              fontWeight: 600,
            }}>
              ✓ Access granted! Redirecting to <strong>{redeemed.name}</strong>…
            </div>
            <Spinner size={18} />
          </>
        )}
      </div>
    </div>
  )
}
