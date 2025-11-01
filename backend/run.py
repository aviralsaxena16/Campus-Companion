import asyncio
import sys

# --- PATCH IS REMOVED FROM HERE ---

import uvicorn
import os
import argparse

if __name__ == "__main__":
    
    parser = argparse.ArgumentParser(description="Run the FastAPI application.")
    parser.add_argument(
        "--prod",
        action="store_true",
        help="Run in production mode (disables reload, binds to 0.0.0.0)."
    )
    args = parser.parse_args()

    app_env = os.getenv("APP_ENV", "development").lower()
    is_production = args.prod or (app_env == "production")

    if is_production:
        print("--- Starting server in PRODUCTION mode ---")
        reload = False
        host = "0.0.0.0"
        port = int(os.getenv("PORT", 8000))
    else:
        print("--- Starting server in DEVELOPMENT mode (with reload) ---")
        reload = True
        host = "127.0.0.1"
        port = 8000

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload
    )
