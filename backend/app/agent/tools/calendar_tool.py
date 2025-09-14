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
    description: str = "Creates a new event in a specific user's Google Calendar with the provided event details."
    args_schema: Type[EventInput] = EventInput

    async def _arun(self, title: str, start_time: str, end_time: str, location: str, description: str, user_email: str):
        """Async version of the calendar event creation"""
        try:
            print(f"[DEBUG] Creating calendar event: {title} for {user_email}")  # Added debug logging
            
            credentials = get_user_credentials(user_email)
            service = build("calendar", "v3", credentials=credentials)
            
            if not start_time.endswith('Z') and '+' not in start_time and 'T' in start_time:
                start_time = start_time + '+05:30'  # Add IST timezone
            if not end_time.endswith('Z') and '+' not in end_time and 'T' in end_time:
                end_time = end_time + '+05:30'  # Add IST timezone
            
            event = {
                'summary': title,
                'location': location,
                'description': description,
                'start': {
                    'dateTime': start_time,
                    'timeZone': 'Asia/Kolkata'
                },
                'end': {
                    'dateTime': end_time,
                    'timeZone': 'Asia/Kolkata'
                },
            }
            
            print(f"[DEBUG] Event object: {event}")  # Added debug logging
            
            created_event = service.events().insert(calendarId='primary', body=event).execute()
            
            success_message = f"✅ SUCCESS: Event '{title}' has been created in your Google Calendar for {start_time}! You can view it at: {created_event.get('htmlLink', 'your calendar')}"
            print(f"[DEBUG] {success_message}")  # Added debug logging
            return success_message
            
        except HttpError as error:
            error_message = f"❌ Google Calendar API error: {error}"
            print(f"[DEBUG] {error_message}")  # Added debug logging
            return error_message
        except Exception as e:
            error_message = f"❌ An error occurred while creating the calendar event: {str(e)}"
            print(f"[DEBUG] {error_message}")  # Added debug logging
            return error_message

    def _run(self, title: str, start_time: str, end_time: str, location: str, description: str, user_email: str):
        """Synchronous version - should not be used in async context"""
        try:
            print(f"[DEBUG] Creating calendar event (sync): {title} for {user_email}")  # Added debug logging
            
            credentials = get_user_credentials(user_email)
            service = build("calendar", "v3", credentials=credentials)
            
            if not start_time.endswith('Z') and '+' not in start_time and 'T' in start_time:
                start_time = start_time + '+05:30'  # Add IST timezone
            if not end_time.endswith('Z') and '+' not in end_time and 'T' in end_time:
                end_time = end_time + '+05:30'  # Add IST timezone
            
            event = {
                'summary': title,
                'location': location,
                'description': description,
                'start': {
                    'dateTime': start_time,
                    'timeZone': 'Asia/Kolkata'
                },
                'end': {
                    'dateTime': end_time,
                    'timeZone': 'Asia/Kolkata'
                },
            }
            
            created_event = service.events().insert(calendarId='primary', body=event).execute()
            
            success_message = f"✅ SUCCESS: Event '{title}' has been created in your Google Calendar for {start_time}! You can view it at: {created_event.get('htmlLink', 'your calendar')}"
            print(f"[DEBUG] {success_message}")  # Added debug logging
            return success_message
            
        except HttpError as error:
            error_message = f"❌ Google Calendar API error: {error}"
            print(f"[DEBUG] {error_message}")  # Added debug logging
            return error_message
        except Exception as e:
            error_message = f"❌ An error occurred while creating the calendar event: {str(e)}"
            print(f"[DEBUG] {error_message}")  # Added debug logging
            return error_message
