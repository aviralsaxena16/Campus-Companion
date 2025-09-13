# In backend/run.py

import uvicorn
import asyncio
import sys

# This is the entry point of our application
if __name__ == "__main__":
    
    # We set the policy here, right at the start of execution.
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # CHANGE IS HERE: Run without the reloader
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)