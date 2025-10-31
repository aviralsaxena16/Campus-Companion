from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    
    # --- ADD THIS FIELD ---
    # The frontend (ChatSection) will now send the access token
    # in the body of the request so the agent can use it.
    access_token: str

class ChatResponse(BaseModel):
    response: str