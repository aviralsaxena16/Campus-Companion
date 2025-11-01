import json
import re
from typing import Type
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers.json import JsonOutputParser
import os
from langchain_google_genai import ChatGoogleGenerativeAI
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)

# ---

class AdvisorInput(BaseModel):
    goal: str = Field(description="The user's goal to create a roadmap for (e.g., 'learn React', 'prepare for the SIH hackathon').")

class AdvisorTool(BaseTool):
    name: str = "advisor_tool"
    description: str = "Generates a structured, step-by-step roadmap for a user's goal, such as learning a new skill or preparing for an event. Use this when the user asks for a 'plan', 'roadmap', or 'how to prepare'."
    args_schema: Type[AdvisorInput] = AdvisorInput

    # --- 2. Make the JSON cleaner more robust ---
    def _clean_json_response(self, response_text: str) -> str:
        """Clean and extract JSON from LLM response"""
        response_text = response_text.strip()
        
        # Remove markdown fences first
        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*$', '', response_text)
        response_text = response_text.strip()
        
        # Find the first '{' and the last '}'
        start_index = response_text.find('{')
        end_index = response_text.rfind('}')
        
        if start_index != -1 and end_index != -1 and end_index > start_index:
            return response_text[start_index:end_index+1]
        
        raise ValueError("No valid JSON object found in response text")
    # ---

    async def _arun(self, goal: str):
        parser_prompt = ChatPromptTemplate.from_template(
            "You are a world-class strategic advisor. Create a detailed roadmap for the user's goal.\n"
            "CRITICAL: Return ONLY a valid JSON object with this EXACT structure:\n"
            "{{{{\"goal\": \"[clear goal title]\", \"steps\": [{{{{\"title\": \"Step Name\", \"tasks\": [\"specific task 1\", \"specific task 2\", \"specific task 3\"]}}]}}}}\n\n"
            "REQUIREMENTS:\n"
            "- Use 'goal' and 'steps' as top-level keys (not 'title' and 'stages')\n"
            "- Each step must have 'title' and 'tasks' keys\n"
            "- Include 3-5 specific, actionable tasks per step\n"
            "- Make tasks concrete and measurable\n"
            "- No markdown, no code fences, no explanations\n"
            "- Return ONLY the JSON object\n\n"
            "USER'S GOAL: {goal}\n\n"
            "JSON Response:"
        )
        chain = parser_prompt | llm

        try:
            response = await chain.ainvoke({"goal": goal})
            response_text = response.content
            
            cleaned_json = self._clean_json_response(response_text)
            
            parsed_json = json.loads(cleaned_json)
            
            # --- Start of robust parsing logic ---
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
                        
                        if "topics" in stage:
                            step["tasks"].extend(stage["topics"])
                        if "tasks" in stage:
                            step["tasks"].extend(stage["tasks"])
                        if "content" in stage:
                            step["tasks"].extend(stage["content"])
                        
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
            
            if not isinstance(parsed_json["steps"], list):
                parsed_json["steps"] = []
            
            for step in parsed_json["steps"]:
                if not isinstance(step.get("tasks"), list):
                    step["tasks"] = []
                step["tasks"] = [str(task) for task in step["tasks"] if task]
                if not step["tasks"]:
                    step["tasks"] = [f"Complete {step.get('title', 'this step')}"]
            # --- End of robust parsing logic ---
            
            return json.dumps(parsed_json, ensure_ascii=False, indent=2)
            
        except json.JSONDecodeError as e:
            error_response = {
                "goal": goal,
                "steps": [
                    {
                        "title": "JSON Parsing Error", 
                        "tasks": [
                            "The AI response couldn't be parsed as valid JSON.",
                            "Please try rephrasing your request.",
                            f"Error details: {str(e)}",
                            f"Raw Response: {response_text[:200]}..." # Add raw response snippet
                        ]
                    }
                ],
                "error": "Invalid JSON response"
            }
            return json.dumps(error_response, ensure_ascii=False, indent=2)
            
        except Exception as e:
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
