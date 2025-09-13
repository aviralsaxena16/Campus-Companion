# In backend/app/schemas/chat.py
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    user_email: str

class ChatResponse(BaseModel):
    response: str