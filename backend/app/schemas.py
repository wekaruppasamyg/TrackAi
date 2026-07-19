"""
Pydantic schemas for API request/response validation
"""

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

# User Schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

# Location Schemas
class LocationCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    altitude: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None

class LocationResponse(BaseModel):
    id: str
    user_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float]
    altitude: Optional[float]
    speed: Optional[float]
    heading: Optional[float]
    timestamp: datetime
    
    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    is_consent_given: bool
    created_at: datetime
    last_location: Optional[LocationResponse] = None
    
    class Config:
        from_attributes = True

# Geofence Schemas
class GeofenceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    radius: float
    # Optional — admins may set this to create a geofence that applies to a
    # different user's location updates. Regular users never send this, and
    # omitting it preserves the original behaviour exactly (owner = caller).
    user_id: Optional[str] = None

class GeofenceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None
    is_active: Optional[bool] = None

class GeofenceResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str]
    latitude: float
    longitude: float
    radius: float
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Admin-only view of a geofence — same fields as GeofenceResponse plus the
# owning user's display info, used only by GET /geofences/admin/all so the
# admin panel can show "who is this geofence for" without extra lookups.
class GeofenceAdminItem(BaseModel):
    id: str
    user_id: str
    owner_username: Optional[str] = None
    owner_email: Optional[str] = None
    name: str
    description: Optional[str]
    latitude: float
    longitude: float
    radius: float
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str

# Analytics Schemas
class AnalyticsQuery(BaseModel):
    question: str
    user_id: str
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None

class AnalyticsResponse(BaseModel):
    question: str
    answer: str
    analysis_type: str
    timestamp: datetime

# SOS Schemas
class SOSCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    altitude: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None

class SOSResponse(BaseModel):
    id: str
    user_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float]
    altitude: Optional[float]
    speed: Optional[float]
    heading: Optional[float]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationEventCreate(BaseModel):
    type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    user_id: Optional[str]
    sos_alert_id: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    metadata_json: Optional[str]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True