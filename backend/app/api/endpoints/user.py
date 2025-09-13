# In backend/app/api/endpoints/user.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app import models
# CORRECTED IMPORT: We now import the specific classes from the user schema file
from app.schemas.user import UserCreate, UserResponse
from app.database import SessionLocal
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
import os
router = APIRouter()

# Dependency to get a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# The function now uses the directly imported schema classes
@router.post("/users/login", response_model=UserResponse)
def get_or_create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        return db_user
    # If not, create a new user
    new_user = models.User(email=user.email)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/users/connect_calendar")
def connect_calendar(user_email: str, db: Session = Depends(get_db)):
    # This is a simplified flow for the prototype. In production, this would be a full OAuth redirect flow.
    # This will trigger the browser pop-up on the server side where you are running the backend.
    SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
    CREDENTIALS_FILE = 'credentials.json'

    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
    creds = flow.run_local_server(port=0)

    db_user = db.query(models.User).filter(models.User.email == user_email).first()
    if db_user:
        db_user.google_access_token = creds.token
        db_user.google_refresh_token = creds.refresh_token
        db_user.calendar_connected = True
        db.commit()
        return {"message": "Calendar connected successfully"}
    raise HTTPException(status_code=404, detail="User not found")