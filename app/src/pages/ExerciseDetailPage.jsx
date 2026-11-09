import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import BodyDiagram from '../components/BodyDiagram.jsx'
import PersonalRecord from '../components/PersonalRecord.jsx'
import WeightProgression from '../components/WeightProgression.jsx'

// Muscle group colors matching the original app
const MUSCLE_COLORS = {
  chest: '#ef4444',
  back: '#3b82f6',
  shoulders: '#f97316',
  biceps: '#a855f7',
  triceps: '#ec4899',
  quadriceps: '#22c55e',
  hamstrings: '#14b8a6',
  glutes: '#eab308',
  calves: '#84cc16',
  core: '#f59e0b'
}

export default function ExerciseDetailPage() {
  const { id } = useParams()
  const [exercise, setExercise] = useState(null)
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [personalRecord, setPersonalRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadWorkoutData(exerciseId) {
      try {
        // Every set logged for this exercise, from the Log Workout screen.
        // Each completed exercise stores its sets as [{ reps, weight }, ...];
        // the date comes from the parent completed workout.
        const { data: rows, error: logsError } = await supabase
          .from('completed_workout_exercises')
          .select('id, set_details, completed_workouts(performed_at)')
          .eq('exercise_id', exerciseId)

        if (logsError) throw logsError

        const logs = (rows || [])
          .flatMap((row) => {
            const loggedAt = row.completed_workouts?.performed_at
            const sets = Array.isArray(row.set_details) ? row.set_details : []
            return sets.map((s, i) => ({
              id: `${row.id}-${i}`,
              weight: Number(s.weight),
              reps: Number(s.reps),
              logged_at: loggedAt
            }))
          })
          .filter((l) => l.logged_at && l.weight > 0 && l.reps > 0)
          .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))

        if (!cancelled) setWorkoutLogs(logs)

        // Calculate personal record (best estimated 1RM)
        if (logs && logs.length > 0) {
          const withEstimated1RM = logs.map(log => ({
            ...log,
            estimated_1rm: parseFloat(
              (log.weight * (1 + log.reps / 30)).toFixed(1)
            )
          }))

          const best = withEstimated1RM.reduce((max, log) =>
            log.estimated_1rm > max.estimated_1rm ? log : max
          )

          if (!cancelled) setPersonalRecord(best)
        } else {
          if (!cancelled) setPersonalRecord(null)
        }
      } catch (err) {
        console.error('Failed to load workout data:', err)
      }
    }

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await supabase
          .from('exercises')
          .select('*')
          .eq('id', id)
          .single()

        if (err) throw err
        if (!cancelled) {
          setExercise(data)
          // Load workout data after exercise is loaded
          await loadWorkoutData(id)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <div className="status-block">Loading exercise...</div>
  }
  if (error) {
    return (
      <div className="status-block error">
        Failed to load exercise: {error}
      </div>
    )
  }
  if (!exercise) {
    return <div className="status-block">Exercise not found.</div>
  }

  const level = exercise.level ? String(exercise.level).toLowerCase() : ''
  const instructions = Array.isArray(exercise.instructions)
    ? exercise.instructions
    : []
  const images = Array.isArray(exercise.images) ? exercise.images.slice(0, 2) : []
  const secondary = Array.isArray(exercise.secondary_muscles)
    ? exercise.secondary_muscles
    : []

  return (
    <>
      <Link to="/exercises" className="detail-back">
        ← Back to all exercises
      </Link>

      <div className="detail-header">
        <h1>{exercise.name}</h1>
        <div className="detail-header-meta">
          {exercise.muscle_group && (
            <span className="pill muscle">{exercise.muscle_group}</span>
          )}
          {exercise.level && (
            <span className={`pill level-${level}`}>{exercise.level}</span>
          )}
          {exercise.equipment && (
            <span className="pill">{exercise.equipment}</span>
          )}
          {exercise.category && (
            <span className="pill">{exercise.category}</span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Personal Record */}
        <PersonalRecord exerciseId={id} record={personalRecord} />

        {/* Weight Progression */}
        <WeightProgression logs={workoutLogs} />

        {/* Muscle Diagram */}
        <div className="detail-section" style={{ padding: 0, background: 'transparent', border: 'none' }}>
          <BodyDiagram exercise={exercise} />
        </div>

        {/* Also Works */}
        {secondary.length > 0 && (
          <div className="detail-section">
            <h2>ALSO WORKS</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {secondary.map((muscle, idx) => {
                const color = MUSCLE_COLORS[muscle] || '#64748b'
                return (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      backgroundColor: color + '33',
                      color: color,
                      border: `1px solid ${color}66`,
                      textTransform: 'capitalize'
                    }}
                  >
                    {muscle}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Movement Images */}
        <div className="detail-section">
          <h2>Movement</h2>
          <div className="movement-images">
            {[0, 1].map((idx) => (
              <div key={idx} className="movement-image">
                {images[idx] ? (
                  <img
                    src={images[idx]}
                    alt={`${exercise.name} step ${idx + 1}`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="movement-image-placeholder">
                    No image
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="detail-section">
          <h2>Instructions</h2>
          {instructions.length > 0 ? (
            <ol className="instructions-list">
              {instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : (
            <div style={{ color: 'var(--slate-400)' }}>
              No instructions available.
            </div>
          )}
        </div>

        {/* Details */}
        <div className="detail-section">
          <h2>Details</h2>
          <div className="detail-meta-grid">
            <div className="meta-cell">
              <div className="meta-cell-label">Primary muscle</div>
              <div className="meta-cell-value">
                {exercise.muscle_group || 'unknown'}
              </div>
            </div>
            <div className="meta-cell">
              <div className="meta-cell-label">Equipment</div>
              <div className="meta-cell-value">
                {exercise.equipment || 'none'}
              </div>
            </div>
            <div className="meta-cell">
              <div className="meta-cell-label">Category</div>
              <div className="meta-cell-value">
                {exercise.category || 'general'}
              </div>
            </div>
            <div className="meta-cell">
              <div className="meta-cell-label">Level</div>
              <div className="meta-cell-value">
                {exercise.level || 'unspecified'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
