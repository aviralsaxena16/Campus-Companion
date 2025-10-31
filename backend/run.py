import uvicorn
import asyncio
import sys
import os
import argparse

# This is the entry point of our application
if __name__ == "__main__":
    
    # We set the policy here, right at the start of execution.
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # 1. Check for command-line arguments
    parser = argparse.ArgumentParser(description="Run the FastAPI application.")
    parser.add_argument(
        "--prod",
        action="store_true",
        help="Run in production mode (disables reload, binds to 0.0.0.0)."
    )
    args = parser.parse_args()

    # 2. Check for environment variable
    # (This is what services like Render will use)
    app_env = os.getenv("APP_ENV", "development").lower()

    # 3. Determine if we are in production
    is_production = args.prod or (app_env == "production")

    if is_production:
        print("--- Starting server in PRODUCTION mode ---")
        reload = False
        host = "0.0.0.0"
        # Use the PORT environment variable if set (for Render/Vercel),
        # otherwise default to 8000
        port = int(os.getenv("PORT", 8000))
    else:
        print("--- Starting server in DEVELOPMENT mode (with reload) ---")
        reload = True
        host = "127.0.0.1"
        port = 8000

    # 4. Run the server with the correct settings
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload
    )