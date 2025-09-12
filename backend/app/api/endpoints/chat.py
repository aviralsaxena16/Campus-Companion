# In backend/app/api/endpoints/chat.py
from fastapi import APIRouter
from app.schemas.chat import ChatRequest, ChatResponse
from app.agent.orchestrator import get_agent_response

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def handle_chat(request: ChatRequest):
    # FIX: Add 'await' here
    agent_message = await get_agent_response(request.message)
    return ChatResponse(response=agent_message)