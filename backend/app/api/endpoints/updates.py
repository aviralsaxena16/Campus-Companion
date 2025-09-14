# In backend/app/api/endpoints/updates.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.schemas.user import ConnectAccountRequest, ImportantUpdateResponse
from app import models, schemas
from app.database import SessionLocal
from app.services.scheduler_service import start_scheduler_for_user
from app.services.scheduler_service import start_scheduler_for_user, run_email_summary_for_user
router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/updates/schedule")
def schedule_updates(request: schemas.ConnectAccountRequest, db: Session = Depends(get_db)):
    start_scheduler_for_user(request.user_email)
    return {"message": f"Daily email scanning has been scheduled for {request.user_email}."}

@router.get("/updates/{user_email}", response_model=List[schemas.ImportantUpdateResponse]) # We'll need to create this schema
def get_updates(user_email: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_email).first()
    if not user:
        return []
    updates = db.query(models.ImportantUpdate).filter(models.ImportantUpdate.user_id == user.id).order_by(models.ImportantUpdate.discovered_at.desc()).all()
    return updates

@router.post("/updates/scan_now", response_model=List[ImportantUpdateResponse])
def scan_now(request: ConnectAccountRequest, db: Session = Depends(get_db)):
    # This calls the core logic immediately
    all_updates = run_email_summary_for_user(request.user_email)
    return all_updates