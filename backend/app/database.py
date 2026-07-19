"""
Database configuration and initialization for TrackAI
Using SQLite with SQLAlchemy ORM
"""

import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL, DATABASE_ECHO

logger = logging.getLogger(__name__)

# Database engine setup
engine = create_engine(
    DATABASE_URL,
    echo=DATABASE_ECHO,
    connect_args={"check_same_thread": False},
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class for models
Base = declarative_base()

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize the database - create all tables"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

def drop_db():
    """Drop all tables - use with caution"""
    Base.metadata.drop_all(bind=engine)
    logger.warning("Database dropped")
