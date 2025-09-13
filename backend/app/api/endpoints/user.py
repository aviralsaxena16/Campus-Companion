# In backend/app/api/endpoints/user.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import InstalledAppFlow

from app import models
# Import the new schema
from app.schemas.user import UserCreate, UserResponse, ConnectAccountRequest
from app.database import SessionLocal

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/users/login", response_model=UserResponse)
def get_or_create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        return db_user
    new_user = models.User(email=user.email)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# THIS FUNCTION IS NOW CORRECTED
@router.post("/users/connect_google_account")
def connect_google_account(request: ConnectAccountRequest, db: Session = Depends(get_db)):
    SCOPES = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/gmail.readonly"
    ]
    CREDENTIALS_FILE = 'credentials.json'

    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
    creds = flow.run_local_server(port=0)

    # Access the email via request.user_email
    db_user = db.query(models.User).filter(models.User.email == request.user_email).first()
    if db_user:
        db_user.google_access_token = creds.token
        db_user.google_refresh_token = creds.refresh_token
        db_user.calendar_connected = True
        db.commit()
        return {"message": "Google Account connected successfully"}
    raise HTTPException(status_code=404, detail="User not found")