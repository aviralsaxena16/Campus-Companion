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

# @router.post("/chat/stream")
# async def chat_stream(chat_request: ChatRequest, request: Request):
#     async def stream_generator():
#         # A queue to hold the data chunks
#         queue = asyncio.Queue()

#         # Custom send function to put data into the queue
#         async def send(data):
#             await queue.put(data)

#         # Create the callback handler with our custom send function
#         callback = StreamingCallbackHandler(send=send)
        
#         # Start the agent execution in the background
#         asyncio.create_task(
#             agent_executor.ainvoke(
#                 {"input": chat_request.message, "user_email": chat_request.user_email},
#                 config={"callbacks": [callback]}
#             )
#         )

#         # Yield data chunks from the queue as they arrive
#         while True:
#             data = await queue.get()
#             yield data["body"]
#             if not data.get("more_body"):
#                 break

#     return StreamingResponse(stream_generator(), media_type="text/event-stream")