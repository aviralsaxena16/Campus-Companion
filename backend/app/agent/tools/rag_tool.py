import os
from typing import Type
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from supabase.client import create_client, Client
from langchain_community.vectorstores import SupabaseVectorStore
# --- 1. Import Google Embeddings ---
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq

# LLM for answering
llm = ChatGroq(
    model_name="llama3-8b-8192", 
    groq_api_key=os.getenv("GROQ_API_KEY"), 
    temperature=0
)

# --- 2. Initialize Google Embeddings for the query ---
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001",
    google_api_key=os.getenv("GOOGLE_API_KEY")
)
# ---

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
supabase_client: Client = create_client(supabase_url, supabase_key)

# --- 3. Initialize Vector Store with Google Embeddings ---
vector_store = SupabaseVectorStore(
    client=supabase_client,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents"
)
# ---

class DocumentQueryInput(BaseModel):
    file_path: str = Field(description="The file name of the PDF document to query.")
    query: str = Field(description="The question to ask about the document.")
    user_email: str = Field(description="The email of the user, e.g., 'user@example.com'.")

class DocumentQueryTool(BaseTool):
    name: str = "document_query_tool"
    description: str = "Use this tool to answer questions about a specific PDF document that the user has uploaded. You must provide the file_path, query, and user_email."
    args_schema: Type[DocumentQueryInput] = DocumentQueryInput

    async def _arun(self, file_path: str, query: str, user_email: str):
        try:
            print(f"Querying for user '{user_email}' and file '{file_path}'")
            file_name = os.path.basename(file_path)

            retriever = vector_store.as_retriever(
                search_kwargs={'filter': {
                    'user_id': user_email,
                    'file_name': file_name
                }}
            )

            prompt = ChatPromptTemplate.from_template(
                "Answer the user's question based only on the following context:\n\n<context>{context}</context>\n\nQuestion: {input}"
            )
            document_chain = create_stuff_documents_chain(llm, prompt)
            retrieval_chain = create_retrieval_chain(retriever, document_chain)
            
            response = await retrieval_chain.ainvoke({"input": query})
            
            answer = response.get("answer", "I couldn't find an answer in the document.")
            if "I couldn't find an answer" in answer:
                docs = await retriever.ainvoke(query)
                if not docs:
                    return f"Error: No document found with the name '{file_name}' for this user. The file may not have been processed correctly."
            
            return answer
        except Exception as e:
            return f"An unexpected error occurred during RAG query: {e}"
            
    def _run(self, file_path: str, query: str, user_email: str):
        raise NotImplementedError("This tool is async only.")