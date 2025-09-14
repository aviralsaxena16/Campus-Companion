# In backend/app/agent/callbacks.py
import json
from typing import Any, Dict, List
from langchain.callbacks.base import AsyncCallbackHandler
from langchain.schema.agent import AgentAction, AgentFinish
from langchain.schema.messages import BaseMessage
from starlette.types import Send

class StreamingCallbackHandler(AsyncCallbackHandler):
    def __init__(self, send: Send):
        super().__init__()
        self.send = send

    async def on_chat_model_start(
        self, serialized: Dict[str, Any], messages: List[List[BaseMessage]], **kwargs: Any
    ) -> None:
        """Send a start message."""
        await self.send({
            "type": "http.response.body",
            "body": b"event: start\ndata: {}\n\n",
            "more_body": True,
        })

    async def on_agent_action(self, action: AgentAction, **kwargs: Any) -> Any:
        """Send the agent's action (tool call) to the frontend."""
        data = {
            "type": "action",
            "tool": action.tool,
            "tool_input": action.tool_input,
        }
        await self.send({
            "type": "http.response.body",
            "body": f"event: tool_start\ndata: {json.dumps(data)}\n\n".encode(),
            "more_body": True,
        })

    async def on_agent_finish(self, finish: AgentFinish, **kwargs: Any) -> Any:
        """Send the final answer to the frontend."""
        data = {"type": "finish", "output": finish.return_values["output"]}
        await self.send({
            "type": "http.response.body",
            "body": f"event: final_chunk\ndata: {json.dumps(data)}\n\n".encode(),
            "more_body": True,
        })

    async def on_llm_end(self, response, **kwargs) -> None:
        """Send a final end message."""
        await self.send({
            "type": "http.response.body",
            "body": b"event: end\ndata: {}\n\n",
            "more_body": False,
        })