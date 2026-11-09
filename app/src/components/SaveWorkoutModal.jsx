import { useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { LIFT_UNIT, LIFT_STEP } from '../config.js'

export default function SaveWorkoutModal({ exercises, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState(
    exercises.map((ex) => ({ id: ex.id, name: ex.name, sets: 3, reps: 10, weight: '' }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({ name, description })
        .select()
        .single()

      if (workoutError) throw workoutError

      const workoutExercises = rows.map((r, index) => ({
        workout_id: workout.id,
        exercise_id: r.id,
        order_index: index,
        sets: Number(r.sets) || null,
        reps: Number(r.reps) || null,
        weight: Number(r.weight) || null
      }))

      const { error: exercisesError } = await supabase
        .from('workout_exercises')
        .insert(workoutExercises)

      if (exercisesError) throw exercisesError

      onSaved(workout)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  const numInput = {
    width: '44px', textAlign: 'center', fontSize: '16px', padding: '4px',
    borderRadius: '6px', border: '1px solid var(--surface-border)',
    background: 'var(--surface-raised)', color: 'var(--tx-primary)'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Save Workout</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSave} className="modal-form">
          <div className="modal-field">
            <label>Workout Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Legs A, Push Day, Full Body"
              required
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this workout..."
              rows={2}
            />
          </div>

          <div className="modal-field">
            <label>Exercises · sets, reps &amp; weight ({LIFT_UNIT})</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '40vh', overflowY: 'auto' }}>
              {rows.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '8px 10px' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--tx-muted)' }}>
                    sets
                    <input type="number" min="1" max="20" value={r.sets} onChange={(e) => updateRow(r.id, 'sets', e.target.value)} style={numInput} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--tx-muted)' }}>
                    reps
                    <input type="number" min="1" max="100" value={r.reps} onChange={(e) => updateRow(r.id, 'reps', e.target.value)} style={numInput} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--tx-muted)' }}>
                    {LIFT_UNIT}
                    <input type="number" min="0" step={LIFT_STEP} placeholder="0" value={r.weight} onChange={(e) => updateRow(r.id, 'weight', e.target.value)} style={{ ...numInput, width: '54px' }} />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="modal-error">{error}</div>
          )}

          <div className="modal-actions">
            <button type="button" className="modal-button secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="modal-button primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Workout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
