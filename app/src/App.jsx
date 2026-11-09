import React from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import HubPage from './pages/HubPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ExerciseListPage from './pages/ExerciseListPage.jsx'
import ExerciseDetailPage from './pages/ExerciseDetailPage.jsx'
import WorkoutsPage from './pages/WorkoutsPage.jsx'
import WorkoutDetailPage from './pages/WorkoutDetailPage.jsx'
import ProgramsPage from './pages/ProgramsPage.jsx'
import FoodPage from './pages/FoodPage.jsx'
import WeightPage from './pages/WeightPage.jsx'
import FinancesExpensesPage from './pages/FinancesExpensesPage.jsx'
import FinancesInvestmentsPage from './pages/FinancesInvestmentsPage.jsx'
import Galaxy from './components/Galaxy/Galaxy.jsx'
import RubberSegment from './components/RubberSegment/RubberSegment.jsx'
import AppLock from './components/AppLock.jsx'
import AuthGate from './components/AuthGate.jsx'
import './App.css'

const NAV_ICONS = {
  home: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  ),
  exercises: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"></path>
      <path d="m9.6 14.4 4.8-4.8"></path>
      <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"></path>
    </svg>
  ),
  workouts: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
    </svg>
  ),
  programs: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
    </svg>
  ),
  food: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20m-5-17A5 5 0 0 1 12 2a5 5 0 0 1 5 3v15a5 5 0 0 1-5 5 5 5 0 0 1-5-5z"></path>
    </svg>
  ),
  weight: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18"></path>
      <path d="m3 7 3 8a5 5 0 0 0 6 0l3-8"></path>
      <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"></path>
    </svg>
  ),
  expenses: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path>
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path>
    </svg>
  ),
  investments: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"></path>
      <path d="m19 9-5 5-4-4-3 3"></path>
    </svg>
  ),
  menu: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  )
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  const isHub = path === '/'
  const isFinances = path === '/finances' || path.startsWith('/finances/')

  const isActive = (target, opts = {}) => {
    if (opts.exact) return path === target
    return path === target || path.startsWith(target + '/')
  }

  return (
    <AuthGate>
    <AppLock>
    <div className="app-shell galaxy-bg">
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#050509', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <Galaxy
          mouseInteraction={false}
          hueShift={100}
          speed={0.1}
          rotationSpeed={0}
          glowIntensity={0.4}
          twinkleIntensity={0.7}
          repulsionStrength={1}
          starSpeed={0.2}
          density={2.2}
          saturation={0.3}
        />
      </div>
      <main className="app-main" style={isHub ? { maxWidth: '1080px' } : undefined}>
        <Routes>
          <Route path="/" element={<HubPage />} />
          <Route path="/fitness" element={<HomePage />} />
          <Route path="/exercises" element={<ExerciseListPage />} />
          <Route path="/exercise/:id" element={<ExerciseDetailPage />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/workout/:id" element={<WorkoutDetailPage />} />
          <Route path="/programs" element={<ProgramsPage />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/weight" element={<WeightPage />} />
          <Route path="/finances" element={<FinancesExpensesPage />} />
          <Route path="/finances/investments" element={<FinancesInvestmentsPage />} />
        </Routes>
      </main>

      {!isHub && (() => {
        let items, current
        if (isFinances) {
          items = [
            { value: 'expenses', label: 'Expenses', icon: NAV_ICONS.expenses, to: '/finances' },
            { value: 'investments', label: 'Investments', icon: NAV_ICONS.investments, to: '/finances/investments' },
            { value: 'menu', label: 'Menu', icon: NAV_ICONS.menu, to: '/' }
          ]
          current = path.startsWith('/finances/investments') ? 'investments' : 'expenses'
        } else {
          items = [
            { value: 'home', label: 'Home', icon: NAV_ICONS.home, to: '/fitness' },
            { value: 'exercises', label: 'Exercises', icon: NAV_ICONS.exercises, to: '/exercises' },
            { value: 'workouts', label: 'Workouts', icon: NAV_ICONS.workouts, to: '/workouts' },
            { value: 'programs', label: 'Programs', icon: NAV_ICONS.programs, to: '/programs' },
            { value: 'food', label: 'Food', icon: NAV_ICONS.food, to: '/food' },
            { value: 'weight', label: 'Weight', icon: NAV_ICONS.weight, to: '/weight' },
            { value: 'menu', label: 'Menu', icon: NAV_ICONS.menu, to: '/' }
          ]
          if (path === '/fitness' || path.startsWith('/fitness/')) current = 'home'
          else if (path.startsWith('/exercises') || path.startsWith('/exercise/')) current = 'exercises'
          else if (path.startsWith('/workouts') || path.startsWith('/workout/')) current = 'workouts'
          else if (path.startsWith('/programs')) current = 'programs'
          else if (path.startsWith('/food')) current = 'food'
          else if (path.startsWith('/weight')) current = 'weight'
          else current = 'home'
        }
        return (
          <div className={`rubber-nav-wrap${items.length > 5 ? ' rubber-nav-compact' : ''}`}>
            <RubberSegment
              items={items}
              value={current}
              onChange={(v) => {
                const target = items.find((it) => it.value === v)
                if (target) navigate(target.to)
              }}
              size="md"
              squash={2.5}
              inset={6}
              radius={24}
              glide={85}
              trackColor="rgba(20, 24, 40, 0.55)"
              thumbColor="rgba(255, 255, 255, 0.95)"
              textColor="rgba(255, 255, 255, 0.75)"
              activeTextColor="#0a0f1f"
              aria-label="Section navigation"
            />
          </div>
        )
      })()}
    </div>
    </AppLock>
    </AuthGate>
  )
}
