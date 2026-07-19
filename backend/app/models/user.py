"""
User model for TrackAI
"""

from sqlalchemy import Column, String, Integer, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
import uuid

class User(Base):
    """User model for authentication and location tracking"""
    
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_consent_given = Column(Boolean, default=False)  # GPS tracking consent
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    locations = relationship("Location", back_populates="user", cascade="all, delete-orphan")
    geofences = relationship("Geofence", back_populates="user", cascade="all, delete-orphan")
    sos_alerts = relationship("SOSAlert", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user")
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, email={self.email})>"
