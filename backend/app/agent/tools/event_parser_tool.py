import json
from typing import Type, Dict, Any
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers.json import JsonOutputParser
import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
load_dotenv()
import os
from dotenv import load_dotenv
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY is not set!")
class EventParserInput(BaseModel):
    text_to_parse: str = Field(description="A block of text that may contain event details.")

class EventParserTool(BaseTool):
    name: str = "event_parser_tool"
    description: str = "Parses a block of text to extract structured event information (title, start_time, end_time, location, description). Returns a JSON object with event details that can be used directly for scheduling."
    args_schema: Type[EventParserInput] = EventParserInput

    async def _arun(self, text_to_parse: str) -> str:  # Return string instead of dict
        try:
            print(f"[DEBUG] Parsing text of length: {len(text_to_parse)}")  # Added debug logging
            
            llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)
            
            parser_prompt = ChatPromptTemplate.from_template(
                "You are an expert event detail extractor. Analyze the text and extract event information. "
                "Today's date is September 14, 2025. Current year is 2025. User timezone is 'Asia/Kolkata'. "
                "Extract the FIRST upcoming event you find in the text. "
                "\n\n"
                "RULES:\n"
                "1. Times MUST be in ISO 8601 format: YYYY-MM-DDTHH:MM:SS\n"
                "2. If no end time mentioned, add 2 hours to start time\n"
                "3. If only a date is found with no time, assume time as 00:00 and use ISO 8601 format.\n"
                "4. Times MUST be in ISO 8601 format: YYYY-MM-DDTHH:MM:SS\n"
                "5. If no location mentioned, use 'Online'\n"
                "6. Convert times to 24-hour format\n"
                "7. For contests/competitions, use the contest name as title\n"
                
                "\n"
                "Return ONLY a valid JSON object with these exact keys:\n"
                "- title: string\n"
                "- start_time: string (ISO 8601)\n"
                "- end_time: string (ISO 8601)\n"
                "- location: string\n"
                "- description: string\n"
                "\n"
                "6. If any of the field you not found then make it as empty string "
                "If no event found, return: {{\"error\": \"No event found\"}}\n"
                "\n"
                "Text to parse:\n{text}\n"
                "\n"
                "JSON Response:"
            )
            
            chain = parser_prompt | llm
            
            response = await chain.ainvoke({"text": text_to_parse})
            
            if hasattr(response, 'content'):
                response_text = response.content
            else:
                response_text = str(response)
            
            print(f"[DEBUG] Parser response: {response_text}")  # Added debug logging
            
            try:
                # Find JSON in the response
                start_idx = response_text.find('{')
                end_idx = response_text.rfind('}') + 1
                
                if start_idx != -1 and end_idx > start_idx:
                    json_str = response_text[start_idx:end_idx]
                    parsed_result = json.loads(json_str)
                    
                    # Validate required fields
                    if isinstance(parsed_result, dict) and 'title' in parsed_result:
                        print(f"[DEBUG] Successfully parsed event: {parsed_result.get('title')}")
                        return json.dumps(parsed_result)  # Return as JSON string
                    else:
                        return json.dumps({"error": "No valid event details found"})
                else:
                    return json.dumps({"error": "Could not extract JSON from response"})
                    
            except json.JSONDecodeError as e:
                print(f"[DEBUG] JSON decode error: {e}")
                return json.dumps({"error": f"Invalid JSON format: {str(e)}"})
                
        except Exception as e:
            error_message = f"Could not parse the text. Error: {str(e)}"
            print(f"[DEBUG] {error_message}")
            return json.dumps({"error": error_message})
            
    def _run(self, text_to_parse: str) -> str:  # Return string instead of dict
        raise NotImplementedError("This tool is async only.")
