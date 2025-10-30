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
    """
    Gets credentials for a background task (scheduler) using the
    refresh token stored in the database.
    """
    db: Session = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        
        if not user or not user.google_refresh_token:
            raise Exception(f"User '{user_email}' has no refresh token in the database.")

        # --- THIS IS THE UPDATED LOGIC ---
        # Reconstruct the credentials object from the stored refresh token
        # It uses the WEB client IDs, not the old desktop ones.
        creds_info = {
            "token": None, # Access token will be fetched
            "refresh_token": user.google_refresh_token,
            "token_uri": "https://oauth2.googleapis.com/token",
            
            # Use the same client ID as the frontend
            "client_id": os.getenv("GOOGLE_AUDIENCE_CLIENT_ID"), 
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "scopes": SCOPES,
        }
        
        creds = Credentials.from_authorized_user_info(creds_info, SCOPES)
        
        # We must refresh the token to get a new access token
        if creds.expired and creds.refresh_token:
            creds.refresh(None) # Pass None for the httpx request
        
        return creds
        
    finally:
        db.close()