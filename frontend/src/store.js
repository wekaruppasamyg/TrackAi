import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token, isAuthenticated: !!token }),
  logout: () => set({ user: null, token: null, isAuthenticated: false }),
}))

export const useLocationStore = create((set) => ({
  locations: [],
  currentLocation: null,
  loading: false,
  error: null,
  // Live tracking state
  isTracking: false,
  wsConnected: false,

  setLocations: (locations) => set({ locations }),
  setCurrentLocation: (location) => set({ currentLocation: location }),
  addLocation: (location) =>
    set((state) => ({
      locations: [location, ...state.locations],
      currentLocation: location,          // always keep currentLocation up-to-date
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setIsTracking: (isTracking) => set({ isTracking }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
}))

export const useGeofenceStore = create((set) => ({
  geofences: [],
  loading: false,
  error: null,

  setGeofences: (geofences) => set({ geofences }),
  addGeofence: (geofence) =>
    set((state) => ({
      geofences: [geofence, ...state.geofences],
    })),
  removeGeofence: (id) =>
    set((state) => ({
      geofences: state.geofences.filter((g) => g.id !== id),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))