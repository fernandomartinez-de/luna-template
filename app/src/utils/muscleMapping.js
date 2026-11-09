export const MUSCLE_GROUPS = [
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'quadriceps', label: 'Quadriceps' },
  { key: 'hamstrings', label: 'Hamstrings' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'calves', label: 'Calves' },
  { key: 'core', label: 'Core' }
]

export const MUSCLE_TO_HIGHLIGHTER = {
  chest: ['chest'],
  back: ['upper-back', 'lower-back'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  quadriceps: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves'],
  core: ['abs', 'obliques']
}

export function toHighlighterMuscles(muscleGroup) {
  if (!muscleGroup) return []
  const key = String(muscleGroup).toLowerCase().trim()
  return MUSCLE_TO_HIGHLIGHTER[key] || []
}

export function buildExerciseModel(exercise) {
  const primary = toHighlighterMuscles(exercise?.muscle_group)
  const secondary = (exercise?.secondary_muscles || [])
    .flatMap((m) => toHighlighterMuscles(m))
    .filter((m) => !primary.includes(m)) // Remove duplicates with primary

  const result = []

  if (primary.length > 0) {
    result.push({
      name: 'Primary',
      muscles: primary,
      frequency: 2  // Higher frequency = primary (uses second color)
    })
  }

  if (secondary.length > 0) {
    result.push({
      name: 'Secondary',
      muscles: secondary,
      frequency: 1  // Lower frequency = secondary (uses first color)
    })
  }

  return result
}
