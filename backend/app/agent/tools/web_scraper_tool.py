import httpx  # <-- NEW: Replaces Playwright
from bs4 import BeautifulSoup
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type

# NOTE: We have removed all 'asyncio' and 'playwright' imports

class ScraperInput(BaseModel):
    url: str = Field(description="The URL of the webpage to scrape for content.")

class WebScraperTool(BaseTool):
    name: str = "web_scraper"
    description: str = (
        "Useful for scraping a webpage to find its text content. "
        "It returns the cleaned text that can be parsed for information. "
        "This tool is synchronous and does not use asyncio."
    )
    args_schema: Type[ScraperInput] = ScraperInput

    def _run(self, url: str):
        """Synchronously scrapes a webpage using httpx and BeautifulSoup."""
        try:
            print(f"[DEBUG] Scraping URL (sync with httpx): {url}")
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                              'AppleWebKit/537.36 (KHTML, like Gecko) '
                              'Chrome/91.0.4472.124 Safari/537.36'
            }

            # Use httpx.Client for a sync request
            with httpx.Client(headers=headers, follow_redirects=True, timeout=30.0) as client:
                response = client.get(url)
                response.raise_for_status() # Raise error for 4xx/5xx
                html_content = response.text

            soup = BeautifulSoup(html_content, "html.parser")

            # Remove all script, style, nav, footer, header, and aside tags
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()

            raw_text = soup.get_text(separator=" ", strip=True)
            lines = [line.strip() for line in raw_text.split("\n") if len(line.strip()) > 3]
            cleaned_text = "\n".join(lines)[:5000]

            print(f"[DEBUG] Scraped {len(cleaned_text)} characters")
            return cleaned_text

        except httpx.HTTPStatusError as e:
            msg = f"Error: HTTP error occurred while scraping: {e.response.status_code}"
            print(f"[DEBUG] {msg}")
            return msg
        except Exception as e:
            msg = f"Error: An unexpected error occurred while scraping: {str(e)}"
            print(f"[DEBUG] {msg}")
            return msg

    # We do not need _arun, the agent will run _run in a thread
