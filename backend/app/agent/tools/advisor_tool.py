# In backend/app/agent/tools/advisor_tool.py
import json
import re
from typing import Type
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers.json import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
import os

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)

class AdvisorInput(BaseModel):
    goal: str = Field(description="The user's goal to create a roadmap for (e.g., 'learn React', 'prepare for the SIH hackathon').")

class AdvisorTool(BaseTool):
    name: str = "advisor_tool"
    description: str = "Generates a structured, step-by-step roadmap for a user's goal, such as learning a new skill or preparing for an event. Use this when the user asks for a 'plan', 'roadmap', or 'how to prepare'."
    args_schema: Type[AdvisorInput] = AdvisorInput

    def _clean_json_response(self, response_text: str) -> str:
        """Clean and extract JSON from LLM response"""
        # Remove markdown code fences
        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*$', '', response_text)
        response_text = response_text.strip()
        
        # Find JSON object boundaries
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            return json_match.group(0)
        
        return response_text

    async def _arun(self, goal: str):
        # <CHANGE> Updated prompt to be more explicit about JSON-only output
        parser_prompt = ChatPromptTemplate.from_template(
            "You are a world-class strategic advisor. Create a detailed roadmap for the user's goal.\n"
            "CRITICAL: Return ONLY a valid JSON object. No markdown, no explanations, no code fences, no extra text.\n"
            "Structure: {\"goal\": \"[goal title]\", \"steps\": [{\"title\": \"step name\", \"tasks\": [\"task1\", \"task2\"]}]}\n"
            "Each step should have 3-5 specific, actionable tasks.\n"
            "Make the goal title clear and specific.\n\n"
            "USER'S GOAL: {goal}\n\n"
            "Return only the JSON object:"
        )
        chain = parser_prompt | llm

        try:
            response = await chain.ainvoke({"goal": goal})
            response_text = response.content
            
            # Clean the response
            cleaned_json = self._clean_json_response(response_text)
            
            # Validate JSON by parsing it
            parsed_json = json.loads(cleaned_json)
            
            # Ensure required structure exists
            if "goal" not in parsed_json or "steps" not in parsed_json:
                raise ValueError("Missing required keys in response")
            
            # <CHANGE> Return the parsed JSON object directly, not as a string
            return parsed_json
            
        except json.JSONDecodeError as e:
            # <CHANGE> Return object instead of JSON string for consistency
            return {
                "error": "Invalid JSON response",
                "goal": goal,
                "steps": [{"title": "Error", "tasks": ["Failed to generate roadmap. Please try again."]}]
            }
        except Exception as e:
            # <CHANGE> Return object instead of JSON string for consistency
            return {
                "error": f"Generation failed: {str(e)}",
                "goal": goal,
                "steps": [{"title": "Error", "tasks": ["Unable to create roadmap. Please try again."]}]
            }

    def _run(self, goal: str):
        raise NotImplementedError("This tool is async only.")