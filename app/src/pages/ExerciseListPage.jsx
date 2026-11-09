import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import MuscleFilter from '../components/MuscleFilter.jsx'
import LevelFilter from '../components/LevelFilter.jsx'
import ExerciseCard from '../components/ExerciseCard.jsx'
import SaveWorkoutModal from '../components/SaveWorkoutModal.jsx'
import SquishSwitch from '../components/SquishSwitch/SquishSwitch.jsx'

const PAGE_SIZE = 60

export default function ExerciseListPage() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState('all')
  const [selectedLevel, setSelectedLevel] = useState('all')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [buildMode, setBuildMode] = useState(false)
  const [selectedExercises, setSelectedExercises] = useState([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [savedWorkouts, setSavedWorkouts] = useState([])
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      setLoading(true)
      setError(null)

      const batchSize = 1000
      let from = 0
      const collected = []

      try {
        while (true) {
          const { data, error: err } = await supabase
            .from('exercises')
            .select(
              'id, name, slug, muscle_group, secondary_muscles, equipment, category, level, images'
            )
            .order('name', { ascending: true })
            .range(from, from + batchSize - 1)

          if (err) throw err
          if (!data || data.length === 0) break
          collected.push(...data)
          if (data.length < batchSize) break
          from += batchSize
        }

        if (!cancelled) {
          setExercises(collected)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAll()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadSavedWorkouts() {
    const { data, error: err } = await supabase
      .from('workouts')
      .select('id, name, description, created_at, workout_exercises(count)')
      .order('created_at', { ascending: false })
    if (!err && data) setSavedWorkouts(data)
  }

  useEffect(() => {
    loadSavedWorkouts()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter((e) => {
      if (selected !== 'all') {
        const mg = String(e.muscle_group || '').toLowerCase()
        if (mg !== selected) return false
      }
      if (selectedLevel !== 'all') {
        const level = String(e.level || '').toLowerCase()
        if (level !== selectedLevel) return false
      }
      if (q) {
        const name = String(e.name || '').toLowerCase()
        if (!name.includes(q)) return false
      }
      return true
    })
  }, [exercises, selected, selectedLevel, query])

  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [selected, selectedLevel, query])

  const shown = filtered.slice(0, visible)
  const hasMore = filtered.length > visible

  const toggleExercise = (exerciseId) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId]
    )
  }

  const handleBuildWorkout = () => {
    if (buildMode && selectedExercises.length > 0) {
      setShowSaveModal(true)
    } else {
      setBuildMode(true)
    }
  }

  const cancelBuildMode = () => {
    setBuildMode(false)
    setSelectedExercises([])
  }

  const handleWorkoutSaved = (workout) => {
    setShowSaveModal(false)
    setBuildMode(false)
    setSelectedExercises([])
    navigate(`/workout/${workout.id}`)
  }

  return (
    <>
      {buildMode && (
        <div className="build-workout-bar">
          <div className="build-workout-info">
            <span className="build-workout-count">
              {selectedExercises.length} exercise{selectedExercises.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="build-workout-actions">
            <button
              className="build-workout-button secondary"
              onClick={cancelBuildMode}
            >
              Cancel
            </button>
            <button
              className="build-workout-button primary"
              onClick={handleBuildWorkout}
              disabled={selectedExercises.length === 0}
            >
              Save Workout
            </button>
          </div>
        </div>
      )}

      {!buildMode && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
          <button className="build-workout-trigger" style={{ flex: 1 }} onClick={handleBuildWorkout}>
            + Build Workout
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--surface-border)', background: 'var(--surface-raised)', cursor: 'pointer', flex: 1, justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--tx-primary)' }}>Saved ({savedWorkouts.length})</span>
            <SquishSwitch
              checked={showSaved}
              onChange={setShowSaved}
              ariaLabel="Toggle saved workouts"
              width={44}
              height={24}
              trackColor="rgba(255,255,255,0.08)"
              trackOnColor="var(--brand-500)"
            />
          </label>
        </div>
      )}

      {!buildMode && showSaved && (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {savedWorkouts.length === 0 ? (
            <div className="status-block">No saved workouts yet. Tap Build Workout to make one.</div>
          ) : (
            savedWorkouts.map((w) => {
              const count = (w.workout_exercises && w.workout_exercises[0] && w.workout_exercises[0].count) || 0
              return (
                <Link key={w.id} to={`/workout/${w.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '14px 16px', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--tx-muted)', marginTop: '2px' }}>
                      {count} exercise{count !== 1 ? 's' : ''}{w.created_at ? ` · ${new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    </div>
                  </div>
                  <span style={{ color: 'var(--tx-muted)', flexShrink: 0, fontSize: '18px' }}>›</span>
                </Link>
              )
            })
          )}
        </div>
      )}

      <div className="list-toolbar">
        <div className="list-search">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Search exercises by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="list-count">
            {loading ? 'Loading...' : `${filtered.length} of ${exercises.length}`}
          </span>
        </div>
        <MuscleFilter selected={selected} onChange={setSelected} />
        <LevelFilter selected={selectedLevel} onChange={setSelectedLevel} />
      </div>

      {error && (
        <div className="status-block error">
          Failed to load exercises: {error}
        </div>
      )}

      {loading && !error && (
        <div className="status-block">Loading exercises from Supabase...</div>
      )}

      {!loading && !error && shown.length === 0 && (
        <div className="status-block">No exercises match this filter.</div>
      )}

      {!loading && !error && shown.length > 0 && (
        <>
          <div className="exercise-grid">
            {shown.map((ex) => (
              buildMode ? (
                <div
                  key={ex.id}
                  className={`exercise-card-selectable ${
                    selectedExercises.includes(ex.id) ? 'selected' : ''
                  }`}
                  onClick={() => toggleExercise(ex.id)}
                >
                  <input
                    type="checkbox"
                    className="exercise-checkbox"
                    checked={selectedExercises.includes(ex.id)}
                    onChange={() => toggleExercise(ex.id)}
                  />
                  <ExerciseCard exercise={ex} />
                </div>
              ) : (
                <ExerciseCard key={ex.id} exercise={ex} />
              )
            ))}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button
                type="button"
                className="filter-chip"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              >
                Load more ({filtered.length - visible} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {showSaveModal && (
        <SaveWorkoutModal
          exercises={exercises.filter((e) => selectedExercises.includes(e.id))}
          onClose={() => setShowSaveModal(false)}
          onSaved={handleWorkoutSaved}
        />
      )}
    </>
  )
}
