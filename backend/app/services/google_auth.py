import os
import json
from google.oauth2.credentials import Credentials
from sqlalchemy.orm import Session
from app import models
from app.database import SessionLocal

# --- THIS IMPORT IS THE KEY FIX ---
from google.auth.transport import requests

# --- THIS IS THE SCOPE FIX ---
# Updated to match the exact scopes requested by the frontend AuthContext
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.readonly"
]
# --- END OF SCOPE FIX ---

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

        creds_info = {
            "token": None, # Access token will be fetched
            "refresh_token": user.google_refresh_token,
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_id": os.getenv("GOOGLE_AUDIENCE_CLIENT_ID"), 
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "scopes": SCOPES,
        }
        
        creds = Credentials.from_authorized_user_info(creds_info, SCOPES)
        
        # We must refresh the token to get a new access token
        if creds.expired and creds.refresh_token:
            # --- THIS IS THE FIX ---
            # We must pass a transport request object to the refresh() method.
            creds.refresh(requests.Request())
            # --- END OF FIX ---
        
        return creds
        
    finally:
        db.close()

