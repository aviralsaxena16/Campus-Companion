# In backend/app/models.py
from sqlalchemy import Column, Integer, String, Boolean # Add Boolean
from .database import Base
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    calendar_connected = Column(Boolean, default=False)