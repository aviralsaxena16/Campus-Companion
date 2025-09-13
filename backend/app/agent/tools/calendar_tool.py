# In backend/app/agent/tools/calendar_tool.py
import os
import json
from typing import Type

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from langchain.tools import BaseTool
from pydantic import BaseModel, Field

from app import models
from app.database import SessionLocal

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

def get_calendar_service_for_user(user_email: str):
    """
    Gets an authenticated Google Calendar service for a SPECIFIC user
    by fetching their token from the database.
    """
    db: Session = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if not user or not user.calendar_connected or not user.google_access_token:
            raise Exception("User has not connected their Google Calendar.")

        # Reconstruct the credentials object from stored tokens
        creds_info = {
            "token": user.google_access_token,
            "refresh_token": user.google_refresh_token,
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_id": os.getenv("GOOGLE_CLIENT_ID_DESKTOP"), # You'll need to add this to .env
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET_DESKTOP"), # And this
            "scopes": SCOPES,
        }
        creds = Credentials.from_authorized_user_info(creds_info, SCOPES)
        return build("calendar", "v3", credentials=creds)
    finally:
        db.close()

class EventInput(BaseModel):
    title: str = Field(description="The title of the event.")
    start_time: str = Field(description="The start date and time in ISO 8601 format.")
    end_time: str = Field(description="The end date and time in ISO 8601 format.")
    location: str = Field(description="The location of the event.")
    description: str = Field(description="A brief description of the event.")
    user_email: str = Field(description="The email of the user to schedule the event for.")

class CreateCalendarEventTool(BaseTool):
    name: str = "create_calendar_event"
    description: str = "Creates a new event in a specific user's Google Calendar."
    args_schema: Type[EventInput] = EventInput

    def _run(self, title: str, start_time: str, end_time: str, location: str, description: str, user_email: str):
        try:
            service = get_calendar_service_for_user(user_email)
            event = {
                'summary': title, 'location': location, 'description': description,
                'start': {'dateTime': start_time, 'timeZone': 'Asia/Kolkata'},
                'end': {'dateTime': end_time, 'timeZone': 'Asia/Kolkata'},
            }
            event = service.events().insert(calendarId='primary', body=event).execute()
            return f"Event created successfully for {user_email}! View it here: {event.get('htmlLink')}"
        except Exception as e:
            return f"An error occurred: {e}"