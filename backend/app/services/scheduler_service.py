import os
import json
import time
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app import models
from app.database import SessionLocal
from app.agent.tools.gmail_json_tool import GmailJsonTool
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from transformers import pipeline
import torch

scheduler = AsyncIOScheduler()

# --- CONFIGURATION ---
# Load model directly from HuggingFace
HF_MODEL_NAME = "aviralsaxena16/campus-mail-classifier"  # Your HF model repo
DEVICE = 0 if torch.cuda.is_available() else -1  # Use GPU if available, else CPU

# Initialize the classifier globally (loaded once at startup)
print(f"[CLASSIFIER] Loading model from HuggingFace: {HF_MODEL_NAME}")
print(f"[CLASSIFIER] Using device: {'GPU' if DEVICE == 0 else 'CPU'}")

try:
    classifier = pipeline(
        "text-classification",
        model=HF_MODEL_NAME,
        device=DEVICE,
        top_k=1  # Return top prediction only
    )
    print(f"[CLASSIFIER] ✓ Model loaded successfully!")
except Exception as e:
    print(f"[CLASSIFIER] ✗ Failed to load model: {e}")
    classifier = None

def classify_emails_batch(email_texts: list, max_retries: int = 3) -> list:
    """
    Classifies emails using the HuggingFace model loaded directly.
    Returns a list of classifications or empty list on failure.
    """
    if classifier is None:
        print("[CLASSIFIER] ✗ Model not loaded, cannot classify")
        return []
    
    for attempt in range(max_retries):
        try:
            print(f"[CLASSIFIER] Classifying {len(email_texts)} emails (attempt {attempt + 1}/{max_retries})...")
            
            # Run inference
            results = classifier(email_texts)
            
            # Format results to match expected structure
            formatted_results = []
            for result in results:
                if isinstance(result, list) and len(result) > 0:
                    # Result is already a list of predictions
                    formatted_results.append(result)
                else:
                    # Wrap single prediction in list
                    formatted_results.append([result])
            
            print(f"[CLASSIFIER] ✓ Successfully classified {len(email_texts)} emails")
            return formatted_results
            
        except Exception as e:
            print(f"[CLASSIFIER] ✗ Exception on attempt {attempt + 1}: {type(e).__name__}: {e}")
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            return []

    print("[CLASSIFIER] ✗ All retry attempts failed")
    return []


def run_email_summary_for_user(user_email: str) -> list:
    """
    Scan emails for a user, classify them with ML model, and save important ones to DB
    """
    print(f"\n{'='*60}")
    print(f"[SCAN] Starting email scan for: {user_email}")
    print(f"{'='*60}")
    
    db: Session = SessionLocal()
    try:
        # 1. Get user from database
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if not user:
            print(f"[SCAN] ✗ User not found: {user_email}")
            return []
            
        if not user.google_refresh_token:
            print(f"[SCAN] ✗ No Google refresh token for {user_email}")
            return []

        # 2. Fetch emails from Gmail
        print(f"[SCAN] Fetching emails from Gmail...")
        gmail_tool = GmailJsonTool(user_email=user_email)
        emails_json_str = gmail_tool.run()
        
        try:
            emails = json.loads(emails_json_str)
            if not isinstance(emails, list) or not emails:
                print(f"[SCAN] No emails found")
                return []
            print(f"[SCAN] ✓ Retrieved {len(emails)} total emails")
        except (json.JSONDecodeError, TypeError) as e:
            print(f"[SCAN] ✗ Failed to parse emails JSON: {e}")
            return []

        # 3. Filter out already processed emails
        processed_email_ids = {
            update.source_id
            for update in db.query(models.ImportantUpdate)
                .filter(models.ImportantUpdate.user_id == user.id)
                .all()
        }
        
        new_emails = [
            email for email in emails
            if email.get("id") not in processed_email_ids
        ]

        print(f"[SCAN] Found {len(new_emails)} new emails (out of {len(emails)} total)")
        
        if not new_emails:
            print(f"[SCAN] No new emails to process")
            existing_updates = db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.user_id == user.id)\
                .filter(models.ImportantUpdate.is_important == True)\
                .order_by(models.ImportantUpdate.discovered_at.desc())\
                .limit(50)\
                .all()
            print(f"[SCAN] Returning {len(existing_updates)} existing important updates")
            return existing_updates

        # 4. Prepare email texts for classification
        email_texts = [
            f"Subject: {email.get('subject', 'No Subject')}\nBody: {email.get('body_snippet', '')}"
            for email in new_emails
        ]

        # 5. Classify emails using ML model
        print(f"[SCAN] Classifying {len(email_texts)} emails...")
        classifications = classify_emails_batch(email_texts)

        if not classifications:
            print("[SCAN] ✗ Classification failed, returning existing updates")
            return db.query(models.ImportantUpdate)\
                .filter(models.ImportantUpdate.user_id == user.id)\
                .filter(models.ImportantUpdate.is_important == True)\
                .order_by(models.ImportantUpdate.discovered_at.desc())\
                .limit(50)\
                .all()

        # 6. Process classifications and save ALL emails (including GENERAL)
        print(f"\n[CLASSIFICATION RESULTS]")
        print("-" * 60)
        
        new_updates_to_save = []
        for i, email in enumerate(new_emails):
            if i >= len(classifications):
                print(f"⚠ Warning: Classification missing for email {i}")
                break
            
            classification_result = classifications[i]
            
            # Handle both list and dict formats
            if isinstance(classification_result, list) and len(classification_result) > 0:
                top_prediction = classification_result[0]
            elif isinstance(classification_result, dict):
                top_prediction = classification_result
            else:
                print(f"⚠ Unexpected format for email {i}: {type(classification_result)}")
                continue

            label = top_prediction.get('label', 'GENERAL')
            score = top_prediction.get('score', 0.0)
            subject = email.get('subject', 'No Subject')[:50]
            
            # Save ALL emails except SPAM/PROMO (now includes GENERAL)
            is_spam = label in ["SPAM/PROMO", "SPAM", "PROMO"]
            should_save = not is_spam and score > 0.5  # Lowered threshold to 0.5
            
            if should_save:
                new_update = models.ImportantUpdate(
                    user_id=user.id,
                    source_id=email['id'],
                    title=f"[{label}] {email.get('subject', 'No Subject')}",
                    summary=email.get('body_snippet', '')[:200] + "...",
                    is_important=True  # Mark as important to show in UI
                )
                new_updates_to_save.append(new_update)
                print(f"✓ {label:12} ({score:.2f}) - {subject}")
            else:
                print(f"✗ {label:12} ({score:.2f}) - {subject} [FILTERED]")
        
        print("-" * 60)
                
        # 7. Save new updates to database
        if new_updates_to_save:
            db.add_all(new_updates_to_save)
            db.commit()
            print(f"\n[SCAN] ✓ Saved {len(new_updates_to_save)} important updates")
        else:
            print(f"\n[SCAN] No important emails found (all filtered as SPAM/GENERAL)")

        # 8. Return all important updates
        all_updates = db.query(models.ImportantUpdate)\
            .filter(models.ImportantUpdate.user_id == user.id)\
            .filter(models.ImportantUpdate.is_important == True)\
            .order_by(models.ImportantUpdate.discovered_at.desc())\
            .limit(50)\
            .all()
        
        print(f"[SCAN] ✓ Complete! Returning {len(all_updates)} total important updates")
        print(f"{'='*60}\n")
        return all_updates

    except Exception as e:
        print(f"\n[SCAN] ✗✗✗ ERROR ✗✗✗")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {e}")
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
    
    if not scheduler.running:
        scheduler.start()
        print(f"[SCHEDULER] ✓ Scheduler started")
    
    if not scheduler.get_job(job_id):
        scheduler.add_job(
            scheduled_job_wrapper,
            'interval',
            days=1,
            args=[user_email],
            id=job_id
        )
        print(f"[SCHEDULER] ✓ Scheduled daily email scan for {user_email}")
    else:
        print(f"[SCHEDULER] Job already exists for {user_email}")