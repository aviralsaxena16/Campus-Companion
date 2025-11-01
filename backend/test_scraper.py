import asyncio
import sys

# --- PATCH IS REMOVED FROM HERE ---

from app.agent.tools.web_scraper_tool import WebScraperTool

# The test must now call the sync _run method
def main():
    tool = WebScraperTool()
    # We call .run() which is the sync entrypoint for BaseTool
    result = tool.run(url="https://sih.gov.in/") 
    print(result[:500])

if __name__ == "__main__":
    main() # No asyncio.run() needed