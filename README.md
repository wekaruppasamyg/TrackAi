# TrackAI - AI-Powered Real-Time GPS Tracking and Analytics Platform

An intelligent web application that enables users to share their live GPS locations with consent, visualizes movements on an interactive map, and generates smart travel analytics and reports using artificial intelligence.

## 🎯 Features

- **Real-time GPS Tracking** - Track consenting users' live locations
- **Multi-user Monitoring** - Support for multiple users with separate location histories
- **Interactive Map Dashboard** - Visualize locations on OpenStreetMap with Leaflet
- **Travel History & Route Tracking** - View complete movement history with timestamps
- **Geofencing Alerts** - Create location-based boundaries and receive entry/exit notifications
- **AI-Powered Analytics** - Natural language queries about movement patterns and travel data
- **Smart Reports** - Automated travel summaries, distance calculations, speed analysis
- **Secure Authentication** - JWT-based user authentication
- **Consent Management** - Users control GPS tracking with explicit consent
- **RESTful API** - Complete API for all features

## 🏗️ Architecture

### Tech Stack

- **Backend:** Python + FastAPI
- **Frontend:** React.js + Vite
- **Database:** SQLite
- **Maps:** Leaflet + OpenStreetMap
- **Authentication:** JWT (JSON Web Tokens)
- **AI:** LLM Integration (OpenAI-ready)
- **State Management:** Zustand (Frontend)

### Project Structure

```
TrackAI/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Configuration management
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── models/              # Database models
│   │   │   ├── user.py
│   │   │   ├── location.py
│   │   │   └── geofence.py
│   │   ├── routes/              # API routes
│   │   │   ├── users.py
│   │   │   ├── locations.py
│   │   │   ├── geofences.py
│   │   │   └── analytics.py
│   │   └── services/            # Business logic
│   │       ├── auth.py
│   │       ├── location.py
│   │       ├── geofence.py
│   │       └── analytics.py
│   ├── requirements.txt         # Python dependencies
│   ├── run.py                   # Server entry point
│   └── .env.example             # Environment template
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx             # React entry point
│   │   ├── App.jsx              # Main app component
│   │   ├── store.js             # Zustand state management
│   │   ├── components/          # React components
│   │   │   ├── LoginForm.jsx
│   │   │   ├── MapDashboard.jsx
│   │   │   ├── AnalyticsDashboard.jsx
│   │   │   ├── GeofenceManager.jsx
│   │   │   ├── LocationTracker.jsx
│   │   │   ├── ConsentManager.jsx
│   │   │   └── Navigation.jsx
│   │   ├── services/            # API clients
│   │   │   └── api.js
│   │   └── styles/              # CSS modules
│   ├── index.html               # HTML template
│   ├── package.json             # Node dependencies
│   ├── vite.config.js           # Vite configuration
│   └── .env.example             # Environment template
│
└── database/
    └── init_db.py               # Database initialization script
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file from template:
```bash
cp .env.example .env
```

5. Update `.env` with your settings:
```env
DATABASE_URL=sqlite:///./trackkai.db
JWT_SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=your-openai-key-here
ENVIRONMENT=development
```

6. Initialize the database:
```bash
cd ../database
python init_db.py
cd ../backend
```

7. Start the server:
```bash
python run.py
```

The backend API will be available at `http://localhost:8000`

**API Documentation:** `http://localhost:8000/docs` (Swagger UI)

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env`:
```env
VITE_API_URL=http://localhost:8000/api
```

5. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 📝 API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/users/me` - Get current user
- `PUT /api/users/me/consent` - Update GPS consent

### Locations
- `POST /api/locations` - Create location entry
- `GET /api/locations` - Get recent locations
- `GET /api/locations/history` - Get location history
- `GET /api/locations/statistics` - Get location statistics
- `GET /api/locations/{id}` - Get specific location

### Geofences
- `POST /api/geofences` - Create geofence
- `GET /api/geofences` - List user geofences
- `GET /api/geofences/{id}` - Get specific geofence
- `PUT /api/geofences/{id}` - Update geofence
- `DELETE /api/geofences/{id}` - Delete geofence

### Analytics
- `POST /api/analytics/query` - Ask AI question about data
- `GET /api/analytics/travel-summary` - Get travel summary
- `GET /api/analytics/insights` - Get AI insights

## 🔐 Authentication Flow

1. **User Registration**: Create account with username, email, and password
2. **Login**: Authenticate with credentials to receive JWT token
3. **Authorization**: Include token in API requests as query parameter: `?token=<jwt_token>`
4. **Consent**: Users explicitly grant GPS tracking permission
5. **Token Expiry**: Tokens expire after 24 hours (configurable)

## 📊 Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `username` (String, Unique)
- `email` (String, Unique)
- `hashed_password` (String)
- `full_name` (String)
- `is_active` (Boolean)
- `is_consent_given` (Boolean)
- `created_at` (DateTime)
- `updated_at` (DateTime)

### Locations Table
- `id` (UUID, Primary Key)
- `user_id` (Foreign Key)
- `latitude` (Float)
- `longitude` (Float)
- `accuracy` (Float)
- `altitude` (Float)
- `speed` (Float)
- `heading` (Float)
- `timestamp` (DateTime)
- `created_at` (DateTime)

### Geofences Table
- `id` (UUID, Primary Key)
- `user_id` (Foreign Key)
- `name` (String)
- `description` (String)
- `latitude` (Float)
- `longitude` (Float)
- `radius` (Float)
- `is_active` (Boolean)
- `created_at` (DateTime)
- `updated_at` (DateTime)

## 🧠 AI Analytics Features

### Distance Analysis
- Calculate total distance traveled
- Analyze travel patterns
- Compare movement across time periods

### Speed Analysis
- Calculate average speed
- Identify speed anomalies
- Analyze acceleration patterns

### Behavior Patterns
- Detect location patterns
- Identify frequent locations
- Analyze travel frequency

### Natural Language Queries
- "How far did I travel this week?"
- "What was my average speed?"
- "Where do I spend most time?"
- "Show me my movement patterns"

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
# Database
DATABASE_URL=sqlite:///./trackkai.db
DATABASE_ECHO=False

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256

# OpenAI (optional)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo

# Server
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:8000/api
```

## 📱 Usage Examples

### 1. Register and Login
```bash
# Register
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "secure_password",
    "full_name": "John Doe"
  }'

# Login
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "secure_password"
  }'
```

### 2. Send Location
```bash
curl -X POST http://localhost:8000/api/locations \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 51.5074,
    "longitude": -0.1278,
    "accuracy": 5.0,
    "altitude": 10.0,
    "speed": 5.0,
    "heading": 180.0
  }' \
  -G --data-urlencode "token=<JWT_TOKEN>"
```

### 3. Query Analytics
```bash
curl -X POST http://localhost:8000/api/analytics/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How far did I travel today?",
    "user_id": "<USER_ID>",
    "date_from": "2024-01-01T00:00:00",
    "date_to": "2024-01-02T00:00:00"
  }' \
  -G --data-urlencode "token=<JWT_TOKEN>"
```

## 🛠️ Development

### Backend Development
- FastAPI auto-reload: Changes are reflected immediately
- Swagger API docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend Development
- Vite HMR: Hot module replacement enabled
- React DevTools compatible
- Fast rebuild times

## 📦 Deployment

### Docker (Optional)
```dockerfile
# Backend Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend .
CMD ["python", "run.py"]
```

### Production Checklist
- [ ] Change JWT secret key
- [ ] Set production database
- [ ] Configure CORS for production domain
- [ ] Enable HTTPS
- [ ] Set up SSL certificates
- [ ] Configure reverse proxy (nginx)
- [ ] Enable rate limiting
- [ ] Set up logging and monitoring

## 🐛 Troubleshooting

### Backend Issues
- **Port 8000 already in use**: Change port in `.env`
- **Database locked**: Delete `trackkai.db` and reinitialize
- **Import errors**: Ensure virtual environment is activated

### Frontend Issues
- **API connection errors**: Verify `VITE_API_URL` in `.env`
- **Map not loading**: Check Leaflet CSS import
- **Geolocation denied**: Check browser permissions

## 📝 License

MIT License - Feel free to use this project

## 🤝 Contributing

Contributions welcome! Please follow the code style and add tests for new features.

## 📞 Support

For issues and questions, please open an issue on GitHub or contact the development team.

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Status:** Active Development
