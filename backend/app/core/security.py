import os
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from google.oauth2 import id_token
from google.auth.transport import requests
from dotenv import load_dotenv

load_dotenv()

AUDIENCE_CLIENT_ID = os.getenv("GOOGLE_AUDIENCE_CLIENT_ID")

# This tells FastAPI to look for an "Authorization: Bearer <token>" header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") 

class VerifiedUser(BaseModel):
    """The verified user data we get from the Google token."""
    email: EmailStr
    name: str | None = None
    
async def get_current_user(token: str = Depends(oauth2_scheme)) -> VerifiedUser:
    """
    Dependency to verify the Google Access Token/ID Token and return user info.
    """
    if not AUDIENCE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_AUDIENCE_CLIENT_ID is not configured on the server."
        )

    try:
        # First, try to validate it as an ID Token.
        # next-auth may send the ID token as the access token.
        try:
            id_info = id_token.verify_oauth2_token(
                token, 
                requests.Request(), 
                AUDIENCE_CLIENT_ID
            )
            email = id_info.get("email")
            name = id_info.get("name")
            
        except ValueError:
            # If it's not an ID token, it's an Access Token.
            # We validate it by calling the 'tokeninfo' endpoint.
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/oauth2/v3/tokeninfo",
                    params={"access_token": token}
                )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google access token."
                )
                
            token_data = response.json()
            
            token_audience = token_data.get("aud")
            if token_audience != AUDIENCE_CLIENT_ID:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"403: Invalid audience. Token was not issued for this app."
                )
            
            email = token_data.get("email")
            name = token_data.get("name") # Name may not be present in this flow

        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not extract email from token."
            )
            
        return VerifiedUser(email=email, name=name)

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal error occurred: {str(e)}"
        )