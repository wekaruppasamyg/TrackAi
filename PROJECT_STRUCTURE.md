# TrackAI Project Structure

## Complete Directory Layout

```
TrackAI/
│
├── .github/
│   └── copilot-instructions.md
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app
│   │   ├── config.py               # Configuration
│   │   ├── database.py             # SQLAlchemy setup
│   │   ├── schemas.py              # Pydantic models
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py             # User model
│   │   │   ├── location.py         # Location model
│   │   │   └── geofence.py         # Geofence model
│   │   │
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── users.py            # User endpoints
│   │   │   ├── locations.py        # Location endpoints
│   │   │   ├── geofences.py        # Geofence endpoints
│   │   │   └── analytics.py        # Analytics endpoints
│   │   │
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── auth.py             # Authentication
│   │       ├── location.py         # Location logic
│   │       ├── geofence.py         # Geofence logic
│   │       └── analytics.py        # Analytics logic
│   │
│   ├── requirements.txt
│   ├── .env.example
│   ├── run.py                      # Server entry point
│   └── trackkai.db                 # SQLite database (created at runtime)
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                # React entry point
│   │   ├── App.jsx                 # Main app component
│   │   ├── store.js                # Zustand state
│   │   ├── index.css               # Global styles
│   │   ├── App.css                 # App styles
│   │   │
│   │   ├── components/
│   │   │   ├── LoginForm.jsx       # Auth component
│   │   │   ├── MapDashboard.jsx    # Map view
│   │   │   ├── AnalyticsDashboard.jsx  # Analytics view
│   │   │   ├── GeofenceManager.jsx     # Geofence view
│   │   │   ├── LocationTracker.jsx     # Tracking component
│   │   │   ├── ConsentManager.jsx      # Settings
│   │   │   └── Navigation.jsx          # Navigation bar
│   │   │
│   │   ├── services/
│   │   │   └── api.js              # API client
│   │   │
│   │   └── styles/
│   │       ├── auth.css
│   │       ├── map.css
│   │       ├── analytics.css
│   │       ├── geofence.css
│   │       └── components.css
│   │
│   ├── public/                     # Static assets
│   ├── index.html                  # HTML template
│   ├── package.json                # Dependencies
│   ├── vite.config.js              # Vite config
│   ├── .env.example
│   └── node_modules/               # Installed packages (created at runtime)
│
├── database/
│   └── init_db.py                  # DB initialization script
│
├── .gitignore                      # Git ignore rules
├── README.md                       # Project documentation
├── SETUP.md                        # Setup guide
└── PROJECT_STRUCTURE.md            # This file
```

## File Descriptions

### Backend Files

#### Core Application
- **main.py** - FastAPI application setup, CORS config, router setup
- **config.py** - Environment variables and configuration settings
- **database.py** - SQLAlchemy engine, sessions, database initialization
- **schemas.py** - Pydantic models for API request/response validation

#### Models (Database)
- **user.py** - User model with authentication fields
- **location.py** - GPS location tracking model
- **geofence.py** - Geofence boundary model

#### Routes (API Endpoints)
- **users.py** - Register, login, user info, consent management
- **locations.py** - Create, retrieve, and analyze locations
- **geofences.py** - Create, update, delete, list geofences
- **analytics.py** - AI-powered analysis and reporting endpoints

#### Services (Business Logic)
- **auth.py** - Password hashing, JWT token management, user authentication
- **location.py** - Location calculations, distance, statistics
- **geofence.py** - Geofence checks, event detection
- **analytics.py** - AI analysis, travel summaries, insights

#### Configuration
- **requirements.txt** - Python package dependencies
- **.env.example** - Environment variable template
- **run.py** - Server startup script

### Frontend Files

#### Core React
- **main.jsx** - React DOM render
- **App.jsx** - Main app layout with routing
- **index.css** - Global styles
- **App.css** - App layout styles

#### Components
- **LoginForm.jsx** - Registration and login form
- **MapDashboard.jsx** - Interactive Leaflet map with markers
- **AnalyticsDashboard.jsx** - Analytics queries and insights
- **GeofenceManager.jsx** - Create and manage geofences
- **LocationTracker.jsx** - Send current location
- **ConsentManager.jsx** - GPS tracking permissions
- **Navigation.jsx** - Top navigation bar

#### Services
- **api.js** - Axios instance and API client methods

#### Styling
- **auth.css** - Login/signup styles
- **map.css** - Map dashboard styles
- **analytics.css** - Analytics panel styles
- **geofence.css** - Geofence manager styles
- **components.css** - Component styles

#### Configuration
- **package.json** - Node dependencies and scripts
- **vite.config.js** - Vite bundler configuration
- **index.html** - HTML template
- **.env.example** - Environment variable template

### Database
- **init_db.py** - Creates tables and seeds sample data

### Documentation
- **README.md** - Complete project documentation
- **SETUP.md** - Step-by-step setup instructions
- **PROJECT_STRUCTURE.md** - This file

## Key Technology Files

### Python/Backend
- `requirements.txt` - All Python dependencies
- `app/config.py` - Settings and configuration
- `app/database.py` - Database connection and setup
- `app/schemas.py` - Data validation models

### JavaScript/Frontend
- `package.json` - All Node dependencies
- `vite.config.js` - Build and dev server config
- `index.html` - Entry HTML file
- `src/store.js` - Global state management

## Database Schema

### Users
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  hashed_password VARCHAR NOT NULL,
  full_name VARCHAR,
  is_active BOOLEAN DEFAULT TRUE,
  is_consent_given BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW()
)
```

### Locations
```sql
CREATE TABLE locations (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR FOREIGN KEY,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  accuracy FLOAT,
  altitude FLOAT,
  speed FLOAT,
  heading FLOAT,
  timestamp DATETIME DEFAULT NOW(),
  created_at DATETIME DEFAULT NOW()
)
```

### Geofences
```sql
CREATE TABLE geofences (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR FOREIGN KEY,
  name VARCHAR NOT NULL,
  description VARCHAR,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  radius FLOAT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW()
)
```

## API Routes Summary

### Users
- POST /api/users/register
- POST /api/users/login
- GET /api/users/me
- PUT /api/users/me/consent

### Locations
- POST /api/locations
- GET /api/locations
- GET /api/locations/history
- GET /api/locations/statistics
- GET /api/locations/{id}

### Geofences
- POST /api/geofences
- GET /api/geofences
- GET /api/geofences/{id}
- PUT /api/geofences/{id}
- DELETE /api/geofences/{id}

### Analytics
- POST /api/analytics/query
- GET /api/analytics/travel-summary
- GET /api/analytics/insights

## Environment Variables

### Backend
- DATABASE_URL - SQLite connection string
- JWT_SECRET_KEY - Secret for JWT tokens
- OPENAI_API_KEY - OpenAI API key for AI features
- ENVIRONMENT - development/production
- DEBUG - Debug mode flag

### Frontend
- VITE_API_URL - Backend API base URL

## Running the Application

### Terminal 1 (Backend)
```bash
cd backend
venv\Scripts\activate
python run.py
```

### Terminal 2 (Frontend)
```bash
cd frontend
npm run dev
```

Then visit: http://localhost:5173

## Build Commands

### Backend
```bash
pip install -r requirements.txt
python database/init_db.py
python backend/run.py
```

### Frontend
```bash
npm install
npm run dev
npm run build  # For production
```

## File Statistics

- **Total Files**: ~60+
- **Python Files**: ~15
- **JavaScript Files**: ~12
- **CSS Files**: ~7
- **Configuration Files**: ~8
- **Documentation Files**: ~3

## Dependencies

### Backend
- FastAPI - Web framework
- Uvicorn - ASGI server
- SQLAlchemy - ORM
- Pydantic - Data validation
- Python-jose - JWT
- Passlib - Password hashing
- Python-dotenv - Environment variables

### Frontend
- React 18 - UI library
- Vite - Build tool
- React Router - Navigation
- Axios - HTTP client
- Leaflet - Mapping
- React-Leaflet - React wrapper
- Zustand - State management
