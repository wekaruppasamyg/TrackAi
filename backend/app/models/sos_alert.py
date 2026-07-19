"""
SOS emergency alert model.
"""

from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import relationship

from app.database import Base


class SOSAlert(Base):
    """Stores emergency SOS activations with the user's live location."""

    __tablename__ = "sos_alerts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float)
    altitude = Column(Float)
    speed = Column(Float)
    heading = Column(Float)
    status = Column(String(20), default="active", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="sos_alerts")

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
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
