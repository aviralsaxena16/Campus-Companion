from fastapi import APIRouter, Depends, HTTPException,BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.schemas.user import ImportantUpdateResponse
from app import models
from app.database import SessionLocal
from app.services.scheduler_service import start_scheduler_for_user, run_email_summary_for_user
from app.core.security import get_current_user, VerifiedUser

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class FeedbackRequest(BaseModel):
    update_id: int
    is_correct: bool

@router.post("/updates/schedule", status_code=200)
def schedule_updates(
    user: VerifiedUser = Depends(get_current_user)
):
    start_scheduler_for_user(user.email)
    return {"message": f"Daily email scanning has been scheduled for {user.email}."}

@router.get("/updates", response_model=List[ImportantUpdateResponse])
def get_updates(
    user: VerifiedUser = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user:
        return []
    
    # Get updates marked as important, ordered by discovery time
    updates = db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.user_id == db_user.id)\
                .filter(models.ImportantUpdate.is_important == True)\
                .order_by(models.ImportantUpdate.discovered_at.desc())\
                .limit(50)\
                .all()
    return updates

@router.post("/updates/scan_now", status_code=202) # Return 202 Accepted
def scan_now(
    background_tasks: BackgroundTasks, # Inject background tasks
    user: VerifiedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers an immediate email scan in the background.
    """
    print(f"Adding background task: run_email_summary_for_user for {user.email}")
    # Add the slow function as a background task
    background_tasks.add_task(run_email_summary_for_user, user.email)
    
    # Return an immediate response
    return {"message": "Email scan started in the background."}

@router.post("/updates/feedback", status_code=200)
def log_feedback(
    request: FeedbackRequest,
    user: VerifiedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Log user feedback for active learning
    """
    # Verify the update belongs to this user
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update = db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.id == request.update_id)\
                .filter(models.ImportantUpdate.user_id == db_user.id)\
                .first()
    
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")
    
    # Log the feedback (you could save this to a feedback table)
    print(f"FEEDBACK: User {user.email} marked update ID {request.update_id} ('{update.title}') as Correct={request.is_correct}")
    
    # If incorrect, mark as not important so it doesn't show up again
    if not request.is_correct:
        update.is_important = False
        db.commit()
    
    return {"message": "Feedback recorded successfully"}