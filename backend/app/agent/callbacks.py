# In backend/app/agent/callbacks.py
import json
from typing import Any, Dict, List
from langchain.callbacks.base import AsyncCallbackHandler
from langchain.schema.agent import AgentAction, AgentFinish
from langchain.schema.messages import BaseMessage
import asyncio

class StreamingCallbackHandler(AsyncCallbackHandler):
    def __init__(self, queue: asyncio.Queue):
        super().__init__()
        self.queue = queue

    async def on_chat_model_start(
        self, serialized: Dict[str, Any], messages: List[List[BaseMessage]], **kwargs: Any
    ) -> None:
        """Used to signal the start of the stream."""
        await self.queue.put(f"event: start\ndata: ...\n\n")

    async def on_agent_action(self, action: AgentAction, **kwargs: Any) -> Any:
        """Send the agent's action (tool call) to the frontend."""
        data = { "tool": action.tool, "tool_input": action.tool_input }
        await self.queue.put(f"event: tool_start\ndata: {json.dumps(data)}\n\n")

    async def on_tool_end(self, output: str, **kwargs: Any) -> Any:
        """Send the tool's output to the frontend."""
        data = { "output": output }
        await self.queue.put(f"event: tool_end\ndata: {json.dumps(data)}\n\n")

    async def on_agent_finish(self, finish: AgentFinish, **kwargs: Any) -> Any:
        """Send the final answer to the frontend."""
        data = { "output": finish.return_values["output"] }
        await self.queue.put(f"event: final_chunk\ndata: {json.dumps(data)}\n\n")