# In backend/app/services/google_auth.py
import os
import json
from google.oauth2.credentials import Credentials
from sqlalchemy.orm import Session
from app import models
from app.database import SessionLocal

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.readonly"
]

def get_user_credentials(user_email: str) -> Credentials:
    """Gets a credentials object for a specific user from the database."""
    db: Session = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if not user or not user.calendar_connected or not user.google_access_token:
            raise Exception(f"User '{user_email}' has not connected their Google Account or token is missing.")

        # Reconstruct the credentials object from stored tokens
        creds_info = {
            "token": user.google_access_token,
            "refresh_token": user.google_refresh_token,
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_id": os.getenv("GOOGLE_CLIENT_ID_DESKTOP"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET_DESKTOP"),
            "scopes": SCOPES,
        }
        return Credentials.from_authorized_user_info(creds_info, SCOPES)
    finally:
        db.close()