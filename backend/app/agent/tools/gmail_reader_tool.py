# In backend/app/agent/tools/gmail_reader_tool.py
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

    def _run(self, user_email: str, query: str = "in:inbox"):
        try:
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
                
                body = base64.urlsafe_b64decode(body_data).decode('utf-8') if body_data else msg.get('snippet', '')

                email_details.append({
                    "id": msg['id'],
                    "from": sender,
                    "subject": subject,
                    "body_snippet": body[:500]
                })
            
            return json.dumps(email_details)
        except Exception as e:
            return f"An error occurred while reading emails: {e}"