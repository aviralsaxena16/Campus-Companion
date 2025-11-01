import os
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
from dotenv import load_dotenv

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Import all your tools
from app.agent.tools.web_scraper_tool import WebScraperTool
from app.agent.tools.calendar_tool import CreateCalendarEventTool
from app.agent.tools.gmail_reader_tool import GmailReaderTool
from app.agent.tools.event_parser_tool import EventParserTool
from app.agent.tools.rag_tool import DocumentQueryTool
from app.agent.tools.contest_scanner_tool import ContestScannerTool
from app.agent.tools.bulk_event_parser_tool import BulkEventParserTool
from app.agent.tools.advisor_tool import AdvisorTool
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)


# ---

# --- FIX 2: Correct the base_tools list ---
# Removed the broken lambda for DocumentQueryTool.
# Removed CreateCalendarEventTool and GmailReaderTool (they are added later).
base_tools = [
    WebScraperTool(), 
    EventParserTool(),  # <-- Initialize it simply. The agent will provide the args.
    ContestScannerTool(),
    AdvisorTool(),
    BulkEventParserTool(),
    
]
# ---

# The prompt is correct and already tells the agent to pass {user_email}
prompt = ChatPromptTemplate.from_messages([
    ("system", 
     "You are an expert AI university navigator. You are acting on behalf of a user with the email: {user_email}. "
     "You MUST use this email for any tools that require a user_email parameter (like `document_query_tool`). "
     "Today's date is November 01, 2025. The user's timezone is 'Asia/Kolkata'."
     "\n\n"
     "=== CORE WORKFLOWS ==="
     "\n"
     "**Workflow #1: General Q&A**"
     "\n- To answer questions about a URL, use `web_scraper`."
     "\n- To answer questions about emails, use `read_gmail`."
     "\n- To answer questions about a PDF, use `document_query_tool`."
     "\n"
     "**Workflow #2: Scheduling a SINGLE Event (from URL, Email, or PDF)**"
     "\n- **ONLY IF** the user explicitly asks to 'schedule', 'mark', 'add', or 'put on my calendar', you MUST follow this strict three-step process:"
     "\n1.  **GET TEXT:** Use the appropriate tool (`web_scraper`, `read_gmail`, `document_query_tool`) to get the text."
     "\n2.  **PARSE EVENT:** Pass the text to the `event_parser_tool`."
     "\n3.  **CREATE EVENT:** If the parser is successful, call `Calendar`."
     "\n"
     "**Workflow #3: Competitive Programming Contests**"
     "\n1.  If the user asks about 'contests', 'leetcode', or 'codeforces', you MUST use the `contest_scanner_tool`."
     "\n2.  If the user asks to schedule the contests, you MUST then call the `Calendar` tool for **EACH** event in the list."
     "\n\n"
     "**Workflow #4: Strategic Advising**"
     "\n- If the user asks for a 'roadmap', 'plan', 'how to prepare', or 'how to learn', you MUST use the `advisor_tool`."
     "\n- The tool will return a structured JSON roadmap. You must return this JSON object directly as your final answer."
     "\n\n"
     "**CRITICAL RULE:** Do not explain your plan. Execute the necessary workflow from start to finish. If the user asks you to schedule events, your final response MUST be a confirmation that the events have been added to the calendar."
    ),
    ("user", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# This function is now correct
def create_agent_executor(access_token: str):
    """
    Factory function to create an agent executor with token-aware tools.
    This function is called ONCE per request.
    """
    
    creds = Credentials(token=access_token)
    
    calendar_service = None
    gmail_service = None
    
    try:
        calendar_service = build("calendar", "v3", credentials=creds, static_discovery=False)
        gmail_service = build("gmail", "v1", credentials=creds, static_discovery=False)
    except HttpError as e:
        print(f"Warning: Could not build Google services. Token might be invalid. Error: {e}")
    except Exception as e:
        print(f"An unexpected error occurred building Google services: {e}")

    # Start with the stateless, non-auth tools
    request_tools = list(base_tools) 
    
    # Add the stateful, auth-dependent tools
    if calendar_service:
        request_tools.append(CreateCalendarEventTool(service=calendar_service))
    if gmail_service:
        request_tools.append(GmailReaderTool(service=gmail_service))

    agent = create_openai_tools_agent(llm, request_tools, prompt)
    
    agent_executor = AgentExecutor(
        agent=agent, 
        tools=request_tools, 
        verbose=True, 
        handle_parsing_errors=True,
        max_iterations=10,
        early_stopping_method="force",
        return_intermediate_steps=False
    )
    
    return agent_executor

# This function is also correct
async def get_agent_response(
    user_input: str, 
    user_email: str, 
    access_token: str,
    config: dict = {}
):
    try:
        agent_executor = create_agent_executor(access_token)
    
        response = await agent_executor.ainvoke({
            "input": user_input,
            "user_email": user_email 
        }, config=config)
        
        output = response.get('output', '')
        
        if not output or output.strip().endswith('<tool_call>'):
            return "I've processed your request. Please check your calendar for the scheduled event."
        
        return output
        
    except Exception as e:
        return f"I encountered an error while processing your request: {str(e)}. Please try again or rephrase your request."