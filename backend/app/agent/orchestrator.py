# In backend/app/agent/orchestrator.py

from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
from dotenv import load_dotenv
from app.agent.tools.web_scraper_tool import WebScraperTool
from app.agent.tools.calendar_tool import CreateCalendarEventTool 
# Import our new tool
from app.agent.tools.web_scraper_tool import WebScraperTool

load_dotenv()

# 1. Initialize the LLM
llm = ChatGroq(
        model="deepseek-r1-distill-llama-70b",
        temperature=0,
        max_tokens=None,
        timeout=None,
        max_retries=2
    )

# 2. Define the tools the agent can use
tools = [WebScraperTool(),CreateCalendarEventTool()]

# 3. Create a more sophisticated prompt
# This prompt tells the agent it has tools and how to think about using them.
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a powerful AI assistant. You have access to a set of tools to help you answer questions. Your job is to reason about the user's request and decide if a tool is needed."),
    ("user", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"), # This is where the agent's thought process and tool outputs will go
])

# 4. Create the tool-enabled agent
agent = create_openai_tools_agent(llm, tools, prompt)

# 5. Create the Agent Executor
# The executor is the runtime that makes the agent work. It calls the agent, gets back the chosen tool and input, runs the tool, and passes the result back to the agent.
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True) # verbose=True lets us see the agent's thoughts in the terminal


async def get_agent_response(user_input: str, user_email: str): # Add user_email
    """Processes user input through the agent executor asynchronously."""
    # We add the user_email to the input, so the agent knows who the user is
    response = await agent_executor.ainvoke({
        "input": user_input,
        "user_email": user_email 
    })
    return response['output']