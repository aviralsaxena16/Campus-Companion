# In backend/app/agent/tools/bulk_event_parser_tool.py
import json,os
from typing import Type
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
import os
from dotenv import load_dotenv
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY is not set!")

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)

class BulkParserInput(BaseModel):
    text_to_parse: str = Field(description="A large block of text that may contain multiple events or contests.")

class BulkEventParserTool(BaseTool):
    name: str = "bulk_event_parser_tool"
    description: str = "Parses a large block of text to extract a LIST of all upcoming events or contests. Use this after scanning a contest page."
    args_schema: Type[BulkParserInput] = BulkParserInput

    async def _arun(self, text_to_parse: str):
        # This prompt is specifically designed to extract a list of events
        parser_prompt = ChatPromptTemplate.from_template(
            "You are an expert event detail extractor. Analyze the text below and find ALL upcoming events or contests. "
            " The user is in 'Asia/Kolkata' timezone. "
            "Your output MUST be a valid JSON list of objects. Each object must have these exact keys: 'title', 'start_time', 'end_time', 'location', 'description'. "
            "RULES:"
            "\n- Times MUST be in ISO 8601 format: YYYY-MM-DDTHH:MM:SS"
            "\n- If no end time is mentioned, assume a 2-hour duration for contests."
            "\n- If no location is mentioned, use 'Online'."
            "\n- If you cannot find any events, you MUST return an empty JSON list: []"
            "\n\nText to parse:\n{text}\n\nJSON Response:"
        )
        
        chain = parser_prompt | llm
        
        try:
            response = await chain.ainvoke({"text": text_to_parse})
            response_text = response.content
            
            json_start = response_text.find('[')
            json_end = response_text.rfind(']') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                # Validate and return the list as a JSON string
                parsed_list = json.loads(json_str)
                return json.dumps(parsed_list)
            else:
                return json.dumps([])
        except Exception as e:
            return json.dumps({"error": f"Could not parse the text. Error: {e}"})
            
    def _run(self, text_to_parse: str):
        raise NotImplementedError("This tool is async only.")