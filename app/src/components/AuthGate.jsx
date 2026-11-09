import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'

// Sign ups are turned off in Supabase and every table only answers the owner's
// account, so the app does not need (or ship) the owner's email address.

const shell = {
  position: 'fixed',
  inset: 0,
  background: 'radial-gradient(ellipse at center, #0a1428 0%, #050509 70%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'calc(var(--sa-top) + 24px) calc(var(--sa-right) + 24px) calc(var(--sa-bottom) + 24px) calc(var(--sa-left) + 24px)',
  zIndex: 9998,
  gap: '24px',
  color: '#f1f5f9',
  textAlign: 'center',
}
const label = { fontSize: '13px', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(148, 163, 184, 0.7)' }
const sub = { fontSize: '13px', color: 'rgba(148, 163, 184, 0.75)', maxWidth: 300, lineHeight: 1.5 }
const input = {
  width: 280, maxWidth: '80vw', padding: '12px 14px', borderRadius: 12, fontSize: 16,
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#f1f5f9', outline: 'none',
}
const button = {
  padding: '11px 22px', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 600,
  background: '#38d8fb', color: '#050509', cursor: 'pointer',
}
const link = { background: 'none', border: 'none', color: '#38d8fb', fontSize: 13, cursor: 'pointer' }

/**
 * Real sign in for Luna (Supabase Auth, email one time code or magic link).
 * The session is remembered on the device, so this only appears on a new
 * device or after signing out; the quick unlock code still shows on each open.
 */
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [step, setStep] = useState('email') // email | code
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  async function sendCode(e) {
    e?.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!addr) return
    setStatus('busy'); setMessage('')
    const redirect = window.location.origin + (import.meta.env.BASE_URL || '/')
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirect } })
    setStatus('idle')
    if (error) { setMessage(error.message); return }
    setStep('code')
  }

  async function verify(token) {
    setStatus('busy')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' })
    if (error) {
      setStatus('danger'); setMessage('That code did not work. Try again or use the link in the email.')
      setTimeout(() => { setCode(''); setStatus('idle') }, 700)
    }
  }

  if (session === undefined) return null
  if (session) return children

  return (
    <div style={shell}>
      <div>
        <div style={{ ...label, marginBottom: 8 }}>Luna</div>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Sign in</div>
        <div style={sub}>
          {step === 'email'
            ? 'We will email you a sign in link and code. You only need to do this once per device.'
            : 'Check your email and paste or type the code here.'}
        </div>
      </div>

      {step === 'email' ? (
        <form onSubmit={sendCode} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <input style={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button style={button} type="submit" disabled={status === 'busy'}>
            {status === 'busy' ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); const t = code.replace(/\D/g, ''); if (t.length >= 6) verify(t) }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}
          >
            <input
              style={{ ...input, textAlign: 'center', letterSpacing: '0.2em', fontSize: 20,
                       borderColor: status === 'danger' ? '#ef4444' : 'rgba(255,255,255,0.12)' }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="Code from email"
              aria-label="Email sign in code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 14))}
            />
            <button style={button} type="submit" disabled={status === 'busy' || code.replace(/\D/g, '').length < 6}>
              {status === 'busy' ? 'Checking…' : 'Sign in'}
            </button>
          </form>
          <button style={link} type="button" onClick={() => { setStep('email'); setCode(''); setMessage('') }}>
            Send a new code
          </button>
        </>
      )}

      {message && <div style={{ fontSize: 13, color: '#ef4444', maxWidth: 300 }}>{message}</div>}
    </div>
  )
}
