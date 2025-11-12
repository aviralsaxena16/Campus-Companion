import json
import re
from typing import Type
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers.json import JsonOutputParser
import os
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash", 
    google_api_key=os.getenv("GOOGLE_API_KEY"), 
    temperature=0
)

class AdvisorInput(BaseModel):
    goal: str = Field(description="The user's goal to create a roadmap for (e.g., 'learn React', 'prepare for the SIH hackathon').")

class AdvisorTool(BaseTool):
    name: str = "advisor_tool"
    description: str = "Generates a structured, step-by-step roadmap for a user's goal, such as learning a new skill or preparing for an event. Use this when the user asks for a 'plan', 'roadmap', or 'how to prepare'."
    args_schema: Type[AdvisorInput] = AdvisorInput

    def _create_error_response(self, goal: str, error_msg: str) -> str:
        """Create a valid JSON error response"""
        error_response = {
            "goal": goal,
            "steps": [
                {
                    "title": "Generation Error",
                    "tasks": [
                        "Failed to generate roadmap. Please try again.",
                        f"Error: {error_msg}"
                    ]
                }
            ],
            "error": error_msg
        }
        # Return compact JSON without extra formatting
        return json.dumps(error_response, ensure_ascii=False)

    def _clean_json_response(self, response_text: str) -> str:
        """Clean and extract JSON from LLM response with better error handling"""
        response_text = response_text.strip()
        
        # Remove markdown fences
        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*$', '', response_text)
        response_text = response_text.strip()
        
        # Find the first '{' and the last '}'
        start_index = response_text.find('{')
        end_index = response_text.rfind('}')
        
        if start_index != -1 and end_index != -1 and end_index > start_index:
            json_str = response_text[start_index:end_index+1]
            
            # Fix common JSON issues
            # Replace smart quotes with regular quotes
            json_str = json_str.replace('"', '"').replace('"', '"')
            json_str = json_str.replace("'", "'").replace("'", "'")
            
            # Remove any trailing commas before closing brackets
            json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
            
            # Remove control characters
            json_str = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', json_str)
            
            return json_str
        
        raise ValueError("No valid JSON object found in response text")

    async def _arun(self, goal: str):
        parser_prompt = ChatPromptTemplate.from_template(
            "You are a world-class strategic advisor. Create a detailed roadmap for the user's goal.\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Return ONLY valid JSON - no explanations, no markdown, no extra text\n"
            "2. Use this EXACT structure:\n"
            '{{\n'
            '  "goal": "clear goal title",\n'
            '  "steps": [\n'
            '    {{\n'
            '      "title": "Step Name",\n'
            '      "tasks": ["task 1", "task 2", "task 3"]\n'
            '    }}\n'
            '  ]\n'
            '}}\n\n'
            "3. Requirements:\n"
            "   - Use 'goal' and 'steps' as top-level keys\n"
            "   - Each step MUST have 'title' (string) and 'tasks' (array of strings)\n"
            "   - Include 3-5 specific, actionable tasks per step\n"
            "   - Keep tasks under 150 characters each\n"
            "   - Use ONLY standard double quotes - no smart quotes\n"
            "   - NO trailing commas anywhere\n"
            "   - Escape any quotes inside string values with backslash\n"
            "   - NO markdown, NO code fences, NO preamble\n\n"
            "USER'S GOAL: {goal}\n\n"
            "Return only the JSON object:"
        )
        chain = parser_prompt | llm

        try:
            response = await chain.ainvoke({"goal": goal})
            response_text = response.content
            
            print(f"[AdvisorTool] Raw LLM response length: {len(response_text)}")
            print(f"[AdvisorTool] First 200 chars: {response_text[:200]}")
            
            # Clean and extract JSON
            try:
                cleaned_json = self._clean_json_response(response_text)
            except ValueError as e:
                print(f"[AdvisorTool] ❌ Failed to extract JSON: {e}")
                return self._create_error_response(goal, "Could not extract valid JSON from response")
            
            print(f"[AdvisorTool] Cleaned JSON length: {len(cleaned_json)}")
            
            # Try to parse the JSON
            try:
                parsed_json = json.loads(cleaned_json)
                print(f"[AdvisorTool] ✅ Successfully parsed JSON")
            except json.JSONDecodeError as e:
                print(f"[AdvisorTool] ❌ Initial JSON parse failed: {e}")
                print(f"[AdvisorTool] Attempting additional fixes...")
                
                # Additional aggressive fixes
                cleaned_json = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', cleaned_json)
                cleaned_json = re.sub(r"(\w)'(\w)", r"\1'\2", cleaned_json)
                
                # Try one more time
                try:
                    parsed_json = json.loads(cleaned_json)
                    print(f"[AdvisorTool] ✅ Successfully parsed after additional fixes")
                except json.JSONDecodeError as e2:
                    print(f"[AdvisorTool] ❌ Parse still failed: {e2}")
                    return self._create_error_response(goal, f"JSON parsing failed: {str(e2)}")
            
            # Normalize the structure
            if "goal" not in parsed_json:
                if "title" in parsed_json:
                    parsed_json["goal"] = parsed_json.pop("title")
                else:
                    parsed_json["goal"] = goal
            
            if "steps" not in parsed_json:
                if "stages" in parsed_json:
                    stages = parsed_json.pop("stages")
                    steps = []
                    for i, stage in enumerate(stages):
                        step = {
                            "title": stage.get("name", stage.get("title", f"Step {i+1}")),
                            "tasks": []
                        }
                        
                        # Collect tasks from various possible fields
                        for field in ["topics", "tasks", "content"]:
                            if field in stage and isinstance(stage[field], list):
                                step["tasks"].extend(stage[field])
                        
                        if "duration" in stage:
                            step["tasks"].insert(0, f"Duration: {stage['duration']}")
                        
                        if not step["tasks"]:
                            step["tasks"] = [f"Complete {step['title']}"]
                        
                        steps.append(step)
                    
                    parsed_json["steps"] = steps
                else:
                    parsed_json["steps"] = [
                        {
                            "title": "Getting Started",
                            "tasks": [f"Begin working on: {goal}"]
                        }
                    ]
            
            # Ensure steps is a list
            if not isinstance(parsed_json["steps"], list):
                parsed_json["steps"] = []
            
            # Clean up each step
            for step in parsed_json["steps"]:
                if not isinstance(step.get("tasks"), list):
                    step["tasks"] = []
                
                # Ensure all tasks are strings and not empty
                step["tasks"] = [
                    str(task).strip() 
                    for task in step["tasks"] 
                    if task and str(task).strip()
                ]
                
                if not step["tasks"]:
                    step["tasks"] = [f"Complete {step.get('title', 'this step')}"]
            
            # Return clean, compact JSON without pretty printing
                        # Return clean, compact JSON with wrapper
            result = json.dumps({"advisor_tool_response": parsed_json}, ensure_ascii=False)
            print(f"[AdvisorTool] ✅ Returning {len(parsed_json['steps'])} steps")
            return result

        except Exception as e:
            print(f"[AdvisorTool] ❌ Unexpected error: {e}")
            return self._create_error_response(goal, str(e))

    def _run(self, goal: str):
        raise NotImplementedError("This tool is async only.")