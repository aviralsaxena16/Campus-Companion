from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError # <-- Import this
from app import models
from app.schemas.user import UserResponse, UserCreate, StoreTokenRequest
from app.database import SessionLocal
from app.core.security import get_current_user, VerifiedUser

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/users/me", response_model=UserResponse)
async def read_users_me(
    user: VerifiedUser = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    
    if not db_user:
        try:
            # This is the "get-or-create" logic
            new_user = models.User(email=user.email, name=user.name)
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            return new_user
        except IntegrityError:
            # Handle the race condition: another request created the user
            # just moments ago. We roll back and fetch the existing user.
            db.rollback()
            db_user = db.query(models.User).filter(models.User.email == user.email).first()
            if not db_user:
                # This should be impossible, but as a fallback
                raise HTTPException(status_code=500, detail="Failed to get or create user.")
        
    return db_user

@router.post("/users/store_refresh_token", status_code=200)
async def store_refresh_token(
    request: StoreTokenRequest,
    user: VerifiedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
        
        if not db_user:
            # Handle case where this endpoint runs before /users/me
            new_user = models.User(
                email=user.email, 
                name=user.name, 
                google_refresh_token=request.refresh_token
            )
            db.add(new_user)
            db.commit()
            return {"message": "User created and refresh token stored."}

        # Normal operation: update existing user
        db_user.google_refresh_token = request.refresh_token
        db.commit()
        return {"message": "Refresh token stored successfully."}
        
    except IntegrityError:
        # Handle the race condition if /users/me is creating the user
        db.rollback()
        # The token will be stored on the *next* call if needed,
        # or the /users/me call might have already stored it.
        return {"message": "Race condition detected, operation rolled back. Please retry if needed."}
    except Exception as e:
        # Catch other potential errors
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

