import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invitationApi } from '../api/client'
import { Button } from '../components/Button'
import { ErrorMessage } from '../components/ErrorMessage'
import { Spinner } from '../components/Spinner'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { C, R, FONT } from '../theme'

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
    setRedeem(true); setRedeemErr(null)
    try {
      const env = await invitationApi.redeem(code)
      setRedeemed(env)
      setTimeout(() => navigate(`/environments/${env.id}`), 2000)
    } catch (e) { setRedeemErr(e.message) }
    finally { setRedeem(false) }
  }

  return (
    <div style={S.page}>
      <div style={S.card} className="page-enter">

        <div style={S.brandRow}>
          <BrandMark size={20} />
          <span style={S.brandName}>DevBox Cloud</span>
          <div style={{ marginLeft: 'auto' }}><ThemeToggle /></div>
        </div>

        <h1 style={S.title}>Workspace invitation</h1>

        {loading && (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <Spinner size={22} />
            <p style={{ margin: '14px 0 0', color: C.muted, fontSize: 13 }}>Checking invitation…</p>
          </div>
        )}

        {!loading && error && (
          <>
            <ErrorMessage error={error} />
            <Button variant="secondary" style={{ width: '100%', marginTop: 16 }} onClick={() => navigate('/')}>
              Go to home
            </Button>
          </>
        )}

        {!loading && !error && info && !redeemed && (
          <>
            <div style={S.infoTable}>
              {[
                ['Environment', info.environmentName],
                ['Template',   info.templateName],
                ['Status',     info.valid ? 'Valid' : 'Expired or revoked'],
                ...(info.expiresAt ? [['Expires', new Date(info.expiresAt).toLocaleString()]] : []),
              ].map(([k, v], i, arr) => (
                <div key={k} style={{ ...S.infoRow, borderBottom: i < arr.length - 1 ? `1px solid ${C.divider}` : 'none' }}>
                  <span style={S.infoKey}>{k}</span>
                  <span style={{ fontSize: 13, color: info.valid || k !== 'Status' ? C.body : C.red, fontWeight: k === 'Status' ? 600 : 400 }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {!info.valid && (
              <div style={{ background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: R.lg, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 }}>
                This invitation is no longer valid.
              </div>
            )}

            <ErrorMessage error={redeemErr} />

            {info.valid
              ? <Button variant="primary" loading={redeeming} loadingLabel="Accepting…"
                  style={{ width: '100%', padding: '12px' }} onClick={handleRedeem}>
                  Accept invitation
                </Button>
              : <Button variant="secondary" style={{ width: '100%' }} onClick={() => navigate('/')}>
                  Back to home
                </Button>
            }
          </>
        )}

        {redeemed && (
          <>
            <div style={{ background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: R.xl, padding: '14px 16px', color: C.green, fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 20 }}>
              Access granted — redirecting to <strong>{redeemed.name}</strong>…
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Spinner size={20} color={C.green} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', background: C.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, fontFamily: FONT.sans,
  },
  card: {
    background: C.modal, border: `1px solid ${C.borderStrong}`,
    borderRadius: R.xxl, width: '100%', maxWidth: 420,
    padding: '32px 28px',
    boxShadow: 'var(--shadow-modal)',
  },
  brandRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28,
  },
  brandName: {
    fontSize: 13, fontWeight: 700, color: C.body, letterSpacing: '-0.01em',
  },
  title: {
    margin: '0 0 20px',
    fontSize: 28, fontWeight: 400, color: C.ink, letterSpacing: '-0.03em', fontFamily: FONT.serif,
  },
  infoTable: {
    border: `1px solid ${C.border}`, borderRadius: R.xl,
    overflow: 'hidden', marginBottom: 20,
  },
  infoRow: {
    display: 'flex', gap: 16, padding: '10px 14px', alignItems: 'center',
  },
  infoKey: {
    width: 100, flexShrink: 0, fontSize: 12, color: C.muted, fontWeight: 500,
  },
}
