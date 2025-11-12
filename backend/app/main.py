import asyncio
import sys

# --- All asyncio patches are removed from this file ---

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import chat, user, updates
from app.database import engine
from app import models
from contextlib import asynccontextmanager
from app.services.scheduler_service import scheduler
from app.mail_classifier import router as mail_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Application startup: Creating database tables...")
    models.Base.metadata.create_all(bind=engine)
    print("Application startup: Starting scheduler...")
    scheduler.start()
    yield
    print("Application shutdown: Stopping scheduler...")
    scheduler.shutdown()

app = FastAPI(title="AI University Navigator API", lifespan=lifespan)

origins = [
    "https://campus-companion-six.vercel.app",
    "http://localhost:3000",
    
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Allows only these origins
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

app.include_router(chat.router, prefix="/api")
app.include_router(user.router, prefix="/api")
app.include_router(updates.router, prefix="/api")
app.include_router(mail_router, prefix="/api")

@app.api_route("/", methods=["GET", "HEAD"])
def read_root():
    return {"message": "Backend is connected and running!"}