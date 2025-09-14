# In backend/app/models.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime # Add ForeignKey, DateTime
from .database import Base
from sqlalchemy.sql import func # Add func

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    calendar_connected = Column(Boolean, default=False)

class ImportantUpdate(Base):
    __tablename__ = "important_updates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    source_id = Column(String, unique=True, index=True) # <-- ADD THIS LINE
    
    source = Column(String, default="email")
    title = Column(String)
    summary = Column(String)
    discovered_at = Column(DateTime(timezone=True), server_default=func.now())