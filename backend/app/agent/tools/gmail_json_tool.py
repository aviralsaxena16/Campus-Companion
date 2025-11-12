import base64
import json
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from app.services.google_auth import get_user_credentials

class GmailJsonTool:
    """
    Dedicated service utility for backend processes to fetch raw email data as JSON.
    Now includes date filtering to only get recent emails.
    """
    def __init__(self, user_email: str, days_back: int = 2):
        self.user_email = user_email
        self.days_back = days_back

    def run(self, query: str = None):
        """
        Fetch emails from Gmail. By default, fetches emails from last N days.
        
        Args:
            query: Optional custom Gmail query. If None, uses default recent emails query.
        """
        try:
            credentials = get_user_credentials(self.user_email)
            if not credentials:
                print(f"[GmailJsonTool Error]: Could not get credentials for {self.user_email}")
                return json.dumps([])
                 
            service = build("gmail", "v1", credentials=credentials)
            
            # Build query for recent emails if no custom query provided
            if query is None:
                # Calculate date for filtering (N days ago)
                date_threshold = datetime.now() - timedelta(days=self.days_back)
                date_str = date_threshold.strftime('%Y/%m/%d')
                
                # Query: Get emails from last N days, exclude sent/drafts/spam
                query = f'after:{date_str} -in:sent -in:drafts -in:spam'
                print(f"[GmailJsonTool]: Using query: {query}")
            
            # Fetch more emails to ensure we get enough recent ones
            results = service.users().messages().list(
                userId='me', 
                q=query, 
                maxResults=100  # Increased from 5 to get more recent emails
            ).execute()
            
            messages = results.get('messages', [])
            print(f"[GmailJsonTool]: Found {len(messages)} messages from last {self.days_back} days")

            if not messages:
                return json.dumps([])

            email_details = []
            for message_info in messages:
                try:
                    msg = service.users().messages().get(
                        userId='me', 
                        id=message_info['id'], 
                        format='full'
                    ).execute()
                    
                    payload = msg.get('payload', {})
                    headers = payload.get('headers', [])
                    
                    # Extract headers
                    subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
                    sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown Sender')
                    date_header = next((h['value'] for h in headers if h['name'].lower() == 'date'), '')
                    
                    # Get internal date (timestamp in milliseconds)
                    internal_date = int(msg.get('internalDate', 0)) / 1000  # Convert to seconds
                    
                    body_data = ""
                    
                    # Recursively search for the text/plain part
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
                                if data:  # Stop as soon as we find it
                                    return data
                        return data

                    if 'parts' in payload:
                        body_data = find_plain_text_part(payload.get('parts', []))
                    
                    # Fallback for simple emails (non-multipart)
                    if not body_data and 'body' in payload:
                        msg_body = payload.get('body')
                        if msg_body:
                            body_data = msg_body.get('data', '')
                            
                    body = ""
                    if body_data:
                        try:
                            # Ensure data is valid base64
                            body = base64.urlsafe_b64decode(body_data).decode('utf-8')
                        except Exception as decode_error:
                            print(f"[GmailJsonTool]: Base64 decode error for message {message_info['id']}: {decode_error}")
                            body = msg.get('snippet', '')  # Fallback to snippet
                    else:
                        body = msg.get('snippet', '')

                    email_details.append({
                        "id": msg['id'],
                        "from": sender,
                        "subject": subject,
                        "date": date_header,
                        "timestamp": internal_date,  # For sorting
                        "body_snippet": body[:500]
                    })
                    
                except Exception as msg_error:
                    print(f"[GmailJsonTool]: Error fetching message {message_info['id']}: {msg_error}")
                    continue
            
            # Sort by timestamp (newest first)
            email_details.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
            
            print(f"[GmailJsonTool]: Successfully fetched {len(email_details)} complete emails")
            return json.dumps(email_details)
            
        except Exception as e:
            print(f"[GmailJsonTool Error]: {e}")
            import traceback
            traceback.print_exc()
            return json.dumps([])