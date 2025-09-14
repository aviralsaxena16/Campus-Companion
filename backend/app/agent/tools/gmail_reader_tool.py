import base64
import json
from typing import Type
from googleapiclient.discovery import build
from langchain.tools import BaseTool
from pydantic import BaseModel, Field

from app.services.google_auth import get_user_credentials

class GmailInput(BaseModel):
    user_email: str = Field(description="The email of the user whose inbox should be read.")
    query: str = Field(description="Optional search query to filter emails (e.g., 'from:professor@university.edu'). Defaults to fetching recent emails.", default="in:inbox")

class GmailReaderTool(BaseTool):
    name: str = "read_gmail"
    description: str = "Reads recent emails from a user's Gmail inbox based on a query. Returns a structured list of emails including their ID, sender, subject, and a snippet of the body."
    args_schema: Type[GmailInput] = GmailInput

    async def _arun(self, user_email: str, query: str = "in:inbox"):
        """Async version of Gmail reading"""
        try:
            print(f"[DEBUG] Reading Gmail for {user_email} with query: {query}")  # Added debug logging
            
            credentials = get_user_credentials(user_email)
            service = build("gmail", "v1", credentials=credentials)

            results = service.users().messages().list(userId='me', q=query, maxResults=5).execute()
            messages = results.get('messages', [])

            if not messages:
                return "No emails found matching the query."

            email_details = []
            for message_info in messages:
                msg = service.users().messages().get(userId='me', id=message_info['id'], format='full').execute()
                payload = msg.get('payload', {})
                headers = payload.get('headers', [])
                
                subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
                sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown Sender')
                
                body_data = ""
                if 'parts' in payload:
                    for part in payload['parts']:
                        if part['mimeType'] == 'text/plain':
                            body_data = part['body'].get('data', '')
                            break
                elif 'body' in payload:
                     body_data = payload['body'].get('data', '')
                
                try:
                    body = base64.urlsafe_b64decode(body_data + '===').decode('utf-8') if body_data else msg.get('snippet', '')
                except Exception:
                    body = msg.get('snippet', '')

                email_details.append({
                    "id": msg['id'],
                    "from": sender,
                    "subject": subject,
                    "body_snippet": body[:1000]  # Increased snippet length
                })
            
            formatted_emails = "\n\n".join([
                f"Email {i+1}:\nFrom: {email['from']}\nSubject: {email['subject']}\nContent: {email['body_snippet']}"
                for i, email in enumerate(email_details)
            ])
            
            print(f"[DEBUG] Found {len(email_details)} emails")  # Added debug logging
            return formatted_emails
            
        except Exception as e:
            error_message = f"An error occurred while reading emails: {e}"
            print(f"[DEBUG] {error_message}")  # Added debug logging
            return error_message

    def _run(self, user_email: str, query: str = "in:inbox"):
        """Sync version of Gmail reading"""
        try:
            print(f"[DEBUG] Reading Gmail (sync) for {user_email} with query: {query}")  # Added debug logging
            
            credentials = get_user_credentials(user_email)
            service = build("gmail", "v1", credentials=credentials)

            results = service.users().messages().list(userId='me', q=query, maxResults=5).execute()
            messages = results.get('messages', [])

            if not messages:
                return "No emails found matching the query."

            email_details = []
            for message_info in messages:
                msg = service.users().messages().get(userId='me', id=message_info['id'], format='full').execute()
                payload = msg.get('payload', {})
                headers = payload.get('headers', [])
                
                subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
                sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown Sender')
                
                body_data = ""
                if 'parts' in payload:
                    for part in payload['parts']:
                        if part['mimeType'] == 'text/plain':
                            body_data = part['body'].get('data', '')
                            break
                elif 'body' in payload:
                     body_data = payload['body'].get('data', '')
                
                try:
                    body = base64.urlsafe_b64decode(body_data + '===').decode('utf-8') if body_data else msg.get('snippet', '')
                except Exception:
                    body = msg.get('snippet', '')

                email_details.append({
                    "id": msg['id'],
                    "from": sender,
                    "subject": subject,
                    "body_snippet": body[:1000]  # Increased snippet length
                })
            
            formatted_emails = "\n\n".join([
                f"Email {i+1}:\nFrom: {email['from']}\nSubject: {email['subject']}\nContent: {email['body_snippet']}"
                for i, email in enumerate(email_details)
            ])
            
            print(f"[DEBUG] Found {len(email_details)} emails")  # Added debug logging
            return formatted_emails
            
        except Exception as e:
            error_message = f"An error occurred while reading emails: {e}"
            print(f"[DEBUG] {error_message}")  # Added debug logging
            return error_message
