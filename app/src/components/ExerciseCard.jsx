import { Link } from 'react-router-dom'

export default function ExerciseCard({ exercise }) {
  const firstImage = exercise.images && exercise.images.length > 0 ? exercise.images[0] : null
  const level = exercise.level ? String(exercise.level).toLowerCase() : ''

  return (
    <Link to={`/exercise/${exercise.id}`} className="exercise-card">
      <div className="exercise-card-image">
        {firstImage ? (
          <img
            src={firstImage}
            alt={exercise.name}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <span className="exercise-card-placeholder">◐</span>
        )}
      </div>
      <div className="exercise-card-body">
        <div className="exercise-card-title">{exercise.name}</div>
        <div className="exercise-card-meta">
          {exercise.muscle_group && (
            <span className="pill muscle">{exercise.muscle_group}</span>
          )}
          {exercise.level && (
            <span className={`pill level-${level}`}>{exercise.level}</span>
          )}
          {exercise.equipment && (
            <span className="pill">{exercise.equipment}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
