"""
Location model for tracking GPS coordinates
"""

from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid

class Location(Base):
    """Location model for storing GPS tracking data"""
    
    __tablename__ = "locations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float)  # Accuracy in meters
    altitude = Column(Float)
    speed = Column(Float)  # Speed in m/s
    heading = Column(Float)  # Direction in degrees
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="locations")
    
    def __repr__(self):
        return f"<Location(user_id={self.user_id}, lat={self.latitude}, lon={self.longitude})>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "accuracy": self.accuracy,
            "altitude": self.altitude,
            "speed": self.speed,
            "heading": self.heading,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
