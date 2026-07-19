import React, { useState, useEffect, useCallback } from 'react'
import { geofenceAPI } from '../services/api'
import { useGeofenceStore } from '../store'
import '../styles/geofence.css'

export default function GeofenceManager({ userId }) {
  const geofences = useGeofenceStore((state) => state.geofences)
  const setGeofences = useGeofenceStore((state) => state.setGeofences)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState(500)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadGeofences = useCallback(async () => {
    try {
      const response = await geofenceAPI.getGeofences()
      setGeofences(response.data)
    } catch (err) {
      setError('Failed to load geofences')
    }
  }, [setGeofences])

  useEffect(() => {
    loadGeofences()
  }, [userId, loadGeofences])

  const handleCreateGeofence = async (e) => {
    e.preventDefault()
    if (!name || !latitude || !longitude) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      const response = await geofenceAPI.createGeofence({
        name,
        description,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius),
      })
      
      // Add to list
      setGeofences([response.data, ...geofences])
      
      // Reset form
      setName('')
      setDescription('')
      setLatitude('')
      setLongitude('')
      setRadius(500)
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create geofence')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGeofence = async (id) => {
    try {
      await geofenceAPI.deleteGeofence(id)
      setGeofences(geofences.filter((g) => g.id !== id))
    } catch (err) {
      setError('Failed to delete geofence')
    }
  }

  return (
    <div className="geofence-manager">
      <h2>Geofence Management</h2>

      {error && <div className="error-message">{error}</div>}

      <div className="geofence-create">
        <h3>Create New Geofence</h3>
        <form onSubmit={handleCreateGeofence}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Office, Home"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Latitude *</label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g., 51.5074"
                required
              />
            </div>

            <div className="form-group">
              <label>Longitude *</label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g., -0.1278"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Radius (meters)</label>
            <input
              type="number"
              min="50"
              max="10000"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Geofence'}
          </button>
        </form>
      </div>

      <div className="geofence-list">
        <h3>Your Geofences ({geofences.length})</h3>
        {geofences.length === 0 ? (
          <p className="empty-message">No geofences created yet</p>
        ) : (
          <div className="geofences">
            {geofences.map((geofence) => (
              <div key={geofence.id} className="geofence-item">
                <div className="geofence-info">
                  <h4>{geofence.name}</h4>
                  <p>{geofence.description}</p>
                  <small>
                    Location: {geofence.latitude.toFixed(4)}, {geofence.longitude.toFixed(4)} | 
                    Radius: {geofence.radius}m
                  </small>
                </div>
                <button
                  onClick={() => handleDeleteGeofence(geofence.id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
