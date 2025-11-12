import os
import json
import httpx
import time
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app import models
from app.database import SessionLocal
from app.agent.tools.gmail_json_tool import GmailJsonTool
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

# --- CONFIGURATION: LOCAL/RENDER ENDPOINT ---
# Set this to your local service OR your Render URL (e.g., https://my-classifier.onrender.com/classify/emails)
HF_API_URL ="http://127.0.0.1:8000/classify/emails"
# HF_API_KEY is no longer used for local access, but removed from logic below.
# Setting it to None/blank is fine if your deployment doesn't need auth.
HF_API_KEY = None # No longer needed, setting to None

# NOTE: The Authorization header remains in the code below but is only active 
# if you set a key (e.g., when deploying to a protected cloud environment).

def classify_emails_batch(email_texts: list, max_retries: int = 3) -> list:
    """
    Calls your self-hosted FastAPI model to classify a batch of emails.
    Returns a list of classifications or empty list on failure.
    """
    
    # We remove the check for HF_API_KEY being set, as local access does not need it.
    
    headers = {
        # Only include Authorization if HF_API_KEY is actually set (e.g., for a cloud deploy)
        "Authorization": f"Bearer {os.getenv('HF_API_KEY')}" if os.getenv('HF_API_KEY') else "",
        "Content-Type": "application/json"
    }
    
    for attempt in range(max_retries):
        try:
            print(f"Attempting API call to local service (attempt {attempt + 1}/{max_retries})...")
            
            # Use a robust timeout for the initial connection and slow inference
            with httpx.Client(timeout=120.0) as client: 
                response = client.post(
                    HF_API_URL,
                    headers=headers,
                    # FIX: Correct JSON payload for the FastAPI Pydantic model
                    json={"inputs": email_texts}
                )
            
            print(f"API Response Status: {response.status_code}")
            
            # --- Success ---
            if response.status_code == 200:
                result = response.json()
                print(f"API Success: Classified {len(email_texts)} emails")
                return result
            
            # --- Generic Client/Server Error ---
            elif response.status_code >= 400:
                print(f"API Error {response.status_code}: Server returned an error.")
                print(f"Response: {response.text}")
                # Retry only on transient errors (e.g., 5xx), but here we only retry on timeout/exception
                if response.status_code >= 500 and attempt < max_retries - 1:
                    time.sleep(5)
                    continue
                return []

        except httpx.TimeoutException:
            print(f"API Timeout on attempt {attempt + 1}. Service may be waking up or slow.")
            if attempt < max_retries - 1:
                time.sleep(10) # Longer wait for slow local start
                continue
            return []
            
        except Exception as e:
            print(f"API Exception on attempt {attempt + 1}: {type(e).__name__}: {e}")
            if attempt < max_retries - 1:
                time.sleep(5)
                continue
            return []

    print("API: All retry attempts failed")
    return []


# NOTE: The rest of your code (run_email_summary_for_user, scheduled functions) remains unchanged
# as they correctly handle the DB logic and schedule management.
def run_email_summary_for_user(user_email: str) -> list:
    """
    Scan emails for a user, classify them with ML model, and save important ones to DB
    """
    print(f"TASK: Running ML email scan for {user_email}...")
    db: Session = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if not user or not user.google_refresh_token:
            print(f"TASK: Skipping scan for {user_email}, no refresh token.")
            return []

        # Fetch emails from Gmail
        print(f"TASK: Fetching emails from Gmail...")
        gmail_tool = GmailJsonTool(user_email=user_email)
        emails_json_str = gmail_tool.run()
        
        try:
            emails = json.loads(emails_json_str)
            if not isinstance(emails, list) or not emails:
                print(f"TASK: No emails found for {user_email}")
                return []
            print(f"TASK: Retrieved {len(emails)} total emails from Gmail")
        except (json.JSONDecodeError, TypeError) as e:
            print(f"TASK: Failed to parse emails JSON: {e}")
            return []

        # Get already processed email IDs
        processed_email_ids = {
            update.source_id
            for update in db.query(models.ImportantUpdate)
                .filter(models.ImportantUpdate.user_id == user.id)
                .all()
        }
        
        # Filter out already processed emails
        new_emails = [
            email for email in emails
            if email.get("id") not in processed_email_ids
        ]

        print(f"TASK: Found {len(new_emails)} new emails to classify")
        
        if not new_emails:
            print(f"TASK: No new emails to process, returning existing updates")
            return db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.user_id == user.id)\
                .filter(models.ImportantUpdate.is_important == True)\
                .order_by(models.ImportantUpdate.discovered_at.desc())\
                .limit(50)\
                .all()

        # Prepare email texts for classification
        email_texts = [
            f"Subject: {email.get('subject', 'No Subject')}\nBody: {email.get('body_snippet', '')}"
            for email in new_emails
        ]

        # Classify emails using ML model
        print(f"TASK: Calling HF API to classify {len(email_texts)} emails...")
        classifications = classify_emails_batch(email_texts)

        if not classifications:
            print("TASK: Classification failed, returning existing updates without processing new emails")
            return db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.user_id == user.id)\
                .filter(models.ImportantUpdate.is_important == True)\
                .order_by(models.ImportantUpdate.discovered_at.desc())\
                .limit(50)\
                .all()

        # Process classifications and save important emails
        new_updates_to_save = []
        for i, email in enumerate(new_emails):
            if i >= len(classifications):
                print(f"WARNING: Classification list shorter than email list at index {i}")
                break
            
            # Get the top prediction
            classification_result = classifications[i]
            
            # Handle both list of dicts and single dict formats
            if isinstance(classification_result, list) and len(classification_result) > 0:
                top_prediction = classification_result[0]
            elif isinstance(classification_result, dict):
                top_prediction = classification_result
            else:
                print(f"WARNING: Unexpected classification format for email {i}: {type(classification_result)}")
                continue

            label = top_prediction.get('label', 'GENERAL')
            score = top_prediction.get('score', 0.0)
            
            # Only save important emails (not SPAM/GENERAL)
            if label not in ["SPAM/PROMO", "GENERAL", "SPAM", "PROMO"] and score > 0.6:
                new_update = models.ImportantUpdate(
                    user_id=user.id,
                    source_id=email['id'],
                    title=f"[{label}] {email.get('subject', 'No Subject')}",
                    summary=email.get('body_snippet', '')[:200] + "...",
                    is_important=True
                )
                new_updates_to_save.append(new_update)
                print(f"TASK: ✓ Classified as {label} (confidence: {score:.2f}): {email.get('subject', 'No Subject')[:50]}")
            else:
                print(f"TASK: ✗ Skipped {label} (confidence: {score:.2f}): {email.get('subject', 'No Subject')[:50]}")
                
        # Save new updates to database
        if new_updates_to_save:
            db.add_all(new_updates_to_save)
            db.commit()
            print(f"TASK: ✓ Saved {len(new_updates_to_save)} new ML-classified updates for {user_email}.")
        else:
            print(f"TASK: No important emails found for {user_email} (all were SPAM/GENERAL or low confidence)")

        # Return all important updates
        all_updates = db.query(models.ImportantUpdate)\
            .filter(models.ImportantUpdate.user_id == user.id)\
            .filter(models.ImportantUpdate.is_important == True)\
            .order_by(models.ImportantUpdate.discovered_at.desc())\
            .limit(50)\
            .all()
        
        print(f"TASK: Returning {len(all_updates)} total important updates")
        return all_updates

    except Exception as e:
        print(f"ERROR in email scan for {user_email}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return []
    finally:
        db.close()


def scheduled_job_wrapper(user_email: str):
    """Wrapper for scheduler to call the email scan"""
    run_email_summary_for_user(user_email)

def start_scheduler_for_user(user_email: str):
    """Schedule daily email scans for a user"""
    job_id = f"email_scan_{user_email}"
    if not scheduler.get_job(job_id):
        scheduler.add_job(
            scheduled_job_wrapper,
            'interval',
            days=1,
            args=[user_email],
            id=job_id
        )
        print(f"SCHEDULER: Scheduled daily email scan for {user_email}.")
    else:
        print(f"SCHEDULER: Job already exists for {user_email}")