# In backend/app/main.py

import asyncio
import sys

# THIS BLOCK MUST BE THE FIRST THING TO RUN IN YOUR APPLICATION
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# NOW, aFTER THE POLICY IS SET, WE CAN IMPORT EVERYTHING ELSE
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import chat
from app import models
from app.api.endpoints import chat, user, updates
from app.database import engine
from contextlib import asynccontextmanager

from app.services.scheduler_service import scheduler

# This creates the tables in your database when the app starts
models.Base.metadata.create_all(bind=engine)

# NEW LIFESPAN MANAGER
@asynccontextmanager
async def lifespan(app: FastAPI):
    # This code runs on startup
    print("Application startup: Starting scheduler...")
    scheduler.start()
    yield
    # This code runs on shutdown
    print("Application shutdown: Stopping scheduler...")
    scheduler.shutdown()

# Pass the lifespan manager to the FastAPI app
app = FastAPI(title="AI University Navigator API", lifespan=lifespan)

# THIS IS THE LINE THAT CREATES THE TABLES
# app = FastAPI(title="AI University Navigator API")

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
models.Base.metadata.create_all(bind=engine)

app.include_router(chat.router, prefix="/api")
app.include_router(user.router, prefix="/api")
app.include_router(updates.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Backend is connected and running!"}