from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

# --- UPDATED IMPORTS ---
from app.schemas.user import ImportantUpdateResponse # Keep this
# REMOVED: ConnectAccountRequest
from app import models
from app.database import SessionLocal
from app.services.scheduler_service import start_scheduler_for_user, run_email_summary_for_user
# --- NEW AUTH IMPORT ---
from app.core.security import get_current_user, VerifiedUser

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/updates/schedule", status_code=200)
def schedule_updates(
    # This endpoint is now protected and gets the user from the token
    user: VerifiedUser = Depends(get_current_user)
):
    """
    Schedules the daily email scan for the authenticated user.
    """
    # We use the verified email from the token
    start_scheduler_for_user(user.email)
    return {"message": f"Daily email scanning has been scheduled for {user.email}."}

@router.get("/updates", response_model=List[ImportantUpdateResponse])
def get_updates(
    # This endpoint is now protected and gets the user from the token
    user: VerifiedUser = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Fetches the latest important updates for the authenticated user.
    """
    # 1. Find the user in our database via their verified email
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    
    if not db_user:
        # If user doesn't exist in DB yet, they have no updates
        return []

    # 2. Fetch updates linked to this user's database ID
    updates = db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.user_id == db_user.id)\
                .order_by(models.ImportantUpdate.discovered_at.desc())\
                .limit(20)\
                .all()
    
    return updates

@router.post("/updates/scan_now", response_model=List[ImportantUpdateResponse])
def scan_now(
    # This endpoint is also protected
    user: VerifiedUser = Depends(get_current_user)
):
    """
    Triggers an immediate email scan for the authenticated user.
    """
    # We use the verified email from the token
    all_updates = run_email_summary_for_user(user.email)
    return all_updates