import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.core.security import get_current_user, VerifiedUser

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
# --- 1. Use Google's Embedding model ---
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from supabase.client import create_client, Client

router = APIRouter()

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
if not supabase_url or not supabase_key:
    raise ValueError("Supabase URL/Key not set in environment.")

supabase_client: Client = create_client(supabase_url, supabase_key)

# --- 2. Initialize the Google Embedding model ---
# This runs on Google's servers and uses 0 of your server's RAM.
google_embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001",
    google_api_key=os.getenv("GOOGLE_API_KEY")
)
# ---

vector_store = SupabaseVectorStore(
    client=supabase_client,
    embedding=google_embeddings, # <-- 3. Use the Google model
    table_name="documents",
    query_name="match_documents"
)

@router.post("/files/upload")
async def upload_file(
    user: VerifiedUser = Depends(get_current_user),
    file: UploadFile = File(...)
):
    temp_file_path = None
    try:
        temp_file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"File saved temporarily to {temp_file_path}")

        loader = PyPDFLoader(temp_file_path)
        docs = loader.load()
        if not docs:
            raise HTTPException(status_code=400, detail="Could not load any content from the PDF.")

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        split_docs = text_splitter.split_documents(docs)
        
        contents = [doc.page_content for doc in split_docs]
        
        # --- 4. Get embeddings from Google's API ---
        print(f"Embedding {len(contents)} chunks for user {user.email} via Google API...")
        doc_embeddings = google_embeddings.embed_documents(contents)
        # ---
        
        data_to_insert = []
        for i, doc in enumerate(split_docs):
            data_to_insert.append({
                "user_id": user.email,
                "file_name": file.filename,
                "content": contents[i],
                "embedding": doc_embeddings[i],
                "metadata": doc.metadata
            })

        print(f"Storing {len(data_to_insert)} vectors in Supabase...")
        
        batch_size = 50
        for i in range(0, len(data_to_insert), batch_size):
            batch = data_to_insert[i:i + batch_size]
            print(f"Inserting batch {i // batch_size + 1} ({len(batch)} chunks)...")
            response = supabase_client.table("documents").insert(batch).execute()
            
            if response.data is None:
                 raise Exception(f"Insert failed: {response.error.message if response.error else 'Unknown error'}")

        print(f"Successfully embedded and stored file {file.filename}.")
        
        return {"file_path": temp_file_path, "message": "File processed and ready for questions."}

    except Exception as e:
        print(f"Error during file processing: {e}")
        raise HTTPException(status_code=500, detail=f"There was an error processing the file: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            print(f"Removed temp file: {temp_file_path}")