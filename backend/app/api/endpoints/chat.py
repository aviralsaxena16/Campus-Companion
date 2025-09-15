# In backend/app/api/endpoints/chat.py
from fastapi import APIRouter
from app.schemas.chat import ChatRequest, ChatResponse
from app.agent.orchestrator import get_agent_response
from fastapi import Request
from fastapi.responses import StreamingResponse
from app.agent.callbacks import StreamingCallbackHandler
import asyncio

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def handle_chat(request: ChatRequest):
    # Pass the email to the agent
    agent_message = await get_agent_response(request.message, request.user_email)
    return ChatResponse(response=agent_message)

@router.post("/chat/stream")
async def chat_stream(chat_request: ChatRequest):
    queue = asyncio.Queue()
    callback = StreamingCallbackHandler(queue=queue)

    async def agent_task():
        # This is where the agent execution is started for the stream
        await get_agent_response(
            user_input=chat_request.message,
            user_email=chat_request.user_email,
            config={"callbacks": [callback]} # Pass the callback here
        )
        await queue.put("event: end\ndata: {}\n\n")

    # Start the agent execution in the background
    asyncio.create_task(agent_task())
    
    async def stream_generator():
        while True:
            data = await queue.get()
            yield data
            if data == "event: end\ndata: {}\n\n":
                break
    
    return StreamingResponse(stream_generator(), media_type="text/event-stream")