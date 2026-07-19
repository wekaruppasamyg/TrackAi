import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../store'
import { analyticsAPI } from '../services/api'
import '../styles/analytics.css'

export default function AnalyticsDashboard({ userId }) {
  const token = useAuthStore((state) => state.token)
  const [question, setQuestion] = useState('')
  const [travelSummary, setTravelSummary] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [days, setDays] = useState(7)

  useEffect(() => {
    loadAnalytics()
  }, [userId, days, token])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const summaryRes = await analyticsAPI.getTravelSummary(days)
      setTravelSummary(summaryRes.data)
      
      const insightsRes = await analyticsAPI.getInsights(days)
      setInsights(insightsRes.data)
    } catch (err) {
      setError('Failed to load analytics')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleQuerySubmit = async (e) => {
    e.preventDefault()
    if (!question.trim()) return

    try {
      setLoading(true)
      const res = await analyticsAPI.queryAnalytics(
        question,
        userId,
        null,
        null
      )
      setAnalysis(res.data)
      setQuestion('')
    } catch (err) {
      setError('Failed to process query')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="analytics-dashboard">
      <h2>Analytics & Reports</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Time Period Selector */}
      <div className="period-selector">
        <label>Time Period: </label>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Travel Summary */}
      {travelSummary && (
        <div className="analytics-card summary-card">
          <h3>Travel Summary</h3>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-label">Total Distance</span>
              <span className="stat-value">{travelSummary.total_distance_km} km</span>
            </div>
            <div className="stat">
              <span className="stat-label">Location Points</span>
              <span className="stat-value">{travelSummary.total_location_points}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Average Speed</span>
              <span className="stat-value">{travelSummary.average_speed_ms} m/s</span>
            </div>
          </div>
          <p className="summary-text">{travelSummary.summary}</p>
        </div>
      )}

      {/* AI Query Interface */}
      <div className="analytics-card query-card">
        <h3>Ask About Your Movement</h3>
        <form onSubmit={handleQuerySubmit} className="query-form">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., 'How far did I travel this week?' or 'What was my average speed?'"
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Analyzing...' : 'Ask AI'}
          </button>
        </form>

        {analysis && (
          <div className="analysis-result">
            <p className="question"><strong>Q:</strong> {analysis.question}</p>
            <p className="answer"><strong>A:</strong> {analysis.answer}</p>
            <small>Type: {analysis.analysis_type}</small>
          </div>
        )}
      </div>

      {/* Insights */}
      {insights && (
        <div className="analytics-card insights-card">
          <h3>Insights & Recommendations</h3>
          <div className="insights-list">
            {insights.insights?.map((insight, idx) => (
              <div key={idx} className="insight-item">
                <h4>{insight.type.replace(/_/g, ' ').toUpperCase()}</h4>
                <p>{insight.description}</p>
                <em>💡 {insight.recommendation}</em>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
