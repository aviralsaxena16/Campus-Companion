# In backend/app/schemas/user.py
from pydantic import BaseModel, EmailStr
from datetime import datetime
class UserCreate(BaseModel):
    email: EmailStr

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    class Config:
        from_attributes = True

# ADD THIS NEW CLASS
class ConnectAccountRequest(BaseModel):
    user_email: EmailStr

class ImportantUpdateResponse(BaseModel):
    id: int
    title: str
    summary: str
    discovered_at: datetime
    class Config:
        from_attributes = True