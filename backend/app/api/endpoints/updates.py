from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
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
    """
    Schedule daily automatic email scanning for the authenticated user
    """
    start_scheduler_for_user(user.email)
    return {"message": f"Daily email scanning scheduled for {user.email}"}

@router.get("/updates", response_model=List[ImportantUpdateResponse])
def get_updates(
    user: VerifiedUser = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Get all important updates for the authenticated user
    """
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user:
        return []
    
    updates = db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.user_id == db_user.id)\
                .filter(models.ImportantUpdate.is_important == True)\
                .order_by(models.ImportantUpdate.discovered_at.desc())\
                .limit(50)\
                .all()
    
    print(f"[API] Returning {len(updates)} updates for {user.email}")
    return updates

@router.post("/updates/scan_now", status_code=202)
def scan_now(
    background_tasks: BackgroundTasks,
    user: VerifiedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers an immediate email scan in the background.
    Returns 202 Accepted immediately while scan runs async.
    """
    print(f"[API] ⚡ Scan triggered for {user.email}")
    
    # Verify user exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not db_user.google_refresh_token:
        raise HTTPException(status_code=400, detail="Google account not connected")
    
    # Add the scan task to background
    background_tasks.add_task(run_email_summary_for_user, user.email)
    
    return {
        "message": "Email scan started in background",
        "status": "processing",
        "user": user.email
    }

@router.post("/updates/feedback", status_code=200)
def log_feedback(
    request: FeedbackRequest,
    user: VerifiedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Log user feedback for active learning.
    If feedback is negative (incorrect classification), hide the update.
    """
    # Verify user
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get the update and verify ownership
    update = db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.id == request.update_id)\
                .filter(models.ImportantUpdate.user_id == db_user.id)\
                .first()
    
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")
    
    # Extract label from title
    label = "UNKNOWN"
    if update.title.startswith("[") and "]" in update.title:
        label = update.title.split("]")[0][1:]
    
    # Log the feedback
    feedback_type = "✓ CORRECT" if request.is_correct else "✗ INCORRECT"
    print(f"[FEEDBACK] {feedback_type} - User: {user.email}, Label: {label}, ID: {request.update_id}")
    print(f"[FEEDBACK] Title: {update.title}")
    
    # If incorrect, mark as not important (hide from UI)
    if not request.is_correct:
        update.is_important = False
        db.commit()
        print(f"[FEEDBACK] Update marked as not important and hidden")
    
    # TODO: Store feedback in separate table for retraining
    # feedback = models.Feedback(
    #     update_id=update.id,
    #     user_id=db_user.id,
    #     is_correct=request.is_correct,
    #     predicted_label=label
    # )
    # db.add(feedback)
    # db.commit()
    
    return {
        "message": "Feedback recorded",
        "update_id": request.update_id,
        "is_correct": request.is_correct,
        "action": "hidden" if not request.is_correct else "kept"
    }

@router.delete("/updates/{update_id}", status_code=200)
def delete_update(
    update_id: int,
    user: VerifiedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete/hide a specific update
    """
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update = db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.id == update_id)\
                .filter(models.ImportantUpdate.user_id == db_user.id)\
                .first()
    
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")
    
    update.is_important = False
    db.commit()
    
    return {"message": "Update hidden successfully"}