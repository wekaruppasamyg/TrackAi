"""
Authentication service for user management and JWT token handling
"""

import logging
import hashlib
import random
import string
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.models import User
from app.config import (
    JWT_SECRET_KEY, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES,
    BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, OTP_EXPIRE_MINUTES,
)
from app.schemas import UserCreate

logger = logging.getLogger(__name__)

# ── In-memory OTP store ───────────────────────────────────────────────────────
# { email: { otp: str, expires_at: datetime, verified: bool } }
# For production with multiple workers, replace with Redis.
_otp_store: dict = {}


# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id if user_id else None
    except JWTError:
        return None


# ── User CRUD ─────────────────────────────────────────────────────────────────

def create_user(db: Session, user_data: UserCreate) -> User:
    existing = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    if existing:
        raise ValueError("Username or email already exists")

    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"User created: {user.username}")
    return user

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = get_user_by_username(db, username)
    if not user:
        logger.warning(f"Auth failed: '{username}' not found")
        return None
    if not verify_password(password, user.hashed_password):
        logger.warning(f"Auth failed: Password mismatch for '{username}'")
        return None
    return user


# ── OTP helpers ───────────────────────────────────────────────────────────────

def generate_otp() -> str:
    """Return a 6-digit numeric OTP."""
    return ''.join(random.choices(string.digits, k=6))

def store_otp(email: str, otp: str) -> None:
    """Store OTP with expiry. Overwrites any existing entry for this email."""
    _otp_store[email.lower()] = {
        "otp":        otp,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES),
        "verified":   False,
        "attempts":   0,
    }
    logger.info(f"OTP stored for {email} (expires in {OTP_EXPIRE_MINUTES} min)")

def verify_otp(email: str, otp: str) -> tuple[bool, str]:
    """
    Returns (success, message).
    On success also marks the entry as verified so the reset endpoint
    can check that the OTP step was actually completed.
    """
    key = email.lower()
    entry = _otp_store.get(key)

    if not entry:
        return False, "No OTP found for this email. Please request a new one."

    if datetime.now(timezone.utc) > entry["expires_at"]:
        _otp_store.pop(key, None)
        return False, "OTP has expired. Please request a new one."

    entry["attempts"] += 1
    if entry["attempts"] > 5:
        _otp_store.pop(key, None)
        return False, "Too many incorrect attempts. Please request a new OTP."

    if entry["otp"] != otp.strip():
        remaining = 5 - entry["attempts"]
        return False, f"Incorrect OTP. {remaining} attempt(s) remaining."

    # Mark verified — the reset endpoint checks this flag
    entry["verified"] = True
    return True, "OTP verified successfully."

def is_otp_verified(email: str) -> bool:
    """Check that the OTP for this email was verified before allowing password reset."""
    entry = _otp_store.get(email.lower())
    if not entry:
        return False
    if datetime.now(timezone.utc) > entry["expires_at"]:
        return False
    return entry.get("verified", False)

def clear_otp(email: str) -> None:
    """Remove OTP entry after password reset completes."""
    _otp_store.pop(email.lower(), None)


# ── Brevo email sender ────────────────────────────────────────────────────────

async def send_otp_email(to_email: str, to_name: str, otp: str) -> bool:
    """
    Send OTP via Brevo Transactional Email API v3.
    Returns True on success, False on failure.
    """
    if not BREVO_API_KEY:
        logger.warning("BREVO_API_KEY not set — OTP email skipped. OTP: %s", otp)
        return False

    html_body = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                max-width:480px;margin:0 auto;padding:32px 24px;
                background:#0f0f14;border-radius:16px;color:#e5e5e5;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;
                      background:rgba(252,128,25,0.15);border:1px solid rgba(252,128,25,0.4);
                      display:flex;align-items:center;justify-content:center;font-size:18px;">📍</div>
          <span style="font-size:20px;font-weight:800;color:#fff;">TrackAI</span>
        </div>
      </div>

      <h2 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 8px;text-align:center;">
        Password Reset OTP
      </h2>
      <p style="color:rgba(255,255,255,0.5);text-align:center;margin:0 0 28px;font-size:14px;">
        Hi {to_name or to_email.split('@')[0]}, use the code below to reset your password.
      </p>

      <div style="background:rgba(252,128,25,0.1);border:1px solid rgba(252,128,25,0.3);
                  border-radius:14px;padding:24px;text-align:center;margin-bottom:24px;">
        <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#fc8019;
                    text-shadow:0 0 20px rgba(252,128,25,0.5);font-variant-numeric:tabular-nums;">
          {otp}
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:10px;">
          Valid for {OTP_EXPIRE_MINUTES} minutes · Do not share this code
        </div>
      </div>

      <p style="font-size:12px;color:rgba(255,255,255,0.25);text-align:center;margin:0;">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
    """

    payload = {
        "sender":      {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to":          [{"email": to_email, "name": to_name or ""}],
        "subject":     f"Your TrackAI OTP: {otp}",
        "htmlContent": html_body,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                json=payload,
                headers={
                    "api-key":      BREVO_API_KEY,
                    "Content-Type": "application/json",
                    "Accept":       "application/json",
                },
            )
        if resp.status_code in (200, 201):
            logger.info("OTP email sent to %s via Brevo", to_email)
            return True
        else:
            logger.error("Brevo send failed: %s %s", resp.status_code, resp.text)
            return False
    except Exception as e:
        logger.error("Brevo request error: %s", e)
        return False


# ── Password reset ────────────────────────────────────────────────────────────

def reset_password(db: Session, email: str, new_password: str) -> bool:
    """Update hashed_password for the user with this email."""
    user = get_user_by_email(db, email)
    if not user:
        return False
    if len(new_password) < 8:
        raise ValueError("Password must be at least 8 characters")
    user.hashed_password = hash_password(new_password)
    db.add(user)
    db.commit()
    logger.info("Password reset for %s", email)
    return True