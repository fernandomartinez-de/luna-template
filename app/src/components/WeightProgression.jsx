import { useState } from 'react'
import { LIFT_UNIT } from '../config.js'

export default function WeightProgression({ logs }) {
  const [timeRange, setTimeRange] = useState('3m') // 1m, 3m, 6m, All

  // Filter logs by time range
  const getFilteredLogs = () => {
    if (!logs || logs.length === 0) return []

    const now = new Date()
    const cutoff = new Date()

    switch (timeRange) {
      case '1m':
        cutoff.setMonth(now.getMonth() - 1)
        break
      case '3m':
        cutoff.setMonth(now.getMonth() - 3)
        break
      case '6m':
        cutoff.setMonth(now.getMonth() - 6)
        break
      case 'All':
        return logs
      default:
        return logs
    }

    return logs.filter(log => new Date(log.logged_at) >= cutoff)
  }

  const filteredLogs = getFilteredLogs()
  const hasData = filteredLogs.length > 0

  // Calculate chart dimensions and data points
  const renderChart = () => {
    if (!hasData) {
      return (
        <div className="progression-empty">
          No data for this period
        </div>
      )
    }

    // Sort by date
    const sortedLogs = [...filteredLogs].sort(
      (a, b) => new Date(a.logged_at) - new Date(b.logged_at)
    )

    const maxWeight = Math.max(...sortedLogs.map(l => parseFloat(l.weight)))
    const minWeight = Math.min(...sortedLogs.map(l => parseFloat(l.weight)))
    const range = maxWeight - minWeight || 10
    const padding = range * 0.1

    const chartHeight = 200
    const chartWidth = 100 // percentage

    return (
      <div className="progression-chart">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '200px' }}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y * 2}
              x2={chartWidth}
              y2={y * 2}
              stroke="rgba(148, 163, 184, 0.1)"
              strokeWidth="0.5"
            />
          ))}

          {/* Line chart */}
          <polyline
            points={sortedLogs
              .map((log, i) => {
                const x = (i / (sortedLogs.length - 1 || 1)) * chartWidth
                const weight = parseFloat(log.weight)
                const y =
                  chartHeight -
                  ((weight - minWeight + padding) / (range + padding * 2)) * chartHeight
                return `${x},${y}`
              })
              .join(' ')}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {sortedLogs.map((log, i) => {
            const x = (i / (sortedLogs.length - 1 || 1)) * chartWidth
            const weight = parseFloat(log.weight)
            const y =
              chartHeight -
              ((weight - minWeight + padding) / (range + padding * 2)) * chartHeight
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="1.5"
                fill="#22d3ee"
              />
            )
          })}
        </svg>

        {/* Weight labels */}
        <div className="progression-labels">
          <span>{minWeight} {LIFT_UNIT}</span>
          <span>{maxWeight} {LIFT_UNIT}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="progression-card">
      <div className="progression-header">
        <span className="progression-title">WEIGHT PROGRESSION</span>
        <div className="progression-filters">
          {['1m', '3m', '6m', 'All'].map((range) => (
            <button
              key={range}
              className={`progression-filter ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      {renderChart()}
    </div>
  )
}
