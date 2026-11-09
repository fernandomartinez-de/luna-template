import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

// Open alerts written by finances/scripts/finance_alerts.py after each sync.
const SEVERITY = {
  high: { color: '#f87171', label: 'Important' },
  medium: { color: '#fbbf24', label: 'Check' },
  low: { color: '#94a3b8', label: 'FYI' }
}
const SEV_ORDER = { high: 0, medium: 1, low: 2 }
const COLLAPSED = 4

function shortDate(d) {
  if (!d) return ''
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

export default function AlertsCard({ card, label }) {
  const [alerts, setAlerts] = useState(null) // null = loading or unavailable
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.from('finance_alerts')
      .select('id, alert_type, severity, title, detail, merchant, amount, txn_date')
      .eq('status', 'open')
      .order('txn_date', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return
        // Table not created yet: show nothing rather than an error.
        if (error) { setAlerts(undefined); return }
        setAlerts([...(data || [])].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]))
      })
    return () => { cancelled = true }
  }, [])

  async function dismiss(a, mute) {
    setBusy(a.id)
    setErr(null)
    const { error } = await supabase.rpc('dismiss_finance_alert', { p_id: a.id, p_mute: mute })
    setBusy(null)
    if (error) { setErr(error.message); return }
    setAlerts((prev) => prev.filter((x) => x.id !== a.id && !(mute && x.alert_type === a.alert_type && x.merchant === a.merchant)))
  }

  if (alerts === null || alerts === undefined) return null

  const shown = expanded ? alerts : alerts.slice(0, COLLAPSED)
  const highCount = alerts.filter((a) => a.severity === 'high').length

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: alerts.length ? '10px' : 0 }}>
        <p style={{ ...label, margin: 0, flex: 1 }}>Alerts</p>
        {alerts.length > 0 ? (
          <span style={{ fontSize: '11px', fontWeight: 700, color: highCount ? '#f87171' : '#fbbf24' }}>
            {alerts.length} open{highCount ? ` · ${highCount} important` : ''}
          </span>
        ) : (
          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>All clear</span>
        )}
      </div>

      {err && <p style={{ fontSize: '12px', color: '#f87171', margin: '0 0 8px 0' }}>Couldn't update: {err}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {shown.map((a) => {
          const sev = SEVERITY[a.severity] || SEVERITY.medium
          // Never offer muting for important alerts like interest or late fees.
          const canMute = a.merchant && a.severity !== 'high' && (a.alert_type === 'duplicate' || a.alert_type === 'fee' || a.alert_type.startsWith('subscription'))
          return (
            <div key={a.id} style={{ borderLeft: `3px solid ${sev.color}`, background: 'var(--surface-base)', borderRadius: '8px', padding: '10px 12px', opacity: busy === a.id ? 0.5 : 1 }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--tx-primary)' }}>{a.title}</span>
                <span style={{ fontSize: '11px', color: 'var(--tx-muted)', whiteSpace: 'nowrap' }}>{shortDate(a.txn_date)}</span>
              </div>
              {a.detail && <p style={{ fontSize: '12px', color: 'var(--tx-secondary)', margin: '4px 0 8px 0', lineHeight: 1.4 }}>{a.detail}</p>}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: sev.color, flex: 1 }}>{sev.label}</span>
                {canMute && (
                  <button type="button" disabled={busy === a.id} onClick={() => dismiss(a, true)}
                    title="Dismiss and stop alerting about this"
                    style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                    Don't alert again
                  </button>
                )}
                <button type="button" disabled={busy === a.id} onClick={() => dismiss(a, false)}
                  style={{ border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--tx-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '4px 10px', borderRadius: '999px' }}>
                  Looks fine
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {alerts.length > COLLAPSED && (
        <button type="button" onClick={() => setExpanded((v) => !v)}
          style={{ marginTop: '10px', border: 'none', background: 'transparent', color: 'var(--brand-500)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          {expanded ? 'Show fewer' : `Show all ${alerts.length}`}
        </button>
      )}
    </div>
  )
}
