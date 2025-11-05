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
            
            return json_str
        
        raise ValueError("No valid JSON object found in response text")

    async def _arun(self, goal: str):
        parser_prompt = ChatPromptTemplate.from_template(
            "You are a world-class strategic advisor. Create a detailed roadmap for the user's goal.\n"
            "CRITICAL: Return ONLY a valid JSON object with this EXACT structure:\n"
            '{{\"goal\": \"[clear goal title]\", \"steps\": [{{\"title\": \"Step Name\", \"tasks\": [\"specific task 1\", \"specific task 2\", \"specific task 3\"]}}]}}\n\n'
            "REQUIREMENTS:\n"
            "- Use 'goal' and 'steps' as top-level keys (not 'title' and 'stages')\n"
            "- Each step must have 'title' and 'tasks' keys\n"
            "- Include 3-5 specific, actionable tasks per step\n"
            "- Make tasks concrete and measurable\n"
            "- Keep tasks concise (under 200 characters each)\n"
            "- Use only standard double quotes (\"), no smart quotes\n"
            "- No trailing commas\n"
            "- No markdown, no code fences, no explanations\n"
            "- Return ONLY the JSON object\n\n"
            "USER'S GOAL: {goal}\n\n"
            "JSON Response:"
        )
        chain = parser_prompt | llm

        try:
            response = await chain.ainvoke({"goal": goal})
            response_text = response.content
            
            # Clean and extract JSON
            cleaned_json = self._clean_json_response(response_text)
            
            # Try to parse the JSON
            try:
                parsed_json = json.loads(cleaned_json)
            except json.JSONDecodeError as e:
                # If parsing fails, try to fix common issues
                print(f"Initial JSON parse failed: {e}")
                print(f"Attempting to fix JSON...")
                
                # Try to find and fix the specific issue
                # Remove any control characters
                cleaned_json = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', cleaned_json)
                
                # Try parsing again
                parsed_json = json.loads(cleaned_json)
            
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
            
            return json.dumps(parsed_json, ensure_ascii=False, indent=2)
            
        except json.JSONDecodeError as e:
            print(f"JSON Decode Error: {e}")
            print(f"Response text (first 500 chars): {response_text[:500]}")
            
            error_response = {
                "goal": goal,
                "steps": [
                    {
                        "title": "JSON Parsing Error", 
                        "tasks": [
                            "The AI response couldn't be parsed as valid JSON.",
                            "Please try again or rephrase your request.",
                            f"Technical details: {str(e)}"
                        ]
                    }
                ],
                "error": "Invalid JSON response"
            }
            return json.dumps(error_response, ensure_ascii=False, indent=2)
            
        except Exception as e:
            print(f"General Error: {e}")
            print(f"Response text (first 500 chars): {response_text[:500] if 'response_text' in locals() else 'N/A'}")
            
            error_response = {
                "goal": goal,
                "steps": [
                    {
                        "title": "Generation Error", 
                        "tasks": [
                            "Failed to generate roadmap due to an unexpected error.",
                            "Please try again with a different request.",
                            f"Error: {str(e)}"
                        ]
                    }
                ],
                "error": f"Generation failed: {str(e)}"
            }
            return json.dumps(error_response, ensure_ascii=False, indent=2)

    def _run(self, goal: str):
        raise NotImplementedError("This tool is async only.")