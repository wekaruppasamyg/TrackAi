# TrackAI Setup Instructions

Complete step-by-step guide to set up and run TrackAI locally.

## Prerequisites

Before you start, ensure you have the following installed:

- **Python 3.8 or higher** - Download from [python.org](https://www.python.org/downloads/)
- **Node.js 16+ and npm** - Download from [nodejs.org](https://nodejs.org/). **Windows users:** Ensure "Add to PATH" is checked during installation.
- **Git** - For version control (optional)
- **A code editor** - VS Code recommended

Verify installations:
```bash
python --version
node --version
npm --version
```

## Step-by-Step Setup

### Phase 1: Backend Setup

#### 1.1 Navigate to Backend Directory
```bash
cd backend
```

#### 1.2 Create Python Virtual Environment
```bash
# On Windows
python -m venv venv
venv\Scripts\activate

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` prefix in your terminal.

#### 1.3 Install Backend Dependencies
```bash
pip install -r requirements.txt
```

This installs:
- FastAPI (web framework)
- Uvicorn (ASGI server)
- SQLAlchemy (ORM)
- Pydantic (data validation)
- Python-jose & Passlib (authentication)

#### 1.4 Configure Environment Variables
```bash
# Create .env file from template
copy .env.example .env
# Edit .env with your settings (or keep defaults for development)
```

**Default values work for development:**
```env
DATABASE_URL=sqlite:///./trackkai.db
JWT_SECRET_KEY=dev-secret-key-change-in-production
ENVIRONMENT=development
```

#### 1.5 Initialize Database
```bash
cd ../database
python init_db.py
cd ../backend
```

This creates:
- SQLite database (`trackkai.db`)
- All required tables (users, locations, geofences)
- Sample demo user (username: `demo_user`, password: `password123`)

#### 1.6 Start Backend Server
```bash
python run.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Test backend:**
- Open browser: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

---

### Phase 2: Frontend Setup

#### 2.1 Open New Terminal and Navigate to Frontend
```bash
# In a new terminal window/tab
cd frontend
```

#### 2.2 Install Frontend Dependencies
```bash
npm install
```

This installs:
- React (UI library)
- Vite (build tool)
- Axios (HTTP client)
- Leaflet (map library)
- React Router Dom (routing)
- Zustand (state management)

#### 2.3 Configure Environment
```bash
# Create .env file
copy .env.example .env
# Default is http://localhost:8000/api (matches backend)
```

#### 2.4 Start Frontend Development Server
```bash
npm run dev
```

You should see:
```
Local:        http://localhost:5173/
```

---

### Phase 3: Test the Application

#### 3.1 Open Application
- Open browser: `http://localhost:5173`

#### 3.2 Create Account
1. Click "Sign Up"
2. Enter:
   - Full Name: Your Name
   - Email: your@email.com
   - Username: your_username
   - Password: any password
3. Click "Sign Up"

#### 3.3 Login
- Use your created credentials
- Or demo account: `demo_user` / `password123`

#### 3.4 Enable GPS Tracking
1. Click "⚙️ Settings" in sidebar
2. Check "Allow GPS Tracking"

#### 3.5 Send Your Location
1. Click "📍 Tracking" in sidebar
2. Click "Send Current Location"
3. Grant browser permission for geolocation

#### 3.6 View Map Dashboard
1. Click "🗺️ Map" in sidebar
2. See your location markers on the map

#### 3.7 Try Analytics
1. Click "📊 Analytics" in sidebar
2. Try asking: "How far did I travel?"
3. Or view travel summary

#### 3.8 Create Geofence
1. Click "🛑 Geofences" in sidebar
2. Create a new geofence with:
   - Name: Office
   - Latitude: 51.5074
   - Longitude: -0.1278
   - Radius: 500

---

## API Examples

### Register User
```bash
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "secure123",
    "full_name": "John Doe"
  }'
```

### Login User
```bash
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "secure123"
  }'
```

Response will include JWT token:
```json
{
  "access_token": "eyJ0eXAiOiJKV1...",
  "token_type": "bearer",
  "user_id": "12345..."
}
```

### Send Location
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
  -G --data-urlencode "token=YOUR_JWT_TOKEN"
```

---

## Troubleshooting

### Backend Issues

**Error: "Address already in use"**
- Port 8000 is taken by another application
- Solution: Change port in backend or kill the process using port 8000

**Error: "No module named 'fastapi'"**
- Virtual environment not activated
- Solution: Run `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)

**Error: "database.db is locked"**
- Database file is corrupted
- Solution: Delete `trackkai.db` and run `python init_db.py` again

### Frontend Issues

**Error: "npm ERR! ERESOLVE could not resolve dependency"**
- Peer dependency conflicts (common with React/Leaflet versions)
- Solution: Run `npm install --legacy-peer-deps`

**Error: "Cannot GET /"**
- Frontend server not running
- Solution: Make sure you ran `npm run dev` in the frontend directory

**Error: "VITE_API_URL is undefined"**
- .env file not created
- Solution: Copy .env.example to .env

**Map not displaying**
- Leaflet CSS not loaded
- Solution: Check browser console for errors, refresh page

### Geolocation Issues

**"Geolocation permission denied"**
- Browser blocking geolocation
- Solution: Check browser settings, allow geolocation for localhost

---

## Development Workflow

### Making Backend Changes
1. Edit files in `backend/app/`
2. Uvicorn auto-reloads when files change
3. No need to restart server

### Making Frontend Changes
1. Edit files in `frontend/src/`
2. Vite hot-reloads changes
3. Browser updates automatically

### Database Changes
1. Create new models in `backend/app/models/`
2. Update in `app/models/__init__.py`
3. Run `python init_db.py` to recreate tables

---

## Production Deployment

### Before Deploying

1. **Change JWT Secret:**
   ```env
   JWT_SECRET_KEY=your-very-secure-random-string
   ```

2. **Change Database:**
   - From SQLite to PostgreSQL for production
   - Update `DATABASE_URL`

3. **Set Environment:**
   ```env
   ENVIRONMENT=production
   DEBUG=False
   ```

4. **Configure CORS:**
   - Update allowed origins in `backend/app/main.py`

### Deploy with Docker

```bash
# Build Docker image
docker build -t trackkai-backend backend/

# Run container
docker run -p 8000:8000 trackkai-backend

# For frontend
docker build -t trackkai-frontend frontend/
docker run -p 3000:80 trackkai-frontend
```

---

## Useful Commands

### Backend
```bash
# Activate virtual environment
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# Install new package
pip install package-name

# Freeze dependencies
pip freeze > requirements.txt

# Deactivate environment
deactivate
```

### Frontend
```bash
# Install packages
npm install

# Add new package
npm install package-name

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

---

## Next Steps

1. **Customize**: Modify the application to fit your needs
2. **Deploy**: Follow production deployment steps
3. **Scale**: Add more features like notifications, sharing, etc.
4. **Monitor**: Set up logging and monitoring
5. **Optimize**: Improve performance and security

---

## Support & Resources

- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **React Docs**: https://react.dev/
- **Leaflet Docs**: https://leafletjs.com/
- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/

---

**Happy Tracking! 🗺️**
