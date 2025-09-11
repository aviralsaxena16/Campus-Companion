from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import chat  # Import the chat router

app = FastAPI(title="AI University Navigator API")

# Allowed origins (your frontend)
origins = [
    "http://localhost:3000",
]

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         # Only allow frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the chat router
app.include_router(chat.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Backend is connected and running!"}
