"""
Realtime notification model.
"""

from datetime import datetime
import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Notification(Base):
    """Stores admin-facing realtime notifications."""

    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String(50), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    message = Column(Text, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    sos_alert_id = Column(String, ForeignKey("sos_alerts.id"), nullable=True, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    metadata_json = Column(Text)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="notifications")

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "user_id": self.user_id,
            "sos_alert_id": self.sos_alert_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "metadata_json": self.metadata_json,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
