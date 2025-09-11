# In backend/app/main.py

from fastapi import FastAPI


app = FastAPI()

# Defiing a route for the root URL "/"
@app.get("/")
def read_root():
    return {"message": "Backend is running!"}


