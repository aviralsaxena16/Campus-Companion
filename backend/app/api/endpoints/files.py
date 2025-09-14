# In backend/app/api/endpoints/files.py
import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter()

# Create a directory for temporary uploads
UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/files/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return {"file_path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"There was an error uploading the file: {e}")