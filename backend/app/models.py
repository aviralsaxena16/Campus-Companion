from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from .database import Base
from sqlalchemy.sql import func

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String, nullable=True) 
    
    # --- THIS IS THE CRITICAL FIX ---
    # We must store the refresh token for background scheduler tasks
    google_refresh_token = Column(String, nullable=True)

class ImportantUpdate(Base):
    __tablename__ = "important_updates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    source_id = Column(String, unique=True, index=True) 
    
    source = Column(String, default="email")
    title = Column(String)
    summary = Column(String)
    discovered_at = Column(DateTime(timezone=True), server_default=func.now())