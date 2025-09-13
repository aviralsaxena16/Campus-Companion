# In backend/app/agent/tools/calendar_tool.py
from typing import Type
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from langchain.tools import BaseTool
from pydantic import BaseModel, Field

from app.services.google_auth import get_user_credentials

class EventInput(BaseModel):
    title: str = Field(description="The title of the event.")
    start_time: str = Field(description="The start date and time in ISO 8601 format (e.g., '2025-09-12T16:00:00').")
    end_time: str = Field(description="The end date and time in ISO 8601 format (e.g., '2025-09-12T17:00:00').")
    location: str = Field(description="The location of the event.")
    description: str = Field(description="A brief description of the event.")
    user_email: str = Field(description="The email of the user to schedule the event for.")

class CreateCalendarEventTool(BaseTool):
    name: str = "create_calendar_event"
    description: str = "Creates a new event in a specific user's Google Calendar."
    args_schema: Type[EventInput] = EventInput

    def _run(self, title: str, start_time: str, end_time: str, location: str, description: str, user_email: str):
        try:
            credentials = get_user_credentials(user_email)
            service = build("calendar", "v3", credentials=credentials)
            
            event = {
                'summary': title, 'location': location, 'description': description,
                'start': {'dateTime': start_time, 'timeZone': 'Asia/Kolkata'},
                'end': {'dateTime': end_time, 'timeZone': 'Asia/Kolkata'},
            }
            created_event = service.events().insert(calendarId='primary', body=event).execute()
            return f"Event created successfully for {user_email}! View it here: {created_event.get('htmlLink')}"
        except Exception as e:
            return f"An error occurred while creating the calendar event: {e}"