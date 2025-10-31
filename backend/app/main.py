import asyncio
import sys

# THIS BLOCK MUST BE THE FIRST THING TO RUN
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# NOW, aFTER THE POLICY IS SET, WE CAN IMPORT EVERYTHING ELSE
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import chat, user, updates, files
from app.database import engine
from app import models
from contextlib import asynccontextmanager
from app.services.scheduler_service import scheduler

# NEW LIFESPAN MANAGER
@asynccontextmanager
async def lifespan(app: FastAPI):
    # This code runs on startup
    print("Application startup: Creating database tables...")
    models.Base.metadata.create_all(bind=engine)
    print("Application startup: Starting scheduler...")
    scheduler.start()
    yield
    # This code runs on shutdown
    print("Application shutdown: Stopping scheduler...")
    scheduler.shutdown()

# Pass the lifespan manager to the FastAPI app
app = FastAPI(title="AI University Navigator API", lifespan=lifespan)

origins = [
    "https://campus-companion-six.vercel.app",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")
app.include_router(user.router, prefix="/api")
app.include_router(updates.router, prefix="/api")
app.include_router(files.router, prefix="/api")

# --- THIS IS THE FIX ---
# Change @app.get("/") to @app.api_route(...)
# This will accept Render's "HEAD" health check
@app.api_route("/", methods=["GET", "HEAD"])
def read_root():
    return {"message": "Backend is connected and running!"}
