from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os

from langchain_community.vectorstores import SupabaseVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from supabase.client import create_client, Client
from langchain_google_genai import ChatGoogleGenerativeAI

# Vercel looks for this 'app' variable
app = FastAPI()

# --- Initialize everything ---
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
supabase_client: Client = create_client(supabase_url, supabase_key)
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)


print("Query API: Loading local embedding model...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
print("Query API: Local embedding model loaded.")

vector_store = SupabaseVectorStore(
    client=supabase_client,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents"
)
# ---

class QueryRequest(BaseModel):
    file_path: str
    query: str
    user_email: str

# This function will be served at POST /api/query
@app.post("/")
async def query_document(request: QueryRequest):
    try:
        file_name = os.path.basename(request.file_path)
        print(f"Querying for user '{request.user_email}' and file '{file_name}'")

        retriever = vector_store.as_retriever(
            search_kwargs={'filter': {
                'user_id': request.user_email,
                'file_name': file_name
            }}
        )

        prompt = ChatPromptTemplate.from_template(
            "Answer the user's question based only on the following context:\n\n<context>{context}</context>\n\nQuestion: {input}"
        )
        document_chain = create_stuff_documents_chain(llm, prompt)
        retrieval_chain = create_retrieval_chain(retriever, document_chain)
        
        response = await retrieval_chain.ainvoke({"input": request.query})
        
        answer = response.get("answer", "I couldn't find an answer in the document.")
        if "I couldn't find an answer" in answer:
            docs = await retriever.ainvoke(request.query)
            if not docs:
                return {"answer": f"Error: No document found with the name '{file_name}' for this user."}
        
        return {"answer": answer}
    except Exception as e:
        print(f"Error during RAG query: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during RAG query: {str(e)}")