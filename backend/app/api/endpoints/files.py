import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

# Import our security dependency
from app.core.security import get_current_user, VerifiedUser

router = APIRouter()

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    # This dependency secures the endpoint
    user: VerifiedUser = Depends(get_current_user)
):
    """
    Uploads a file for the RAG agent. Secured endpoint.
    """
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return {"file_path": file_path, "message": f"File uploaded as user {user.email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"There was an error uploading the file: {e}")

