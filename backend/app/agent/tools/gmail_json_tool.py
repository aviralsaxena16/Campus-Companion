# In backend/app/agent/tools/gmail_json_tool.py
import base64
import json
from googleapiclient.discovery import build

from app.services.google_auth import get_user_credentials

class GmailJsonTool:
    """
    This is not a LangChain tool. It's a dedicated service utility for backend processes
    to fetch raw email data as JSON.
    """
    def __init__(self, user_email: str):
        self.user_email = user_email

    def run(self, query: str = "is:unread in:inbox category:primary"):
        try:
            credentials = get_user_credentials(self.user_email)
            service = build("gmail", "v1", credentials=credentials)
            results = service.users().messages().list(userId='me', q=query, maxResults=5).execute()
            messages = results.get('messages', [])

            if not messages:
                return json.dumps([])

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
                    "id": msg['id'], "from": sender, "subject": subject, "body_snippet": body[:500]
                })
            
            return json.dumps(email_details)
        except Exception as e:
            print(f"[GmailJsonTool Error]: {e}")
            return json.dumps([])