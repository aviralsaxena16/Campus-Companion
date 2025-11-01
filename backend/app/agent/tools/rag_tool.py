import os
from typing import Type
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
import httpx # Make sure to add 'httpx' to backend/requirements.txt!

class DocumentQueryInput(BaseModel):
    file_path: str = Field(description="The file name of the PDF document to query.")
    query: str = Field(description="The question to ask about the document.")
    user_email: str = Field(description="The email of the user, e.g., 'user@example.com'.")

class DocumentQueryTool(BaseTool):
    name: str = "document_query_tool"
    description: str = "Use this tool to answer questions about a specific PDF document that the user has uploaded. You must provide the file_path, query, and user_email."
    args_schema: Type[DocumentQueryInput] = DocumentQueryInput

    async def _arun(self, file_path: str, query: str, user_email: str):
        """
        Calls the dedicated Vercel RAG server to perform the query.
        """
        try:
            vercel_url = os.getenv("VERCEL_URL")
            if not vercel_url:
                return "Error: VERCEL_URL is not set in the agent environment."

            # Calls https://campus-companion-six.vercel.app/api/query
            api_endpoint = f"{vercel_url}/api/query"
            payload = {
                "file_path": file_path,
                "query": query,
                "user_email": user_email
            }
            
            print(f"RAG Tool: Calling Vercel RAG server: {api_endpoint}")

            async with httpx.AsyncClient() as client:
                response = await client.post(api_endpoint, json=payload, timeout=60.0)
            
            response.raise_for_status()
            
            data = response.json()
            return data.get("answer", "No answer found from RAG server.")

        except httpx.HTTPStatusError as e:
            print(f"Error calling RAG server: {e.response.text}")
            return f"An error occurred while querying the document: {e.response.json().get('detail', 'Query API failed')}"
        except Exception as e:
            return f"An unexpected error occurred during RAG query: {str(e)}"
            
    def _run(self, file_path: str, query: str, user_email: str):
        raise NotImplementedError("This tool is async only.")