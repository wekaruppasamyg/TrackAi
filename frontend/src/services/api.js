import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  const url = config.url || ''
  const isAuthPath =
    url.endsWith('/users/login') ||
    url.endsWith('/users/register') ||
    url.includes('/users/login?') ||
    url.includes('/users/register?')

  if (token && !isAuthPath) {
    config.params = { ...(config.params || {}), token }
  }
  return config
})

// Auth API
export const authAPI = {
  register: (data) => api.post("/users/register", data),
  login: (data) => api.post("/users/login", data),
  getCurrentUser: () => api.get("/users/me"),
  updateConsent: (given) =>
    api.put("/users/me/consent", null, {
      params: { consent_given: given },
    }),
  listUsers: () => api.get("/users/list"),
  deleteUser: (userId) => api.delete(`/users/${userId}`),
  googleLogin: (data) => api.post("/users/google-login", data),

  forgotPassword: (email) =>
    api.post("/users/forgot-password", { email }),

  verifyOTP: (email, otp) =>
    api.post("/users/verify-otp", {
      email,
      otp,
    }),

  resetPassword: (email, otp, newPassword) =>
    api.post("/users/reset-password", {
      email,
      otp,
      new_password: newPassword,
    }),
}
// Location API
export const locationAPI = {
  createLocation: (data) =>
    api.post('/locations', data),

  getLocations: (limit = 100, offset = 0) =>
    api.get('/locations', { params: { limit, offset } }),

  // Used by RouteHistory — returns points for a date range, sorted ascending
  getLocationHistory: (startDate, endDate) =>
    api.get('/locations/history', { params: { start_date: startDate, end_date: endDate } }),

  // Admin: get any user's history for the admin route-replay panel
  getAdminUserHistory: (userId, startDate, endDate) =>
    api.get(`/locations/history/admin/${userId}`, { params: { start_date: startDate, end_date: endDate } }),

  getStatistics: (days = 7) =>
    api.get('/locations/statistics', { params: { days } }),
}

// SOS API
export const sosAPI = {
  activate: (data) => api.post('/sos/activate', data),
  list:     (limit = 50) => api.get('/sos', { params: { limit } }),
}

// Notification API
export const notificationAPI = {
list: (limit = 50) =>
  api.get("/notifications", {
    params: {
      limit: Math.min(limit, 100),
    },
  }),  
  createEvent:(data) => api.post('/notifications/events', data),
  markRead:   (id) => api.put(`/notifications/${id}/read`),
  markAllRead:() => api.put('/notifications/read-all'),
}

// Geofence API
export const geofenceAPI = {
  createGeofence: (data)      => api.post('/geofences', data),
  getGeofences:   ()          => api.get('/geofences'),
  getGeofence:    (id)        => api.get(`/geofences/${id}`),
  updateGeofence: (id, data)  => api.put(`/geofences/${id}`, data),
  deleteGeofence: (id)        => api.delete(`/geofences/${id}`),

  // Admin only — every geofence across every user, with owner info.
  // `createGeofence` also accepts an optional `user_id` in `data` for
  // admins who want to assign the new geofence to a specific user.
  getAllGeofences: () => api.get('/geofences/admin/all'),
}

// Analytics API
export const analyticsAPI = {
  queryAnalytics: (question, userId, dateFrom, dateTo) =>
    api.post('/analytics/query', { question, user_id: userId, date_from: dateFrom, date_to: dateTo }),
  getTravelSummary: (days = 7, userId = null) =>
    api.get('/analytics/travel-summary', { params: { days, user_id: userId } }),
  getInsights: (days = 7, userId = null) =>
    api.get('/analytics/insights', { params: { days, user_id: userId } }),
  getAdminOverview: (days = 7) =>
    api.get('/analytics/admin-overview', { params: { days } }),
}

export default api