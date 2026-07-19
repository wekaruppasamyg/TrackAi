"""
User authentication and management routes
"""

import logging
from google.oauth2 import id_token
from google.auth.transport import requests
from pydantic import BaseModel, EmailStr
import os
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.schemas import UserCreate, UserLogin, UserResponse, Token
from app.services import auth
from app.models import User, Location

logger = logging.getLogger(__name__)
router = APIRouter()


def get_current_user(
    authorization: str = Header(None),
    token: str = Query(None),
    db: Session = Depends(get_db)
) -> User:
    resolved_token = None
    if authorization and authorization.startswith("Bearer "):
        resolved_token = authorization.split(" ", 1)[1].strip()
    if not resolved_token and token:
        resolved_token = token
    if not resolved_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = auth.verify_token(resolved_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


class GoogleLoginRequest(BaseModel):
    credential: str

ADMIN_EMAILS = {"wekaruppasamyg23@gmail.com"}


# ── Existing routes ───────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    try:
        user = auth.create_user(db, user_data)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Registration failed: {str(e)}")


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    logger.info(f"Login attempt: {credentials.username}")
    db_user = db.query(User).filter(User.username == credentials.username).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    user = auth.authenticate_user(db, credentials.username, credentials.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access_token = auth.create_access_token(data={"sub": user.id}, expires_delta=timedelta(hours=24))
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id}


@router.post("/google-login")
async def google_login(data: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        info = id_token.verify_oauth2_token(data.credential, requests.Request(), os.getenv("GOOGLE_CLIENT_ID"))
        email = info["email"]
        name  = info.get("name", "")
        user  = db.query(User).filter(User.email == email).first()
        is_admin_email = email.lower() in ADMIN_EMAILS
        if not user:
            user = User(username=email.split("@")[0], email=email, full_name=name,
                        hashed_password="GOOGLE_LOGIN", is_admin=is_admin_email)
            db.add(user); db.commit(); db.refresh(user)
        elif is_admin_email and not user.is_admin:
            user.is_admin = True; db.add(user); db.commit(); db.refresh(user)
        access_token = auth.create_access_token(data={"sub": user.id}, expires_delta=timedelta(hours=24))
        return {"access_token": access_token, "token_type": "bearer", "user": user}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: User = Depends(get_current_user)):
    return user


@router.put("/me/consent")
async def update_consent(
    consent_given: bool = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user.is_consent_given = consent_given
    db.add(user); db.commit(); db.refresh(user)
    return {"user_id": user.id, "is_consent_given": user.is_consent_given, "message": f"Consent updated to {consent_given}"}


@router.get("/list", response_model=list[UserResponse])
async def list_users(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    users = db.query(User).filter(User.is_active == True).all()
    for user in users:
        last_loc = db.query(Location).filter(Location.user_id == user.id).order_by(Location.timestamp.desc()).first()
        user.last_location = last_loc
    return users


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own admin account")
    db.delete(user); db.commit()
    return None


# ══════════════════════════════════════════════════════════════════════════════
# PASSWORD RESET — 3 new endpoints
# ══════════════════════════════════════════════════════════════════════════════

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp:   str

class ResetPasswordRequest(BaseModel):
    email:        EmailStr
    otp:          str          # re-verify at reset time for extra safety
    new_password: str


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Step 1 — User submits their email.
    • Looks up the user.
    • Generates a 6-digit OTP.
    • Sends the OTP via Brevo API.
    Always returns 200 so we don't leak whether an email is registered.
    """
    user = auth.get_user_by_email(db, body.email)

    # Always respond 200 — don't reveal whether email exists
    if not user:
        logger.info("forgot-password: email not found (silent) — %s", body.email)
        return {"message": "If that email is registered, an OTP has been sent."}

    otp = auth.generate_otp()
    auth.store_otp(body.email, otp)

    sent = await auth.send_otp_email(
        to_email=body.email,
        to_name=user.full_name or user.username,
        otp=otp,
    )

    if not sent:
        # OTP was stored — user can retry; email failure is logged server-side
        logger.warning("OTP email failed for %s — check BREVO_API_KEY", body.email)
        raise HTTPException(
            status_code=500,
            detail="Failed to send OTP email. Please try again or check server logs."
        )

    return {"message": "If that email is registered, an OTP has been sent."}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOTPRequest):
    """
    Step 2 — User submits the 6-digit OTP from their email.
    Returns 200 on success so the frontend can advance to the new-password step.
    """
    success, message = auth.verify_otp(body.email, body.otp)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message, "verified": True}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Step 3 — User submits their new password.
    • Re-checks OTP was verified (not just guessed).
    • Updates hashed_password in DB.
    • Clears OTP from store.
    """
    # Safety: OTP must have been successfully verified in Step 2
    if not auth.is_otp_verified(body.email):
        raise HTTPException(
            status_code=400,
            detail="OTP not verified. Please complete the verification step first."
        )

    # Re-verify OTP at reset time to prevent replay
    success, message = auth.verify_otp(body.email, body.otp)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    try:
        ok = auth.reset_password(db, body.email, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not ok:
        raise HTTPException(status_code=404, detail="User not found")

    auth.clear_otp(body.email)
    return {"message": "Password reset successfully. You can now sign in."}