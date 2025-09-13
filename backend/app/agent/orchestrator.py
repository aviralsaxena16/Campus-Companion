# In backend/app/agent/orchestrator.py
import os
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
from dotenv import load_dotenv

from app.agent.tools.web_scraper_tool import WebScraperTool
from app.agent.tools.calendar_tool import CreateCalendarEventTool
from app.agent.tools.gmail_reader_tool import GmailReaderTool
from app.agent.tools.event_parser_tool import EventParserTool
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",  
    # you can also use gemini-pro, gemini-pro-vision etc depending on what your account supports
    temperature=0.7,
    google_api_key=GOOGLE_API_KEY
)


tools = [
    WebScraperTool(), 
    CreateCalendarEventTool(),
    GmailReaderTool(),
    EventParserTool()
]

# # --- NEW, ADVANCED PROMPT ---
# prompt = ChatPromptTemplate.from_messages([
#     ("system", 
#      "You are an expert AI university navigator for a user in India. Your capabilities include scraping websites, reading the user's recent emails, and scheduling events in their Google Calendar. "
#      "Current year is 2025. Today's date is September 13, 2025. The user's timezone is 'Asia/Kolkata' (UTC+05:30)."
#      "\n\n"
#      "=== YOUR WORKFLOWS ==="
#      "1.  **Answering Questions About Emails:** When asked a question about emails, you MUST use the `read_gmail` tool. This tool returns a JSON list of recent emails. You must carefully analyze this JSON to find the answer. Do not make up information."
#      "2.  **Scheduling from an Email:** If the user asks you to schedule an event from a specific email (e.g., 'the email about the team sync'), your plan MUST be:"
#      "    a. First, use the `read_gmail` tool with a relevant query to find that specific email."
#      "    b. Second, carefully read the 'body_snippet' of the correct email from the JSON output to find the event title, date, and time."
#      "    c. Third, use the `Calendar` tool with the details you extracted."
#      "\n\n"
#      "=== CRITICAL INSTRUCTIONS FOR TOOLS ==="
#      "-   You MUST use the `user_email` provided in the input for all Google-related tools."
#      "-   Calendar event times MUST be in the strict ISO 8601 format: 'YYYY-MM-DDTHH:MM:SS'."
#      "-   If an event's end time is not specified, you MUST assume it lasts for one (1) hour."
#      "-   After a successful action, you MUST confirm it clearly (e.g., 'I have scheduled [Event Name] for you.')."
#     ),
#     ("user", "My email is {user_email}. My request is: {input}"),
#     MessagesPlaceholder(variable_name="agent_scratchpad"),
# ])


prompt = ChatPromptTemplate.from_messages([
    ("system", 
     "You are an expert AI university navigator. Your purpose is to assist the user by performing specific tasks based on the workflows defined below. "
     "The user is in India, and their timezone is 'Asia/Kolkata' (UTC+05:30). The current year is 2025."
     "\n\n"
     "=== CORE WORKFLOWS ==="
     "\n"
     "**Workflow #1: Answering Questions from a Source**"
     "1.  If the user asks a question about a webpage, use the `web_scraper` tool to get the text."
     "2.  If the user asks a question about their emails, use the `read_gmail` tool to get a JSON list of emails."
     "3.  Analyze the output from the tool and provide a direct answer to the user's question."
     "\n"
     "**Workflow #2: Scheduling an Event from a Source (Email or Web Page)**"
     "This is a strict three-step process:"
     "1.  **Get Text:** Use `read_gmail` (for emails) or `web_scraper` (for web pages) to get the raw text containing the event information."
     "2.  **Parse Event:** Take the text from Step 1 and the `user_email` and give them to the `event_parser_tool`. This tool is an expert at extracting perfectly formatted JSON for scheduling."
     "3.  **Create Event:** Take the complete JSON output from the `event_parser_tool` and use it as the input for the `Calendar` tool to schedule the event."
     "\n\n"
     "=== CRITICAL RULES ==="
     "-   You MUST use the `user_email` provided in the input for any tool that requires it (`read_gmail`, `event_parser_tool`, `Calendar`)."
     "-   For calendar events, times MUST be in the full ISO 8601 format ('YYYY-MM-DDTHH:MM:SS')."
     "-   If an event's end time is not specified, assume it lasts for one (1) hour."
     "-   After successfully completing an action, you MUST confirm it clearly and concisely (e.g., 'I have scheduled [Event Name] for you.')."
    ),
    ("user", "My email is {user_email}. My request is: {input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])





agent = create_openai_tools_agent(llm, tools, prompt)

agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True, handle_parsing_errors=True)

async def get_agent_response(user_input: str, user_email: str):
    response = await agent_executor.ainvoke({
        "input": user_input,
        "user_email": user_email 
    })
    return response['output']