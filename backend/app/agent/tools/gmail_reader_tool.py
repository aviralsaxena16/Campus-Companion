# In backend/app/agent/tools/gmail_reader_tool.py
from typing import Type
from googleapiclient.discovery import build
from langchain.tools import BaseTool
from pydantic import BaseModel, Field

from app.services.google_auth import get_user_credentials

class GmailInput(BaseModel):
    user_email: str = Field(description="The email of the user whose inbox should be read.")

class GmailReaderTool(BaseTool):
    name: str = "read_gmail"
    description: str = "Reads the 5 most recent emails from a user's Gmail inbox. Only use this when explicitly asked by the user to check their email."
    args_schema: Type[GmailInput] = GmailInput

    def _run(self, user_email: str):
        try:
            credentials = get_user_credentials(user_email)
            service = build("gmail", "v1", credentials=credentials)

            # Get the list of most recent messages
            results = service.users().messages().list(userId='me', maxResults=5).execute()
            messages = results.get('messages', [])

            if not messages:
                return "No recent emails found."

            email_summaries = []
            for message_info in messages:
                msg = service.users().messages().get(userId='me', id=message_info['id']).execute()
                payload = msg.get('payload', {})
                headers = payload.get('headers', [])
                
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
                snippet = msg.get('snippet', 'No snippet available.')

                email_summaries.append(f"From: {sender}\nSubject: {subject}\nSnippet: {snippet}\n---")
            
            return "\n".join(email_summaries)
        except Exception as e:
            return f"An error occurred while reading emails: {e}"