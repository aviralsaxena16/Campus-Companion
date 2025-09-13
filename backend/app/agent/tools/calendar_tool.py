# In backend/app/agent/tools/calendar_tool.py

import os
import json
from typing import Type

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from langchain.tools import BaseTool
from pydantic import BaseModel, Field

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
CREDENTIALS_FILE = 'credentials.json' # Looks for the file in the backend/ folder
TOKEN_FILE = 'token.json'

def get_calendar_service():
    """Gets an authenticated Google Calendar service instance."""
    creds = None
    
    # Deployment logic
    creds_json_str = os.getenv('GOOGLE_CREDENTIALS_JSON')
    token_json_str = os.getenv('GOOGLE_TOKEN_JSON')
    if creds_json_str and token_json_str:
        creds_info = json.loads(creds_json_str)
        token_info = json.loads(token_json_str)
        creds = Credentials.from_authorized_user_info(token_info, SCOPES)
    # Local development logic
    else:
        if os.path.exists(TOKEN_FILE):
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                # IMPORTANT: This requires a 'credentials.json' from a "Desktop app" credential
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
                creds = flow.run_local_server(port=0)
            
            with open(TOKEN_FILE, "w") as token:
                token.write(creds.to_json())
                
    return build("calendar", "v3", credentials=creds)

class EventInput(BaseModel):
    title: str = Field(description="The title of the event.")
    start_time: str = Field(description="The start date and time in ISO 8601 format (e.g., '2025-09-12T16:00:00').")
    end_time: str = Field(description="The end date and time in ISO 8601 format (e.g., '2025-09-12T17:00:00').")
    location: str = Field(description="The location of the event.")
    description: str = Field(description="A brief description of the event.")

class CreateCalendarEventTool(BaseTool):
    name: str = "create_calendar_event"
    description: str = "Useful for creating a new event in a user's Google Calendar."
    args_schema: Type[BaseModel] = EventInput

    def _run(self, title: str, start_time: str, end_time: str, location: str, description: str):
        try:
            service = get_calendar_service()
            event = {
                'summary': title, 'location': location, 'description': description,
                'start': {'dateTime': start_time, 'timeZone': 'Asia/Kolkata'},
                'end': {'dateTime': end_time, 'timeZone': 'Asia/Kolkata'},
            }
            event = service.events().insert(calendarId='primary', body=event).execute()
            return f"Event created successfully! View it here: {event.get('htmlLink')}"
        except Exception as e:
            return f"An unexpected error occurred: {e}"