import os
import json
import time
import requests
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import models
from app.database import SessionLocal
from app.agent.tools.gmail_json_tool import GmailJsonTool
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

# ============================================================
# HUGGINGFACE FASTAPI ENDPOINT CONFIG
# ============================================================

HF_SPACE_URL = os.getenv(
    "HF_SPACE_URL",
    "https://aviralsaxena16-campus-mail-classifier-api.hf.space"
)

# FastAPI predict endpoint
HF_API_URL = f"{HF_SPACE_URL}/predict"

LABEL_NORMALIZATION = {
    "CAREER": "CAREER",
    "EVENT": "EVENT",
    "DEADLINE": "DEADLINE",
    "GENERAL": "GENERAL",
    "SPAM": "SPAM/PROMO",
    "PROMO": "SPAM/PROMO",
}


# ============================================================
# API CALLER
# ============================================================

def classify_emails_batch(email_texts: list, max_retries: int = 3) -> list:
    """
    Calls HuggingFace Space FastAPI endpoint for each email.

    Args:
        email_texts: List of email strings in format "Subject: ... Body: ..."
        max_retries: Retry attempts for HTTP failures

    Returns:
        List of [[{label, score}], ...] format for compatibility
    """
    results = []

    for text in email_texts:
        try:
            subject, body = "", ""

            if "Body:" in text:
                parts = text.split("Body:", 1)
                subject = parts[0].replace("Subject:", "").strip()
                body = parts[1].strip()
            else:
                subject = text

            for attempt in range(max_retries):
                try:
                    print(f"[HF API] Classifying email (Attempt {attempt + 1}/{max_retries})")
                    print(f"[HF API] Subject: {subject[:50]}")

                    payload = {
                        "subject": subject,
                        "body": body
                    }

                    response = requests.post(
                        HF_API_URL,
                        json=payload,
                        timeout=30,
                        headers={"Content-Type": "application/json"}
                    )

                    if response.status_code != 200:
                        print(f"[HF API] Error: {response.status_code} {response.text}")
                        raise Exception(f"HTTP {response.status_code}")

                    result_data = response.json()

                    label_raw = result_data.get("label", "GENERAL")
                    confidence = float(result_data.get("confidence", 0.0))
                    label = LABEL_NORMALIZATION.get(label_raw.upper(), "GENERAL")

                    results.append([{"label": label, "score": confidence}])

                    print(f"[HF API] ✓ {label} ({confidence:.2f})")
                    break

                except Exception as e:
                    print(f"[HF API ERROR] {e}")
                    if attempt == max_retries - 1:
                        results.append([{"label": "GENERAL", "score": 0.0}])
                        print("[HF API] ✗ Failed, defaulted to GENERAL")
                    else:
                        time.sleep(2 ** attempt)

        except Exception as e:
            print(f"[HF API PARSE ERROR] {e}")
            results.append([{"label": "GENERAL", "score": 0.0}])

    return results


# ============================================================
# EMAIL PROCESSING PIPELINE
# ============================================================

def run_email_summary_for_user(user_email: str) -> list:
    print(f"\n[SCAN] Starting scan for user: {user_email}\n" + "-" * 50)

    db: Session = SessionLocal()

    try:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if not user or not user.google_refresh_token:
            print("[SCAN] ✗ Missing user or refresh token")
            return []

        gmail_tool = GmailJsonTool(user_email=user_email)
        emails_json_str = gmail_tool.run()

        try:
            emails = json.loads(emails_json_str)
        except Exception as e:
            print("[SCAN] ✗ Gmail JSON parse failed:", e)
            return []

        processed_ids = {
            u.source_id for u in db.query(models.ImportantUpdate)
            .filter(models.ImportantUpdate.user_id == user.id).all()
        }

        new_emails = [e for e in emails if e["id"] not in processed_ids]
        print(f"[SCAN] {len(new_emails)} new emails")

        if not new_emails:
            return (
                db.query(models.ImportantUpdate)
                .filter(models.ImportantUpdate.user_id == user.id)
                .filter(models.ImportantUpdate.is_important == True)
                .order_by(models.ImportantUpdate.discovered_at.desc())
                .limit(50).all()
            )

        email_texts = [
            f"Subject: {e.get('subject', 'No subject')}\nBody: {e.get('body_snippet', '')}"
            for e in new_emails
        ]

        classifications = classify_emails_batch(email_texts)
        new_updates = []
        spam_count, filtered_count = 0, 0

        for i, email in enumerate(new_emails):
            cls = classifications[i][0]
            label, score = cls["label"], cls["score"]
            subject = email.get("subject", "No subject")
            is_spam = label == "SPAM/PROMO"
            should_save = not is_spam and score > 0.3

            if should_save:
                upd = models.ImportantUpdate(
                    user_id=user.id,
                    source_id=email["id"],
                    title=f"[{label}] {subject}",
                    summary=email.get("body_snippet", "")[:200] + "...",
                    is_important=True,
                )
                new_updates.append(upd)
                print(f"[SCAN] ✓ SAVED {label} ({score:.2f}) {subject[:40]}")
            else:
                if is_spam: spam_count += 1
                else: filtered_count += 1
                print(f"[SCAN] ✗ FILTERED {label} ({score:.2f}) {subject[:40]}")

        if new_updates:
            db.add_all(new_updates)
            db.commit()
            print(f"[SCAN] ✓ Saved {len(new_updates)} updates")

        print(f"[SCAN SUMMARY] saved={len(new_updates)}, spam={spam_count}, filtered={filtered_count}")

        return (
            db.query(models.ImportantUpdate)
            .filter(models.ImportantUpdate.user_id == user.id)
            .filter(models.ImportantUpdate.is_important == True)
            .order_by(models.ImportantUpdate.discovered_at.desc())
            .limit(50)
            .all()
        )

    except Exception as e:
        print("[SCAN CRITICAL ERROR]", e)
        return []

    finally:
        db.close()


# ============================================================
# SCHEDULER
# ============================================================

def scheduled_job_wrapper(user_email: str):
    print(f"[SCHEDULER] Running daily scan for {user_email}")
    run_email_summary_for_user(user_email)


def start_scheduler_for_user(user_email: str):
    job_id = f"email_scan_{user_email}"
    if not scheduler.running:
        scheduler.start()
        print("[SCHEDULER] ✓ Started")

    if not scheduler.get_job(job_id):
        scheduler.add_job(
            scheduled_job_wrapper, "interval", days=1, args=[user_email], id=job_id
        )
        print(f"[SCHEDULER] ✓ Added job for {user_email}")


def stop_scheduler_for_user(user_email: str):
    job_id = f"email_scan_{user_email}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        print(f"[SCHEDULER] ✓ Removed job for {user_email}")


# ============================================================
# TEST
# ============================================================

def test_classification():
    samples = [
        "Subject: Assignment Due\nBody: Submit before tonight!",
        "Subject: Career Fair\nBody: Companies hiring",
        "Subject: Domino's Offer\nBody: 50% OFF today",
    ]
    res = classify_emails_batch(samples)
    print(res)


if __name__ == "__main__":
    test_classification()
