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
from app.agent.tools.rag_tool import DocumentQueryTool
from app.agent.tools.contest_scanner_tool import ContestScannerTool # <-- IMPORT NEW TOOL
from app.agent.tools.bulk_event_parser_tool import BulkEventParserTool
load_dotenv()


llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)

tools = [
    WebScraperTool(), 
    CreateCalendarEventTool(),
    GmailReaderTool(),
    EventParserTool(),
    DocumentQueryTool(),
    ContestScannerTool()
]

# prompt = ChatPromptTemplate.from_messages([
#     ("system", 
#      "You are an expert AI assistant that helps users schedule events from emails and websites. "
#      "You are acting on behalf of a user with the email: {user_email}. "
#      "You MUST use this email for any tools that require a user_email parameter. "
#      "Today's date is September 14, 2025. The user's timezone is 'Asia/Kolkata'."
#      "\n\n"
#      "=== YOUR CAPABILITIES ==="
#      "1. **EMAIL QUERIES**: Answer questions about the user's recent emails using `read_gmail`"
#      "2. **WEB SCRAPING**: Extract information from websites using `web_scraper`"
#      "3. **EVENT SCHEDULING**: Create calendar events from parsed information"
#      "\n\n"
#      "=== MANDATORY SCHEDULING WORKFLOW ==="
#      "When the user asks to schedule/mark/add an event to calendar, you MUST complete ALL 3 steps:"
#      "\n"
#      "**STEP 1: GET TEXT**"
#      "- Use `read_gmail` if scheduling from an email"
#      "- Use `web_scraper` if scheduling from a URL"
#      "- Wait for the tool to return the text content"
#      "\n"
#      "**STEP 2: PARSE EVENT**"
#      "- Take the EXACT text output from Step 1"
#      "- Pass it to `event_parser_tool`"
#      "- Wait for it to return a dictionary with event details"
#      "\n"
#      "**STEP 3: CREATE EVENT**"
#      "- If parser returns a dictionary with 'title' field, immediately call `create_calendar_event`"
#      "- Use the exact values from the parser output"
#      "- Use the user's email: {user_email}"
#      "\n\n"
#      "=== CRITICAL RULES ==="
#      "1. **COMPLETE ALL STEPS**: Never stop after step 1 or 2 - always complete the full workflow"
#      "2. **NO PARTIAL RESPONSES**: Never end your response with just tool calls - always provide a complete answer"
#      "3. **SEQUENTIAL EXECUTION**: Wait for each tool to complete before calling the next one"
#      "4. **PROPER CONFIRMATION**: After creating an event, confirm it was scheduled successfully"
#      "5. **ERROR HANDLING**: If any step fails, explain what went wrong clearly"
#      "\n\n"
#      "=== RESPONSE FORMAT ==="
#      "Always provide a complete, helpful response. Never end with incomplete tool calls or partial responses."
#     ),
#     ("user", "{input}"),
#     MessagesPlaceholder(variable_name="agent_scratchpad"),
# ])

prompt = ChatPromptTemplate.from_messages([
    ("system", 
     "You are an expert AI university navigator. You are acting on behalf of a user with the email: {user_email}. "
     "You MUST use this email for any tools that require a user_email parameter. "
     "Today's date is September 14, 2025. The user's timezone is 'Asia/Kolkata'."
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
     "\n1.  If the user asks about 'contests', 'leetcode', or 'codeforces', you MUST use the `contest_scanner_tool`. This tool returns a clean JSON list of all upcoming contests, ready for scheduling."
     "\n2.  If the user asks to schedule the contests, you MUST then call the `Calendar` tool for **EACH** event in the list returned by the scanner. You must loop through every contest and schedule all of them."
     "\n\n"
     "**CRITICAL RULE:** Do not explain your plan. Execute the necessary workflow from start to finish. If the user asks you to schedule events, your final response MUST be a confirmation that the events have been added to the calendar."
    ),
    ("user", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])


agent = create_openai_tools_agent(llm, tools, prompt)

agent_executor = AgentExecutor(
    agent=agent, 
    tools=tools, 
    verbose=True, 
    handle_parsing_errors=True,
    max_iterations=10,  # Reduced but sufficient iterations
    early_stopping_method="force",  # Force completion
    return_intermediate_steps=False
)

async def get_agent_response(user_input: str, user_email: str,config: dict = {}):
    try:
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
