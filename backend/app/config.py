"""
Configuration settings for TrackAI backend
"""

import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Database
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "trackkai.db")
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("sqlite:///./"):
    rel_path = DATABASE_URL.replace("sqlite:///./", "")
    DATABASE_URL = f"sqlite:///{os.path.abspath(os.path.join(BASE_DIR, rel_path))}"

if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{os.path.abspath(DEFAULT_DB_PATH)}"

DATABASE_ECHO = os.getenv("DATABASE_ECHO", "False").lower() == "true"

# JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# OpenAI (backward compat)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

# Geofence
DEFAULT_GEOFENCE_RADIUS = 500

# API
API_TITLE       = "TrackAI API"
API_VERSION     = "1.0.0"
API_DESCRIPTION = "AI-Powered Real-Time GPS Tracking and Analytics Platform"

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEBUG = ENVIRONMENT == "development"

# ── Brevo (Sendinblue) email API ──────────────────────────────────────────────
# Add these to your .env file:
#   BREVO_API_KEY=your-brevo-api-key
#   BREVO_SENDER_EMAIL=no-reply@yourdomain.com
#   BREVO_SENDER_NAME=TrackAI
BREVO_API_KEY     = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL= os.getenv("BREVO_SENDER_EMAIL", "no-reply@trackkai.com")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "TrackAI")

# OTP config
OTP_EXPIRE_MINUTES = 10   # OTP valid for 10 minutes