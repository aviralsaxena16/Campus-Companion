# In backend/app/api/endpoints/user.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
# CORRECTED IMPORT: We now import the specific classes from the user schema file
from app.schemas.user import UserCreate, UserResponse
from app.database import SessionLocal

router = APIRouter()

# Dependency to get a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# The function now uses the directly imported schema classes
@router.post("/users/login", response_model=UserResponse)
def get_or_create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        return db_user
    # If not, create a new user
    new_user = models.User(email=user.email)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user