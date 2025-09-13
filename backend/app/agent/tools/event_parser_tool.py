# In backend/app/agent/tools/event_parser_tool.py
import json
from typing import Type
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers.json import JsonOutputParser
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
import os
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

class EventParserInput(BaseModel):
    text_to_parse: str = Field(description="A block of text, like an email body, that may contain event details.")

class EventParserTool(BaseTool):
    name: str = "event_parser_tool"
    description: str = "Parses a block of text to extract structured event information (title, start_time, end_time, location). Always use this tool to process text before attempting to schedule a calendar event."
    args_schema: Type[BaseModel] = EventParserInput

    def _run(self, text_to_parse: str):
        # We need to run the LLM chain to parse the text
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",  
            # you can also use gemini-pro, gemini-pro-vision etc depending on what your account supports
            temperature=0.7,
            google_api_key=GOOGLE_API_KEY
        )
                
        parser_prompt = ChatPromptTemplate.from_template(
            "You are an expert at extracting event details from unstructured text. "
            "Analyze the following text and extract the event information into a JSON object. "
            "Today's date is September 13, 2025. Assume the current year is 2025 if not specified. "
            "The user is in 'Asia/Kolkata' timezone. All times must be in ISO 8601 format (YYYY-MM-DDTHH:MM:SS). "
            "If an end time is not mentioned, assume a 1-hour duration. "
            "If you cannot find event details, return an empty JSON object. "
            "\n\nText to parse:\n{text}\n\n{format_instructions}"
        )
        
        json_parser = JsonOutputParser()
        
        chain = parser_prompt | llm | json_parser
        
        try:
            result = chain.invoke({
                "text": text_to_parse,
                "format_instructions": json_parser.get_format_instructions(),
            })
            return json.dumps(result)
        except Exception as e:
            return f"Could not parse the text. Error: {e}"

    async def _arun(self, text_to_parse: str):
        # Async implementation for consistency
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",  
            # you can also use gemini-pro, gemini-pro-vision etc depending on what your account supports
            temperature=0.7,
            google_api_key=GOOGLE_API_KEY
        )

        parser_prompt = ChatPromptTemplate.from_template(
             "You are an expert at extracting event details from unstructured text. "
            "Analyze the following text and extract the event information into a JSON object. "
            "Today's date is September 13, 2025. Assume the current year is 2025 if not specified. "
            "The user is in 'Asia/Kolkata' timezone. All times must be in ISO 8601 format (YYYY-MM-DDTHH:MM:SS). "
            "If an end time is not mentioned, assume a 1-hour duration. "
            "If a location is not mentioned, use 'TBD'."
            "If a description is not mentioned, use the event title."
            "\n\nText to parse:\n{text}\n\n{format_instructions}"
        )
        json_parser = JsonOutputParser()
        chain = parser_prompt | llm | json_parser
        try:
            result = await chain.ainvoke({
                "text": text_to_parse,
                "format_instructions": json_parser.get_format_instructions(),
            })
            return json.dumps(result)
        except Exception as e:
            return f"Could not parse the text. Error: {e}"