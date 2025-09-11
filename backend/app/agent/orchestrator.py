# In backend/app/agent/orchestrator.py

from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
from langchain.schema.output_parser import StrOutputParser
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_agent_response(user_input: str):
    """
    A simple agent that uses an LLM to process and respond to user input.
    """
    # Initialize the language model
    llm = ChatGroq(
        model="deepseek-r1-distill-llama-70b",
        temperature=0,
        max_tokens=None,
        timeout=None,
        max_retries=2
    )


    # Create a prompt template
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant. Rephrase the user's message in a clear and concise way."),
        ("user", "{input}")
    ])

    # Create the processing chain
    chain = prompt | llm | StrOutputParser()

    # Invoke the chain with the user's input
    response = chain.invoke({"input": user_input})

    return response