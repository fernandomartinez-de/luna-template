import { useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { LIFT_UNIT, LIFT_STEP } from '../config.js'

function seedFrom(we) {
  if (Array.isArray(we.set_details) && we.set_details.length > 0) {
    return we.set_details.map((s) => ({
      reps: s && s.reps != null && s.reps !== '' ? String(s.reps) : '',
      weight: s && s.weight != null && s.weight !== '' ? String(s.weight) : ''
    }))
  }
  const n = Math.max(Number(we.sets) || 0, 0)
  if (n === 0) return []
  const reps = we.reps != null ? String(we.reps) : ''
  const weight = we.weight != null ? String(we.weight) : ''
  return Array.from({ length: n }, () => ({ reps, weight }))
}

export default function LogWorkoutModal({ workout, exercises, onClose, onLogged }) {
  const [rows, setRows] = useState(
    exercises.map((we) => ({
      workout_exercise_id: we.id,
      exercise_id: (we.exercises && we.exercises.id) || we.exercise_id,
      name: (we.exercises && we.exercises.name) || 'Exercise',
      order_index: we.order_index,
      setArr: seedFrom(we)
    }))
  )
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function updateSet(rowId, idx, field, value) {
    setRows((prev) => prev.map((r) => {
      if (r.workout_exercise_id !== rowId) return r
      return { ...r, setArr: r.setArr.map((s, i) => (i === idx ? { ...s, [field]: value } : s)) }
    }))
  }
  function addSet(rowId) {
    setRows((prev) => prev.map((r) => {
      if (r.workout_exercise_id !== rowId) return r
      const last = r.setArr[r.setArr.length - 1] || { reps: '', weight: '' }
      return { ...r, setArr: [...r.setArr, { reps: last.reps, weight: last.weight }] }
    }))
  }
  function removeSet(rowId, idx) {
    setRows((prev) => prev.map((r) => (r.workout_exercise_id !== rowId ? r : { ...r, setArr: r.setArr.filter((_, i) => i !== idx) })))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const now = new Date()
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      const { data: whoopMatch } = await supabase
        .from('whoop_workouts')
        .select('workout_id, strain, calories_kcal, start_time')
        .eq('sport_name', 'Weightlifting')
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .order('start_time', { ascending: false })
        .limit(1)

      let linked = whoopMatch && whoopMatch[0] ? whoopMatch[0] : null

      // A WHOOP session can only be linked to one logged workout. If it was
      // already assigned (e.g. from the Workouts page), log without the link.
      if (linked) {
        const { data: taken } = await supabase
          .from('completed_workouts')
          .select('id')
          .eq('whoop_workout_id', linked.workout_id)
          .limit(1)
        if (taken && taken.length > 0) linked = null
      }

      const { data: cw, error: cwErr } = await supabase
        .from('completed_workouts')
        .insert({
          workout_id: workout.id,
          workout_name: workout.name,
          sport_name: workout.name,
          performed_at: linked && linked.start_time ? linked.start_time : now.toISOString(),
          notes: notes || null,
          whoop_workout_id: linked ? linked.workout_id : null,
          strain: linked ? linked.strain : null,
          calories_kcal: linked ? linked.calories_kcal : null
        })
        .select()
        .single()
      if (cwErr) throw cwErr

      const payload = rows.map((r) => ({
        completed_workout_id: cw.id,
        exercise_id: r.exercise_id,
        order_index: r.order_index,
        set_details: r.setArr.map((s) => ({
          reps: s.reps === '' ? null : Number(s.reps),
          weight: s.weight === '' ? null : Number(s.weight)
        }))
      }))

      if (payload.length > 0) {
        const { error: cweErr } = await supabase.from('completed_workout_exercises').insert(payload)
        if (cweErr) throw cweErr
      }

      onLogged(cw)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  const numInput = { width: '54px', textAlign: 'center', fontSize: '15px', padding: '5px 4px', borderRadius: '6px', border: '1px solid var(--surface-border)', background: 'var(--surface-raised)', color: 'var(--tx-primary)' }
  const setRow = { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '6px 10px' }
  const xSet = { border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '2px 4px' }
  const addSetBtn = { border: '1px dashed var(--surface-border)', background: 'transparent', color: 'var(--brand-400)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', width: '100%' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Log · {workout.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-field">
            <label>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did the session feel?"
              rows={2}
            />
          </div>

          <div className="modal-field">
            <label>Actuals · edit any set that ran differently</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '50vh', overflowY: 'auto', padding: '2px' }}>
              {rows.map((r) => (
                <div key={r.workout_exercise_id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx-primary)' }}>{r.name}</div>
                  {r.setArr.map((s, i) => (
                    <div key={i} style={setRow}>
                      <span style={{ fontSize: '11px', color: 'var(--tx-muted)', width: '38px', flexShrink: 0 }}>Set {i + 1}</span>
                      <input type="number" min="0" max="100" placeholder="reps" value={s.reps} onChange={(e) => updateSet(r.workout_exercise_id, i, 'reps', e.target.value)} style={numInput} />
                      <span style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>×</span>
                      <input type="number" min="0" step={LIFT_STEP} placeholder={LIFT_UNIT} value={s.weight} onChange={(e) => updateSet(r.workout_exercise_id, i, 'weight', e.target.value)} style={{ ...numInput, width: '64px' }} />
                      <span style={{ fontSize: '11px', color: 'var(--tx-muted)', flex: 1 }}>{LIFT_UNIT}</span>
                      <button type="button" onClick={() => removeSet(r.workout_exercise_id, i)} title="Drop set" style={xSet}>×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addSet(r.workout_exercise_id)} style={addSetBtn}>+ Add set</button>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-button secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="modal-button primary" disabled={saving}>{saving ? 'Logging...' : '✓ Log workout'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
