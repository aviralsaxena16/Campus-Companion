# In backend/app/agent/orchestrator.py

import os
from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
from dotenv import load_dotenv

from app.agent.tools.web_scraper_tool import WebScraperTool
from app.agent.tools.calendar_tool import CreateCalendarEventTool
from app.agent.tools.gmail_reader_tool import GmailReaderTool

load_dotenv()

llm = ChatGroq(
        model="deepseek-r1-distill-llama-70b",
        temperature=0,
        max_tokens=None,
        timeout=None,
        max_retries=2
    )

# The agent now has access to all three tools
tools = [
    WebScraperTool(), 
    CreateCalendarEventTool(),
    GmailReaderTool()
]

# The final, expert-level prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", 
     "You are an expert AI university navigator, assisting a user in India. Your primary goal is to accurately find information, read relevant emails, and schedule events. "
     "Current year is 2025. Today's date is September 13, 2025."
     "\n\n"
     "CRITICAL INSTRUCTIONS FOR USING TOOLS:"
     "1. For the 'create_calendar_event' and 'read_gmail' tools, you MUST use the 'user_email' provided in the input. Do not ask the user for it."
     "2. Dates and times for calendar events MUST be in the strict ISO 8601 format: 'YYYY-MM-DDTHH:MM:SS'."
     "3. You MUST deduce the year. If not specified, assume the current year is 2025."
     "4. If an event's end time is not specified, you MUST assume it lasts for one (1) hour."
     "5. You MUST convert all times to the user's local timezone (assume 'Asia/Kolkata', which is UTC+05:30) before creating an event."
     "6. If a description for a calendar event is not available, you MUST use the event's title as the description."
     "7. After successfully completing an action, you MUST confirm this clearly. For example: 'I have successfully scheduled [Event Name] for you.' or 'I have found the following recent emails:'."
    ),
    ("user", "My email is {user_email}. My request is: {input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_openai_tools_agent(llm, tools, prompt)

agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True, handle_parsing_errors=True)

async def get_agent_response(user_input: str, user_email: str):
    """Processes user input through the agent executor asynchronously."""
    response = await agent_executor.ainvoke({
        "input": user_input,
        "user_email": user_email 
    })
    return response['output']