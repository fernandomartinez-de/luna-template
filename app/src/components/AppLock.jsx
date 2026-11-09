import React, { useState, useEffect } from 'react'
import CodeSlots from './CodeSlots/CodeSlots.jsx'
import { checkPin } from '../utils/pin.js'
import { OWNER_NAME } from '../config.js'

const STORAGE_KEY = 'luna:unlocked'

/**
 * Full-screen PIN gate shown before the rest of Luna renders.
 * Uses sessionStorage — cleared when the tab/PWA fully closes, so a
 * fresh app open always asks for the PIN.
 */
export default function AppLock({ children }) {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch (e) {
      return false
    }
  })
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (unlocked) {
      try { sessionStorage.setItem(STORAGE_KEY, '1') } catch (e) {}
    }
  }, [unlocked])

  const handleComplete = async (code) => {
    let ok = false
    try { ok = await checkPin(code) } catch (e) { ok = false }
    if (ok) {
      setStatus('success')
      setTimeout(() => setUnlocked(true), 260)
    } else {
      setStatus('danger')
      setTimeout(() => {
        setValue('')
        setStatus('idle')
      }, 700)
    }
  }

  if (unlocked) return children

  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 5 ? 'Still up' :
    hour < 12 ? 'Good morning' :
    hour < 18 ? 'Good afternoon' :
    hour < 22 ? 'Good evening' :
    'Good night'

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'radial-gradient(ellipse at center, #0a1428 0%, #050509 70%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(var(--sa-top) + 24px) calc(var(--sa-right) + 24px) calc(var(--sa-bottom) + 24px) calc(var(--sa-left) + 24px)',
      zIndex: 9999,
      gap: '32px'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(148, 163, 184, 0.7)',
          marginBottom: '8px'
        }}>Luna</div>
        <div style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#f1f5f9',
          marginBottom: '6px'
        }}>{greeting}{OWNER_NAME ? `, ${OWNER_NAME}` : ''}</div>
        <div style={{
          fontSize: '13px',
          color: 'rgba(148, 163, 184, 0.75)'
        }}>Enter code to continue</div>
      </div>

      <CodeSlots
        length={4}
        value={value}
        onChange={setValue}
        onComplete={handleComplete}
        status={status}
        autoFocus={true}
        slotSize={52}
        gap={12}
        radius={12}
        accentColor="#38d8fb"
        slotColor="rgba(255,255,255,0.06)"
        digitColor="#f1f5f9"
        inkColor="#f1f5f9"
        dangerColor="#ef4444"
        ariaLabel="App unlock code"
      />

      {status === 'danger' && (
        <div style={{
          fontSize: '13px',
          color: '#ef4444',
          fontWeight: 500
        }}>Wrong code</div>
      )}
    </div>
  )
}
