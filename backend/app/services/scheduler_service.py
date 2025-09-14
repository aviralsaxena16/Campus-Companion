# In backend/app/services/scheduler_service.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
import json

from app import models
from app.database import SessionLocal
# --- CHANGE: Import the new JSON tool ---
from app.agent.tools.gmail_json_tool import GmailJsonTool
from app.agent.orchestrator import llm
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers.json import JsonOutputParser

scheduler = AsyncIOScheduler()

def run_email_summary_for_user(user_email: str) -> list:
    print(f"TASK: Running email scan for {user_email}...")
    db: Session = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if not user or not user.calendar_connected: return []

        # --- CHANGE: Use the new JSON tool ---
        gmail_tool = GmailJsonTool(user_email=user_email)
        emails_json_str = gmail_tool.run()
        
        try:
            emails = json.loads(emails_json_str)
            if not isinstance(emails, list) or not emails: return []
        except (json.JSONDecodeError, TypeError): return []

        processed_email_ids = {update.source_id for update in db.query(models.ImportantUpdate).filter(models.ImportantUpdate.user_id == user.id).all()}
        new_emails = [email for email in emails if email.get("id") not in processed_email_ids]

        if not new_emails:
            print(f"TASK: No new emails to process for {user_email}.")
            all_updates = db.query(models.ImportantUpdate).filter(models.ImportantUpdate.user_id == user.id).order_by(models.ImportantUpdate.discovered_at.desc()).limit(20).all()
            return all_updates

        summarizer_prompt = ChatPromptTemplate.from_template(
            "You are an expert at identifying important emails containing urgent requests, deadlines, or meeting invitations. From the following JSON list of emails, return a JSON list of objects for the important ones. Each object must have a 'title' (the email subject) and a 'summary' (a short, one-sentence summary). If no emails are important, return an empty list. Emails:\n\n{emails}"
        )
        parser = JsonOutputParser()
        chain = summarizer_prompt | llm | parser
        important_email_summaries = chain.invoke({"emails": new_emails})

        for summary in important_email_summaries:
            original_email_id = next((email['id'] for email in new_emails if email['subject'] == summary.get('title')), None)
            if original_email_id:
                new_update = models.ImportantUpdate(
                    user_id=user.id,
                    source_id=original_email_id,
                    title=summary.get("title", "No Title"),
                    summary=summary.get("summary", "No Summary"),
                )
                db.add(new_update)
        
        db.commit()
        print(f"TASK: Saved {len(important_email_summaries)} new important updates for {user_email}.")
        
        all_updates = db.query(models.ImportantUpdate).filter(models.ImportantUpdate.user_id == user.id).order_by(models.ImportantUpdate.discovered_at.desc()).limit(20).all()
        return all_updates
    finally:
        db.close()

# The scheduled job is now just a lightweight wrapper
def scheduled_job_wrapper(user_email: str):
    run_email_summary_for_user(user_email)

def start_scheduler_for_user(user_email: str):
    job_id = f"email_scan_{user_email}"
    if not scheduler.get_job(job_id):
        scheduler.add_job(scheduled_job_wrapper, 'interval', days=1, args=[user_email], id=job_id)
        print(f"SCHEDULER: Scheduled daily email scan for {user_email}.")