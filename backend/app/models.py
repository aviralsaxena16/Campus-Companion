from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime 
from sqlalchemy.orm import relationship
from .database import Base
from sqlalchemy.sql import func 

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    
    # Relationship to updates
    updates = relationship("ImportantUpdate", back_populates="user")

class ImportantUpdate(Base):
    __tablename__ = "important_updates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Email identification
    source_id = Column(String, unique=True, index=True, nullable=False)
    source = Column(String, default="email")
    
    # Classification results
    title = Column(String, nullable=False)  # Format: "[LABEL] Subject..."
    summary = Column(String, nullable=False)
    
    # Timestamps
    discovered_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Importance flag (for filtering)
    is_important = Column(Boolean, default=True, nullable=False)
    
    # Relationship back to user
    user = relationship("User", back_populates="updates")

# Optional: Feedback table for active learning
class Feedback(Base):
    __tablename__ = "feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    update_id = Column(Integer, ForeignKey("important_updates.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    is_correct = Column(Boolean, nullable=False)  # True = correct, False = incorrect
    predicted_label = Column(String, nullable=True)  # The label that was shown
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())