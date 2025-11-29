import json
from typing import Type, Dict, Any
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
import os
from dotenv import load_dotenv

# Load environment variables when module loads (safe)
load_dotenv()

class EventParserInput(BaseModel):
    text_to_parse: str = Field(
        description="A block of text that may contain event details."
    )

class EventParserTool(BaseTool):
    name: str = "event_parser_tool"
    description: str = (
        "Parses a block of text to extract structured event information "
        "(title, start_time, end_time, location, description). Returns a JSON "
        "object with event details that can be used directly for scheduling."
    )
    args_schema: Type[EventParserInput] = EventParserInput

    async def _arun(self, text_to_parse: str) -> str:  # Return JSON as string
        """
        This method lazy-loads the LLM so importing this module in tests
        does not require GOOGLE_API_KEY.
        """
        from langchain_google_genai import ChatGoogleGenerativeAI

        GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

        # If missing key, return safe response (important for pytest)
        if not GOOGLE_API_KEY:
            return json.dumps({"error": "GOOGLE_API_KEY not configured"})

        try:
            print(f"[DEBUG] Parsing text of length: {len(text_to_parse)}")

            llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=GOOGLE_API_KEY,
                temperature=0
            )

            parser_prompt = ChatPromptTemplate.from_template(
                "You are an expert event detail extractor. Analyze the text and extract event information. "
                "Today's date is September 14, 2025. Current year is 2025. User timezone is 'Asia/Kolkata'. "
                "Extract the FIRST upcoming event you find in the text.\n\n"
                "RULES:\n"
                "1. Times MUST be in ISO 8601 format: YYYY-MM-DDTHH:MM:SS\n"
                "2. If no end time mentioned, add 2 hours to start time\n"
                "3. If only a date is found with no time, assume 00:00\n"
                "4. If no location mentioned, use 'Online'\n"
                "5. Convert times to 24-hour format\n"
                "6. If any field missing, make it empty string\n\n"
                "Return ONLY a valid JSON object:\n"
                "{\n"
                "  title: string,\n"
                "  start_time: string,\n"
                "  end_time: string,\n"
                "  location: string,\n"
                "  description: string\n"
                "}\n"
                "If no event found, return {\"error\": \"No event found\"}\n\n"
                "Text:\n{text}\n\n"
                "JSON Response:"
            )

            chain = parser_prompt | llm
            response = await chain.ainvoke({"text": text_to_parse})

            response_text = getattr(response, "content", str(response))
            print(f"[DEBUG] Parser response: {response_text}")

            start = response_text.find("{")
            end = response_text.rfind("}") + 1

            if start != -1 and end > start:
                return response_text[start:end]

            return json.dumps({"error": "Could not extract JSON"})

        except Exception as e:
            print(f"[DEBUG] LLM ERROR: {e}")
            return json.dumps({"error": str(e)})

    def _run(self, text_to_parse: str) -> str:
        raise NotImplementedError("This tool is async only.")
