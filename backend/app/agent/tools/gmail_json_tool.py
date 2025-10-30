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
            if not credentials:
                 print(f"[GmailJsonTool Error]: Could not get credentials for {self.user_email}")
                 return json.dumps([])
                 
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
                
                # --- THIS IS THE ROBUST FIX ---
                # Recursively search for the text/plain part in case of nested
                # multipart/alternative or other complex structures.
                
                def find_plain_text_part(parts):
                    """Recursively find the text/plain part's data."""
                    if not parts:
                        return ""
                        
                    data = ""
                    for p in parts:
                        if p.get('mimeType') == 'text/plain':
                            body = p.get('body')
                            if body:
                                data = body.get('data', '')
                            return data
                        
                        # Recurse into multipart parts
                        if p.get('mimeType', '').startswith('multipart/'):
                            data = find_plain_text_part(p.get('parts', []))
                            if data: # Stop as soon as we find it
                                return data
                    return data

                if 'parts' in payload:
                    body_data = find_plain_text_part(payload.get('parts', []))
                
                # Fallback for simple emails (non-multipart)
                if not body_data and 'body' in payload:
                    msg_body = payload.get('body')
                    if msg_body:
                        body_data = msg_body.get('data', '')
                # --- END OF FIX ---
                        
                body = ""
                if body_data:
                    try:
                        # Ensure data is valid base64
                        body = base64.urlsafe_b64decode(body_data).decode('utf-8')
                    except Exception:
                        body = msg.get('snippet', '') # Fallback to snippet
                else:
                    body = msg.get('snippet', '')

                email_details.append({
                    "id": msg['id'], "from": sender, "subject": subject, "body_snippet": body[:500]
                })
            
            return json.dumps(email_details)
        except Exception as e:
            print(f"[GmailJsonTool Error]: {e}")
            return json.dumps([])

