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
load_dotenv()


llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)

tools = [
    WebScraperTool(), 
    CreateCalendarEventTool(),
    GmailReaderTool(),
    EventParserTool(),
    DocumentQueryTool()
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
     "Today's date is September 14, 2025. The user's timezone is 'Asia/Kollkata'."
     "\n\n"
     "=== CORE WORKFLOWS ==="
     "\n"
     "**Workflow #1: Answering Questions from a Source**"
     "1. If the user asks a question about a webpage, use `web_scraper`."
     "2. If the user asks a question about emails, use `read_gmail`."
     "3. If the user's prompt contains a file path, it refers to an uploaded PDF. Use `document_query_tool` to answer questions about it."
     "\n"
     "**Workflow #2: Scheduling an Event from ANY Source (URL, Email, or PDF)**"
     "This is a strict three-step process you MUST follow every time:"
     "1.  **GET TEXT:**"
     "    - For a URL, use `web_scraper`."
     "    - For an email, use `read_gmail`."
     "    - For a PDF, use `document_query_tool` with the query 'Extract all event details from this document like title, date, time, and location'."
     "2.  **PARSE EVENT:** Take the text output from Step 1 and immediately pass it to the `event_parser_tool`. This will return a clean JSON for scheduling."
     "3.  **CREATE EVENT:** "
     "    - **IF** the parser returns a JSON object with a 'title' field, you MUST immediately call `Calendar`."
     "    - Use the exact values from the parser's JSON output."
     "    - You MUST add the `user_email` to the data before calling the tool."
     "    - **IF** the parser returns an error or empty JSON, you MUST stop and inform the user that you could not find any event details."
     "\n\n"
     "**CRITICAL RULE:** Do not explain your plan. Execute the tool chain and respond only with the final result."
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

async def get_agent_response(user_input: str, user_email: str):
    try:
        response = await agent_executor.ainvoke({
            "input": user_input,
            "user_email": user_email
        })
        
        output = response.get('output', '')
        if not output or output.strip().endswith('<tool_call>'):
            return "I've processed your request. Please check your calendar for the scheduled event."
        
        return output
        
    except Exception as e:
        return f"I encountered an error while processing your request: {str(e)}. Please try again or rephrase your request."
