import os
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
from dotenv import load_dotenv

# --- NEW IMPORTS ---
# We need these to build Google services from the access token
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
# ---

# Import all your tools
from app.agent.tools.web_scraper_tool import WebScraperTool
from app.agent.tools.calendar_tool import CreateCalendarEventTool
from app.agent.tools.gmail_reader_tool import GmailReaderTool
from app.agent.tools.event_parser_tool import EventParserTool
from app.agent.tools.rag_tool import DocumentQueryTool
from app.agent.tools.contest_scanner_tool import ContestScannerTool
from app.agent.tools.bulk_event_parser_tool import BulkEventParserTool
from app.agent.tools.advisor_tool import AdvisorTool

load_dotenv()

# Initialize the LLM globally
llm = ChatGoogleGenerativeAI(model="gemini-2.5-pro", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)

# --- DEFINE NON-AUTH TOOLS GLOBALLY ---
# Tools that DON'T need Google Auth can be created once and reused.
base_tools = [
    WebScraperTool(), 
    EventParserTool(),
    DocumentQueryTool(),
    ContestScannerTool(),
    AdvisorTool()
    # REMOVED: CreateCalendarEventTool and GmailReaderTool from this global list
]

# --- DEFINE PROMPT GLOBALLY ---
# The prompt template is static and can be reused.
prompt = ChatPromptTemplate.from_messages([
    ("system", 
     "You are an expert AI university navigator. You are acting on behalf of a user with the email: {user_email}. "
     "You MUST use this email for any tools that require a user_email parameter. "
     "Today's date is October 31, 2025. The user's timezone is 'Asia/Kolkata'." # Updated date
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
     "\n1. 	**GET TEXT:** Use the appropriate tool (`web_scraper`, `read_gmail`, `document_query_tool`) to get the text."
     "\n2. 	**PARSE EVENT:** Pass the text to the `event_parser_tool`."
     "\n3. 	**CREATE EVENT:** If the parser is successful, call `Calendar`."
     "\n"
     "**Workflow #3: Competitive Programming Contests**"
     "\n1. 	If the user asks about 'contests', 'leetcode', or 'codeforces', you MUST use the `contest_scanner_tool`."
     "\n2. 	If the user asks to schedule the contests, you MUST then call the `Calendar` tool for **EACH** event in the list."
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

# --- CREATE A FACTORY FUNCTION FOR THE AGENT ---
def create_agent_executor(access_token: str):
    """
    Factory function to create an agent executor with token-aware tools.
    This function is called ONCE per request.
    """
    
    # 1. Create credentials object from the access token
    creds = Credentials(token=access_token)
    
    # 2. Build the Google services
    calendar_service = None
    gmail_service = None
    
    try:
        calendar_service = build("calendar", "v3", credentials=creds, static_discovery=False)
        gmail_service = build("gmail", "v1", credentials=creds, static_discovery=False)
    except HttpError as e:
        print(f"Warning: Could not build Google services. Token might be invalid. Error: {e}")
        # The agent will run without Google tools
    except Exception as e:
        print(f"An unexpected error occurred building Google services: {e}")

    # 3. Create this request's specific tool list
    request_tools = list(base_tools) # Start with the non-auth tools
    
    # 4. Initialize and add Google tools, passing the service
    #    
    #    *** IMPORTANT ASSUMPTION ***
    #    Your CreateCalendarEventTool and GmailReaderTool classes
    #    MUST be updated to accept the 'service' object in their constructor.
    #    
    #    Example (in calendar_tool.py):
    #    class CreateCalendarEventTool(BaseTool):
    #        service: Any
    #        def _run(self, ...):
    #            # Use self.service to make API calls
    #            return self.service.events().insert(...).execute()
    #
    if calendar_service:
        request_tools.append(CreateCalendarEventTool(service=calendar_service))
    if gmail_service:
        request_tools.append(GmailReaderTool(service=gmail_service))

    # 5. Create the agent and executor
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

# --- UPDATE THE MAIN AGENT FUNCTION ---
async def get_agent_response(
    user_input: str, 
    user_email: str, 
    access_token: str, # <-- THE NEW ARGUMENT
    config: dict = {}
):
    try:
        # 1. Create a request-specific agent executor
        agent_executor = create_agent_executor(access_token)
    
        # 2. Invoke the agent
        response = await agent_executor.ainvoke({
            "input": user_input,
            "user_email": user_email 
        }, config=config)
        
        output = response.get('output', '')
        
        # Handle cases where the agent ends on a tool call (e.g., after scheduling)
        if not output or output.strip().endswith('<tool_call>'):
            return "I've processed your request. Please check your calendar for the scheduled event."
        
        return output
        
    except Exception as e:
        # This will catch errors from the agent factory (e.g., bad token)
        # or from the agent execution itself.
        return f"I encountered an error while processing your request: {str(e)}. Please try again or rephrase your request."