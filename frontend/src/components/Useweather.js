/**
 * useWeather — fetches real weather data from Open-Meteo (free, no API key)
 * Refreshes every 10 minutes automatically.
 * Returns: { weather, loading, error, refresh }
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const REFRESH_MS = 10 * 60 * 1000  // 10 minutes

const WMO_CODES = {
  0:   { label: 'Clear sky',          icon: '☀️' },
  1:   { label: 'Mainly clear',       icon: '🌤️' },
  2:   { label: 'Partly cloudy',      icon: '⛅' },
  3:   { label: 'Overcast',           icon: '☁️' },
  45:  { label: 'Foggy',              icon: '🌫️' },
  48:  { label: 'Icy fog',            icon: '🌫️' },
  51:  { label: 'Light drizzle',      icon: '🌦️' },
  53:  { label: 'Drizzle',            icon: '🌦️' },
  55:  { label: 'Heavy drizzle',      icon: '🌧️' },
  61:  { label: 'Slight rain',        icon: '🌧️' },
  63:  { label: 'Moderate rain',      icon: '🌧️' },
  65:  { label: 'Heavy rain',         icon: '🌧️' },
  66:  { label: 'Freezing rain',      icon: '🌨️' },
  67:  { label: 'Heavy freezing rain',icon: '🌨️' },
  71:  { label: 'Slight snow',        icon: '🌨️' },
  73:  { label: 'Moderate snow',      icon: '❄️' },
  75:  { label: 'Heavy snow',         icon: '❄️' },
  77:  { label: 'Snow grains',        icon: '🌨️' },
  80:  { label: 'Slight showers',     icon: '🌦️' },
  81:  { label: 'Moderate showers',   icon: '🌧️' },
  82:  { label: 'Violent showers',    icon: '⛈️' },
  85:  { label: 'Slight snow showers',icon: '🌨️' },
  86:  { label: 'Heavy snow showers', icon: '❄️' },
  95:  { label: 'Thunderstorm',       icon: '⛈️' },
  96:  { label: 'Thunderstorm + hail',icon: '⛈️' },
  99:  { label: 'Thunderstorm + heavy hail', icon: '⛈️' },
}

// Weather warnings based on conditions
function deriveWarnings(data) {
  const warnings = []
  if (!data) return warnings

  const code = data.weatherCode
  const wind = data.windSpeed

  if ([95, 96, 99].includes(code))
    warnings.push({ level: 'danger', icon: '⛈️', text: 'Thunderstorm warning' })
  if ([65, 82].includes(code))
    warnings.push({ level: 'warning', icon: '🌧️', text: 'Heavy rain warning' })
  if ([75, 86].includes(code))
    warnings.push({ level: 'warning', icon: '❄️', text: 'Heavy snowfall warning' })
  if (wind > 60)
    warnings.push({ level: 'danger',  icon: '💨', text: `Strong wind: ${wind.toFixed(0)} km/h` })
  else if (wind > 40)
    warnings.push({ level: 'warning', icon: '💨', text: `Wind advisory: ${wind.toFixed(0)} km/h` })
  if ([45, 48].includes(code))
    warnings.push({ level: 'info',    icon: '🌫️', text: 'Fog — reduced visibility' })

  return warnings
}

// Resolve wind direction degrees → compass
function windDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}

export default function useWeather(lat, lon) {
  const [weather,  setWeather]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const timerRef = useRef(null)
  const abortRef = useRef(null)

  const fetch = useCallback(async (la, lo) => {
    if (la == null || lo == null) return
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError('')
    try {
      const url = (
        `https://api.open-meteo.com/v1/forecast`
        + `?latitude=${la}&longitude=${lo}`
        + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m`
        + `&hourly=precipitation_probability`
        + `&forecast_days=1`
        + `&wind_speed_unit=kmh`
      )
      const res  = await window.fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
      const json = await res.json()
    console.log(json.current);

     console.log("Weather API Response:", json);

const c = json.current;

if (!c) {
  throw new Error("Weather data is unavailable.");
}

const code = c.weather_code;

const meta = WMO_CODES[code] || {
  label: "Unknown",
  icon: "🌡️",
};
      // Get rain probability for the current hour
      const nowH   = new Date().getHours()
      const rainPct= json.hourly?.precipitation_probability?.[nowH] ?? null

      const parsed = {
        temp:           c.temperature_2m,
        feelsLike:      c.apparent_temperature,
        humidity:       c.relative_humidity_2m,
        precipitation:  c.precipitation,
        windSpeed:      c.wind_speed_10m,
        windGusts:      c.wind_gusts_10m,
        windDir:        windDir(c.wind_direction_10m),
        windDirDeg:     c.wind_direction_10m,
        weatherCode:    code,
        label:          meta.label,
        icon:           meta.icon,
        rainPct,
        updatedAt:      new Date(),
      }
      parsed.warnings = deriveWarnings(parsed)
      setWeather(parsed)
    } catch (e) {
      if (e.name === 'AbortError') return
      setError('Weather unavailable')
      console.warn('[useWeather]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (lat == null || lon == null) return
    fetch(lat, lon)
    timerRef.current = setInterval(() => fetch(lat, lon), REFRESH_MS)
    return () => {
      clearInterval(timerRef.current)
      abortRef.current?.abort()
    }
  }, [lat, lon, fetch])

  return { weather, loading, error, refresh: () => fetch(lat, lon) }
}