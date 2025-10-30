from fastapi import APIRouter, Depends
from app.schemas.chat import ChatRequest, ChatResponse
from app.agent.orchestrator import get_agent_response
from fastapi.responses import StreamingResponse
from app.agent.callbacks import StreamingCallbackHandler
import asyncio

# --- THIS IS THE FIX ---
# We removed 'get_google_access_token' as it doesn't exist.
# We only import get_current_user for endpoint security.
from app.core.security import get_current_user, VerifiedUser
# ---

router = APIRouter()

@router.post("/chat/stream")
async def chat_stream(
    # The request body now contains 'message' AND 'access_token'
    chat_request: ChatRequest,
    # This dependency secures the endpoint using the token in the HEADER
    user: VerifiedUser = Depends(get_current_user) 
):
    queue = asyncio.Queue()
    callback = StreamingCallbackHandler(queue=queue)

    async def agent_task():
        try:
            # Pass the token from the BODY to the agent
            await get_agent_response(
                user_input=chat_request.message,
                user_email=user.email,
                access_token=chat_request.access_token, # <-- Use the token from the body
                config={"callbacks": [callback]}
            )
        except Exception as e:
            error_message = f"event: tool_end\ndata: {{\"output\": \"An error occurred: {e}\"}}\n\n"
            await queue.put(error_message)
        finally:
            await queue.put("event: end\ndata: {}\n\n")

    asyncio.create_task(agent_task())
    
    async def stream_generator():
        while True:
            data = await queue.get()
            yield data
            if data == "event: end\ndata: {}\n\n":
                break
    
    return StreamingResponse(stream_generator(), media_type="text/event-stream")