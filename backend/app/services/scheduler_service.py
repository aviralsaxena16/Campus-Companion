from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import json

from app import models
from app.database import SessionLocal
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

        gmail_tool = GmailJsonTool(user_email=user_email)
        emails_json_str = gmail_tool.run()
        try:
            emails = json.loads(emails_json_str)
            if not isinstance(emails, list) or not emails: return []
        except (json.JSONDecodeError, TypeError): return []

        processed_email_ids = {update.source_id for update in db.query(models.ImportantUpdate).filter(models.ImportantUpdate.user_id == user.id).all()}
        new_emails = [email for email in emails if email.get("id") not in processed_email_ids]

        if not new_emails:
            all_updates = db.query(models.ImportantUpdate).filter(models.ImportantUpdate.user_id == user.id).order_by(models.ImportantUpdate.discovered_at.desc()).limit(20).all()
            return all_updates

        # --- NEW, MORE DIRECT PROMPT ---
        summarizer_prompt = ChatPromptTemplate.from_template(
    "You are an expert AI assistant tasked with filtering a student's email inbox to find actionable and important messages. "
    "Analyze the following list of emails provided in JSON format. "
    "\n\n"
    "An email is considered 'important' if it falls into one of these categories:"
    "\n- **Academic Deadlines:** Assignments, project submissions, exam dates."
    "\n- **Career Opportunities:** Internships, job postings, career fairs, recruitment events."
    "\n- **Scheduled Events:** Meeting invitations, workshop schedules, club event announcements."
    "\n- **Urgent Actions:** Security alerts, fee payment reminders, registration information."
    "\n- **Direct Communication:** Personal messages from professors or university administration."
    "\n\n"
    "Emails that are NOT important are general newsletters, marketing, daily notifications (like GitHub actions or POTD), or general announcements with no clear action or date."
    "\n\n"
    "Your task is to return a new, filtered JSON list containing ONLY the important emails. "
    "For each important email, create a JSON object with two keys:"
    "\n- `title`: The original email subject."
    "\n- `summary`: A concise, one-sentence summary of the key action or information."
    "\n\n"
    "Your entire response MUST be only the JSON list. Do not include any other text or explanations. If no emails are important, return an empty JSON list `[]`."
    "\n\n"
    "EMAIL DATA TO ANALYZE:\n{emails_json_string}"
)
        parser = JsonOutputParser()
        chain = summarizer_prompt | llm | parser
        
        # We explicitly convert the list of emails to a JSON string for the prompt
        important_email_summaries = chain.invoke({"emails_json_string": json.dumps(new_emails)})

        new_updates_found = 0
        for summary in important_email_summaries:
            original_email_id = next((email['id'] for email in new_emails if email['subject'] == summary.get('title')), None)
            if original_email_id:
                exists = db.query(models.ImportantUpdate).filter_by(source_id=original_email_id, user_id=user.id).first()
                if not exists:
                    new_update = models.ImportantUpdate(user_id=user.id, source_id=original_email_id, title=summary.get("title", "No Title"), summary=summary.get("summary", "No Summary"))
                    db.add(new_update)
                    try:
                        db.commit()
                        new_updates_found += 1
                    except IntegrityError:
                        db.rollback()
        
        if new_updates_found > 0:
            print(f"TASK: Saved {new_updates_found} new important updates for {user_email}.")
        
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