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
    ("system", 
     "You are a powerful AI university navigator. Your job is to help students by finding information and scheduling events. "
     "First, reason about the user's request to form a plan. "
     "Then, use your available tools to execute the plan step-by-step. "
     "After you have successfully used a tool to perform an action (like creating a calendar event), you MUST report that the action was completed successfully and concisely. "
     "Provide the key information in your final answer, for example: 'I have scheduled the [Event Name] for you.' "
     "Do not apologize or second-guess the output of your tools. State the successful outcome clearly."
    ),
    ("user", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# 4. Create the tool-enabled agent
agent = create_openai_tools_agent(llm, tools, prompt)

# 5. Create the Agent Executor
# The executor is the runtime that makes the agent work. It calls the agent, gets back the chosen tool and input, runs the tool, and passes the result back to the agent.
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True) # verbose=True lets us see the agent's thoughts in the terminal


async def get_agent_response(user_input: str):
    """
    Processes user input through the tool-enabled agent executor.
    """
    response = await agent_executor.ainvoke({
        "input": user_input
    })

    return response['output']