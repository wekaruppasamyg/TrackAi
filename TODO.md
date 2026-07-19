# TODO - Live Map Dashboard (Google Maps)

## Phase 1: Understand current behavior
- [x] Inspect current map component (Leaflet)
- [x] Inspect admin user listing + last_location source
- [x] Inspect location APIs and current route-history support

## Phase 2: Google Maps upgrade
- [ ] Replace Leaflet map with Google Maps (react-google-maps/api)
- [ ] Implement admin map markers for all users
- [ ] Add online/offline marker styling based on last_location.timestamp

## Phase 3: Live tracking (Swiggy/Zomato style)
- [ ] Add realtime channel (WebSocket or SSE) to push location updates
- [ ] Update markers on every realtime event without refresh

## Phase 4: Route history
- [ ] Add backend endpoint for admin to fetch a user’s route history
- [ ] Render route history as Google Maps Polyline

## Phase 5: Setup
- [ ] Add VITE_GOOGLE_MAPS_API_KEY usage
- [ ] Verify build + dev run

