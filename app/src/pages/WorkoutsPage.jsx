import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LOAD_FACTOR = { high: 0.4, moderate: 0.8, low: 1.0, rest: 1.2 }
const LIFT_CATS = ['Chest & Triceps', 'Back & Biceps', 'Legs', 'Shoulders & Arms']
const SHORT = {
  'Chest & Triceps': 'Chest+Tri', 'Back & Biceps': 'Back+Bi', 'Legs': 'Legs',
  'Shoulders & Arms': 'Shldr+Arm', 'Full body': 'Full body', 'Soccer': 'Soccer'
}

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function weekDatesMon() {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const off = now.getDay() === 0 ? 6 : now.getDay() - 1
  const mon = new Date(now); mon.setDate(now.getDate() - off)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
}
function isoWeekLabel(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const wk = Math.ceil((((d - yStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`
}
function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function strainColor(s) {
  const v = Number(s) || 0
  if (v >= 18) return '#ef4444'
  if (v >= 14) return '#f59e0b'
  if (v >= 10) return '#00b8d9'
  return '#3b82f6'
}

export default function WorkoutsPage() {
  const [view, setView] = useState('log')
  const [saved, setSaved] = useState([])
  const [completed, setCompleted] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [sug, setSug] = useState(null)
  const [sugLoading, setSugLoading] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [savedRes, completedRes, whoopRes] = await Promise.all([
        supabase.from('workouts').select('id, name').order('created_at', { ascending: false }),
        supabase
          .from('completed_workouts')
          .select('*, workouts(name, workout_exercises(sets, reps, order_index, exercises(name, muscle_group)))')
          .order('performed_at', { ascending: false }),
        supabase
          .from('whoop_workouts')
          .select('workout_id, start_time, sport_name, strain, calories_kcal')
          .not('sport_name', 'in', '("Walking","Activity")')
          .order('start_time', { ascending: false })
          .limit(15)
      ])
      if (savedRes.error) throw savedRes.error
      if (completedRes.error) throw completedRes.error
      if (whoopRes.error) throw whoopRes.error
      setSaved(savedRes.data || [])
      setCompleted(completedRes.data || [])
      // Keep every WHOOP session; the row decides how to render based on
      // whether a completed_workouts row is attached and what sport it was.
      setSessions(whoopRes.data || [])
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function assign(session, workoutId) {
    if (!workoutId) return
    setBusy(session.workout_id)
    const chosen = saved.find((w) => String(w.id) === String(workoutId))
    const { error: err } = await supabase.from('completed_workouts').insert({
      workout_id: chosen ? chosen.id : null,
      workout_name: chosen ? chosen.name : null,
      whoop_workout_id: session.workout_id,
      sport_name: session.sport_name,
      performed_at: session.start_time,
      strain: session.strain,
      calories_kcal: session.calories_kcal
    })
    setBusy(null)
    if (err) setError(err.message)
    else loadAll()
  }

  async function removeCompleted(id) {
    await supabase.from('completed_workouts').delete().eq('id', id)
    loadAll()
  }

  async function loadSuggest() {
    setSugLoading(true)
    try {
      const dates = weekDatesMon()
      const isoStart = isoLocal(dates[0]), isoEnd = isoLocal(dates[6])
      const startBuf = new Date(dates[0]); startBuf.setHours(-6, 0, 0, 0)
      const endBuf = new Date(dates[6]); endBuf.setHours(30, 0, 0, 0)
      const [planR, bodyR, recR, cycR, runR, whoopR] = await Promise.all([
        supabase.from('training_plan').select('dow, training_type, load'),
        supabase.from('body_composition').select('weight_kg, body_fat_pct').order('measured_at', { ascending: false }).limit(1),
        supabase.from('whoop_recovery').select('recovery_score').order('recovery_date', { ascending: false }).limit(1),
        supabase.from('whoop_cycles').select('strain').order('start_time', { ascending: false }).limit(3),
        supabase.from('running_log').select('run_date, distance_km').gte('run_date', isoStart).lte('run_date', isoEnd),
        supabase.from('whoop_workouts').select('start_time, sport_name, calories_kcal').gte('start_time', startBuf.toISOString()).lte('start_time', endBuf.toISOString())
      ])
      const plan = {}
      ;(planR.data || []).forEach((r) => { if (r.dow) plan[r.dow] = r })
      const body = (bodyR.data && bodyR.data[0]) || {}
      const weight = Number(body.weight_kg) || 70
      const bf = body.body_fat_pct != null ? Number(body.body_fat_pct) : null
      const recovery = recR.data && recR.data[0] && recR.data[0].recovery_score != null ? Number(recR.data[0].recovery_score) : null
      const strains = (cycR.data || []).map((r) => Number(r.strain)).filter((v) => !isNaN(v))
      const avgStrain = strains.length ? strains.reduce((a, b) => a + b, 0) / strains.length : null

      const kcalPerKm = Math.round(weight * 1.036)
      let targetKcal
      if (bf == null) targetKcal = 350
      else if (bf <= 10) targetKcal = 250
      else targetKcal = Math.round(Math.min(500, 300 + (bf - 10) * 25))
      const baseKm = Math.round((targetKcal / Math.max(1, kcalPerKm)) * 10) / 10
      const readiness = recovery != null && recovery >= 67 ? 1.15 : (recovery != null && recovery < 34 ? 0.6 : 1.0)
      const strainMult = avgStrain != null && avgStrain >= 15 ? 0.85 : 1.0

      const runByIso = {}
      ;(runR.data || []).forEach((r) => { if (r.distance_km != null) runByIso[r.run_date] = Number(r.distance_km) })
      const liftedByIso = {}, soccerByIso = {}, runKcalByIso = {}
      ;(whoopR.data || []).forEach((r) => {
        const d = isoLocal(new Date(r.start_time))
        const sport = (r.sport_name || '').trim()
        if (sport === 'Weightlifting' || sport === 'Powerlifting') liftedByIso[d] = true
        else if (sport === 'Soccer') soccerByIso[d] = true
        else if (sport === 'Running' && r.calories_kcal != null) runKcalByIso[d] = (runKcalByIso[d] || 0) + Number(r.calories_kcal)
      })

      const todayIso = isoLocal(new Date())
      const running = dates.map((d, i) => {
        const iso = isoLocal(d)
        const dow = DOW[i]
        const load = plan[dow] && plan[dow].load ? String(plan[dow].load).toLowerCase() : 'moderate'
        const factor = LOAD_FACTOR[load] != null ? LOAD_FACTOR[load] : 0.8
        let sugKm = Math.round(baseKm * factor * readiness * strainMult * 10) / 10
        if (sugKm < 1.0) sugKm = 0
        let actual = null
        if (runByIso[iso] != null) actual = runByIso[iso]
        else if (runKcalByIso[iso]) { const est = Math.round((runKcalByIso[iso] / Math.max(1, kcalPerKm)) * 10) / 10; if (est > 0) actual = est }
        return { dow, iso, suggested: sugKm, actual, isToday: iso === todayIso }
      })

      const days = dates.map((d, i) => {
        const iso = isoLocal(d)
        const dow = DOW[i]
        const type = plan[dow] ? plan[dow].training_type : null
        const isLift = LIFT_CATS.includes(type)
        const isSoccer = type === 'Soccer'
        const done = isSoccer ? !!soccerByIso[iso] : !!liftedByIso[iso]
        return { dow, iso, type, isLift, isSoccer, done, isToday: iso === todayIso, isPast: iso < todayIso }
      })
      const doneCats = {}
      days.forEach((d) => { if (d.isLift && d.done) doneCats[d.type] = true })
      const remaining = LIFT_CATS.filter((c) => !doneCats[c])
      const doneCount = LIFT_CATS.length - remaining.length
      const missed = days.filter((d) => d.isLift && d.isPast && !d.done && !doneCats[d.type])
      const openLiftDaysLeft = days.filter((d) => d.type && !d.isSoccer && !d.isPast).length
      const behindBy = Math.max(0, remaining.length - openLiftDaysLeft)
      const liftsWhoop = days.filter((d) => d.isLift && d.done).length

      setSug({
        weekKey: isoWeekLabel(new Date()),
        running,
        meta: { recovery, kcalPerKm, baseKm, weight: Math.round(weight * 10) / 10 },
        days, doneCount, remaining, missed, behindBy, liftsWhoop
      })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSugLoading(false)
    }
  }

  useEffect(() => { if (view === 'suggest' && !sug) loadSuggest() }, [view])

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '14px 16px' }
  const label = { fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)', margin: '0 0 10px 0' }
  const suggestBtn = { flexShrink: 0, backgroundColor: 'var(--brand-500)', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }
  const backBtn = { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tx-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500, padding: 0, marginBottom: '8px' }

  if (loading) return <div className="status-block">Loading workouts...</div>
  if (error) return <div className="status-block error">Failed to load: {error}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: view === 'log' ? '20px' : '16px' }}>
      {view === 'log' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)' }}>Workouts</h1>
          <button onClick={() => setView('suggest')} style={suggestBtn}>Suggestions ›</button>
        </div>
      ) : (
        <div>
          <button onClick={() => setView('log')} style={backBtn}>← Workouts</button>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)' }}>Weekly Suggestions</h1>
        </div>
      )}

      {view === 'log' && (() => {
        const completedByWhoopId = {}
        completed.forEach((c) => {
          if (c.whoop_workout_id) completedByWhoopId[c.whoop_workout_id] = c
        })
        return (
          <section>
            {sessions.length === 0 ? (
              <div className="status-block">No WHOOP sessions yet. New ones appear here after your watch syncs.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sessions.map((s) => {
                  const c = completedByWhoopId[s.workout_id]
                  const isWeightlifting = s.sport_name === 'Weightlifting'
                  const exs = c && c.workouts && c.workouts.workout_exercises ? [...c.workouts.workout_exercises].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)) : []
                  const open = c && expanded === c.id
                  const displayName = c ? (c.workout_name || (c.workouts && c.workouts.name) || s.sport_name) : (s.sport_name || 'Activity')

                  return (
                    <div key={s.workout_id} style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: strainColor(s.strain), flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{fmtDate(s.start_time)}{c && s.sport_name ? ` · ${s.sport_name}` : ''}</div>
                        </div>
                        {isWeightlifting && !c && saved.length > 0 ? (
                          <select defaultValue="" disabled={busy === s.workout_id} onChange={(e) => assign(s, e.target.value)} style={{ fontSize: '16px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)', maxWidth: '48%' }}>
                            <option value="" disabled>Assign…</option>
                            {saved.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
                          </select>
                        ) : (
                          <>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: strainColor(s.strain) }}>{s.strain != null ? Number(s.strain).toFixed(1) : '—'}</div>
                              <div style={{ fontSize: '9px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>strain</div>
                            </div>
                            {c && (
                              <button onClick={() => removeCompleted(c.id)} title="Unassign workout" style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>×</button>
                            )}
                          </>
                        )}
                      </div>
                      {c && exs.length > 0 && (
                        <>
                          <button onClick={() => setExpanded(open ? null : c.id)} style={{ marginTop: '8px', border: 'none', background: 'transparent', color: 'var(--brand-400)', cursor: 'pointer', fontSize: '12px', padding: 0 }}>{open ? 'Hide exercises' : `${exs.length} exercise${exs.length !== 1 ? 's' : ''}`}</button>
                          {open && (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {exs.map((we, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--tx-secondary)' }}>
                                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{we.exercises ? we.exercises.name : 'Exercise'}</span>
                                  <span style={{ color: 'var(--tx-muted)', flexShrink: 0, marginLeft: '8px' }}>{we.sets || '—'} × {we.reps || '—'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })()}

      {view === 'suggest' && (
        !sug ? (
          <div className="status-block">{sugLoading ? 'Crunching your week...' : 'Loading...'}</div>
        ) : (
          <>
            {/* Running targets */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--tx-primary)', letterSpacing: '0.02em' }}>RUNNING · {sug.weekKey}</div>
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target vs actual</div>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {sug.running.map((r) => (
                  <div key={r.iso} style={{ flex: 1, textAlign: 'center', padding: '8px 2px', borderRadius: '8px', border: r.isToday ? '1px solid var(--brand-500)' : '1px solid var(--surface-border)', background: r.isToday ? 'rgba(233,83,43,0.08)' : 'var(--surface-base)' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: r.isToday ? 'var(--brand-400)' : 'var(--tx-muted)', textTransform: 'uppercase' }}>{r.dow}</div>
                    <div style={{ fontSize: '10px', color: 'var(--tx-secondary)', marginTop: '4px' }}>→{r.suggested ? r.suggested.toFixed(1) : 0} km</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: r.actual != null ? 'var(--brand-400)' : 'var(--tx-muted)', marginTop: '2px' }}>{r.actual != null ? r.actual.toFixed(1) + ' km' : '—'}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(233,83,43,0.06)', border: '1px solid rgba(233,83,43,0.2)', fontSize: '11px', color: 'var(--tx-secondary)', lineHeight: 1.5 }}>
                <b style={{ color: 'var(--brand-400)' }}>Run target</b> · Targets scale with your weight, WHOOP recovery ({sug.meta.recovery != null ? Math.round(sug.meta.recovery) + '%' : 'n/a'}), recent strain, and each day's training load. ~{sug.meta.kcalPerKm} kcal/km. Rough estimate, not medical advice.
              </div>
            </div>

            {/* This week plan */}
            <div style={card}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--tx-primary)', letterSpacing: '0.02em', marginBottom: '12px' }}>THIS WEEK · {sug.weekKey}</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {sug.days.map((d) => {
                  const missed = sug.missed.some((m) => m.iso === d.iso)
                  return (
                    <div key={d.iso} style={{ flex: 1, textAlign: 'center', padding: '8px 2px', borderRadius: '8px', border: d.done ? '1px solid #3fae6b' : (d.isToday ? '1px solid var(--brand-500)' : '1px solid var(--surface-border)'), background: d.done ? 'rgba(63,174,107,0.12)' : (d.isToday ? 'rgba(233,83,43,0.08)' : 'var(--surface-base)') }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: d.isToday ? 'var(--brand-400)' : 'var(--tx-muted)', textTransform: 'uppercase' }}>{d.dow}</div>
                      <div style={{ fontSize: '9px', color: 'var(--tx-secondary)', marginTop: '4px', lineHeight: 1.2 }}>{d.type ? (SHORT[d.type] || d.type) : '—'}</div>
                      <div style={{ fontSize: '11px', marginTop: '3px', height: '14px', color: d.done ? '#3fae6b' : '#ef4444' }}>{d.done ? '✓' : (missed ? '!' : '')}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--tx-secondary)', lineHeight: 1.5 }}>
                Done this week: <b style={{ color: 'var(--tx-primary)' }}>{sug.doneCount} of {LIFT_CATS.length} lift categories</b>. WHOOP shows <b style={{ color: 'var(--tx-primary)' }}>{sug.liftsWhoop} lifts logged</b>.
                {sug.missed.length > 0 && (
                  <span style={{ color: '#f59e0b' }}> Missed: {sug.missed.map((m) => `${m.dow} ${SHORT[m.type] || m.type}`).join(', ')}.</span>
                )}
              </div>
              {sug.remaining.length === 0 ? (
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(63,174,107,0.1)', border: '1px solid rgba(63,174,107,0.3)', fontSize: '12px', color: 'var(--tx-secondary)' }}>
                  <b style={{ color: '#3fae6b' }}>All 4 categories done this week.</b> Nice.
                </div>
              ) : sug.behindBy > 0 ? (
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(233,83,43,0.08)', border: '1px solid rgba(233,83,43,0.25)', fontSize: '12px', color: 'var(--tx-secondary)' }}>
                  <b style={{ color: 'var(--brand-400)' }}>Behind by {sug.behindBy}:</b> double up on a day or prioritize <b style={{ color: 'var(--tx-primary)' }}>{sug.remaining.join(' → ')}</b>.
                </div>
              ) : (
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', fontSize: '12px', color: 'var(--tx-secondary)' }}>
                  On track. Still to hit: <b style={{ color: 'var(--tx-primary)' }}>{sug.remaining.join(', ')}</b>.
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  )
}
