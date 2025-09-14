# In backend/app/services/scheduler_service.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
import json

from app import models
from app.database import SessionLocal
from app.agent.tools.gmail_reader_tool import GmailReaderTool
from app.agent.orchestrator import llm
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers.json import JsonOutputParser

# The scheduler is now a single instance we manage from main.py
scheduler = AsyncIOScheduler()

def summarize_email_job(user_email: str):
    """The actual job that runs on a schedule for a given user."""
    print(f"SCHEDULER: Running email scan for {user_email}...")
    db: Session = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if not user or not user.calendar_connected:
            print(f"SCHEDULER: Skipping job for {user_email}: account not connected.")
            return

        gmail_tool = GmailReaderTool()
        emails_json_str = gmail_tool._run(user_email=user_email, query="is:unread in:inbox category:primary")
        
        try:
            emails = json.loads(emails_json_str)
            if not isinstance(emails, list) or not emails:
                print(f"SCHEDULER: No new unread emails for {user_email}.")
                return
        except (json.JSONDecodeError, TypeError):
             print(f"SCHEDULER: Could not decode emails or no new mail for {user_email}.")
             return

        summarizer_prompt = ChatPromptTemplate.from_template(
            "You are an expert at identifying important emails. From the following JSON list of emails, identify any that contain urgent requests, deadlines, or meeting invitations. "
            "Return a JSON list of objects, where each object has a 'title' (the email subject) and a 'summary' (a short, one-sentence summary of the important part). "
            "If no emails are important, return an empty list. Emails:\n\n{emails}"
        )
        parser = JsonOutputParser()
        chain = summarizer_prompt | llm | parser
        important_emails = chain.invoke({"emails": emails})

        for email_summary in important_emails:
            new_update = models.ImportantUpdate(user_id=user.id, title=email_summary.get("title", "No Title"), summary=email_summary.get("summary", "No Summary"))
            db.add(new_update)
        
        db.commit()
        print(f"SCHEDULER: Saved {len(important_emails)} important updates for {user_email}.")
    except Exception as e:
        print(f"Error in scheduled job for {user_email}: {e}")
    finally:
        db.close()

def start_scheduler_for_user(user_email: str):
    """Adds a daily job for a user to the scheduler."""
    job_id = f"email_scan_{user_email}"
    if not scheduler.get_job(job_id):
        # We only ADD the job here. We DO NOT start the scheduler.
        scheduler.add_job(summarize_email_job, 'interval', days=1, args=[user_email], id=job_id)
        print(f"SCHEDULER: Scheduled daily email scan for {user_email}.")