"""
AI Analytics and reporting routes
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from app.database import get_db
from app.models import User
from app.schemas import AnalyticsQuery, AnalyticsResponse
from app.services import analytics as analytics_service
from app.routes.users import get_current_user, get_current_admin

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/query", response_model=AnalyticsResponse)
async def query_analytics(
    query: AnalyticsQuery,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Process natural language question about location data
    Uses AI to analyze location history and generate insights
    """
    
    try:
        analysis = analytics_service.generate_ai_analysis(
            db,
            user.id,
            query.question,
            query.date_from,
            query.date_to
        )
        return analysis
    except Exception as e:
        logger.error(f"Error generating analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate analytics"
        )

@router.get("/travel-summary")
async def get_travel_summary(
    days: int = Query(7, ge=1, le=365),
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive travel summary for the past N days"""
    target_id = user_id or current_user.id
    if target_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view other users' analytics")

    try:
        summary = analytics_service.get_travel_summary(db, target_id, days)
        return summary
    except Exception as e:
        logger.error(f"Error generating travel summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate travel summary"
        )

@router.get("/insights")
async def get_insights(
    days: int = Query(7, ge=1, le=365),
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get AI-generated insights about location data
    Includes patterns, trends, and recommendations
    """
    target_id = user_id or current_user.id
    if target_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view other users' insights")

    try:
        insights = analytics_service.get_ai_insights(db, target_id, days)
        return insights
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate insights"
        )


@router.get("/admin-overview")
async def get_admin_overview(
    days: int = Query(7, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Get admin-wide dashboard cards and AI signals."""
    try:
        return analytics_service.get_admin_overview(db, days)
    except Exception as e:
        logger.error(f"Error generating admin overview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate admin overview",
        )
