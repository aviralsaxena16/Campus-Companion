from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
import os
import shutil
import tempfile
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from supabase.client import create_client, Client

app = FastAPI()

# --- Initialize Supabase and Embeddings ---
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
if not supabase_url or not supabase_key:
    raise ValueError("Supabase URL/Key not set in environment.")

supabase_client: Client = create_client(supabase_url, supabase_key)

print("Loading local embedding model (all-MiniLM-L6-v2)...")
# This runs on Vercel's 1GB+ memory
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
print("Local embedding model loaded.")
# ---

# This function will be served at POST /api/upload
@app.post("/")
async def upload_file(
    user_email: str = Form(...),
    file: UploadFile = File(...)
):
    temp_dir = tempfile.gettempdir()
    temp_file_path = None
    try:
        temp_file_path = os.path.join(temp_dir, file.filename)
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        loader = PyPDFLoader(temp_file_path)
        docs = loader.load()
        if not docs:
            return JSONResponse(status_code=400, content={"detail": "Could not load any content from the PDF."})

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        split_docs = text_splitter.split_documents(docs)

        contents = [doc.page_content for doc in split_docs]
        print(f"Embedding {len(contents)} chunks for user {user_email}...")
        doc_embeddings = embeddings.embed_documents(contents)

        data_to_insert = []
        for i, doc in enumerate(split_docs):
            data_to_insert.append({
                "user_id": user_email,
                "file_name": file.filename,
                "content": contents[i],
                "embedding": doc_embeddings[i],
                "metadata": doc.metadata
            })

        print(f"Storing {len(data_to_insert)} vectors in Supabase...")
        
        batch_size = 50
        for i in range(0, len(data_to_insert), batch_size):
            batch = data_to_insert[i:i + batch_size]
            response = supabase_client.table("documents").insert(batch).execute()
            if response.data is None:
                 raise Exception(f"Insert failed: {response.error.message if response.error else 'Unknown error'}")

        print(f"Successfully embedded and stored file {file.filename}.")
        
        return JSONResponse(
            status_code=200, 
            # Send back the original temp path as the "file_path"
            content={"file_path": temp_file_path, "message": "File processed and ready for questions."}
        )

    except Exception as e:
        print(f"Error during file processing: {e}")
        return JSONResponse(status_code=500, content={"detail": f"There was an error processing the file: {str(e)}"})
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)