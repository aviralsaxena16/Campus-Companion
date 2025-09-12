# In backend/app/agent/tools/web_scraper_tool.py

import json
from bs4 import BeautifulSoup
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

class ScraperInput(BaseModel):
    url: str = Field(description="The URL of the webpage to scrape for a timeline or event list")

class WebScraperTool(BaseTool):
    name: str = "web_scraper"
    description: str = "Useful for scraping a webpage to find a timeline or a list of events. It returns the data in a structured JSON format."
    args_schema: Type[BaseModel] = ScraperInput

    def _run(self, url: str):
        # This tool is async-only, so we raise an error in the sync method.
        raise NotImplementedError("This tool is async only.")

    async def _arun(self, url: str):
        """Asynchronously scrapes a webpage, handling dynamic content."""
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                )
                page = await context.new_page()
                await page.goto(url, timeout=20000)
                # Wait for a generic headline element as a sign of content loaded
                await page.wait_for_selector('h2', timeout=15000)
                html_content = await page.content()
                await browser.close()

                soup = BeautifulSoup(html_content, 'html.parser')
                
                # Attempt to parse specific structured data (example for GSOC)
                events = []
                timeline_items = soup.select('div.flex.justify-between.border-b.py-6') 
                for item in timeline_items:
                    date_tag = item.select_one('p.text-2xl')
                    title_tag = item.select_one('h3.text-2xl')
                    if date_tag and title_tag:
                        events.append({"date": date_tag.text.strip(), "title": title_tag.text.strip()})
                
                if events:
                    return json.dumps(events)
                
                # Fallback to returning raw text if specific structure isn't found
                text_content = soup.get_text(separator=' ', strip=True)
                return text_content[:4000]

        except PlaywrightTimeoutError:
            return json.dumps({"error": "The page took too long to load or a key element was not found."})
        except Exception as e:
            return json.dumps({"error": f"An unexpected error occurred: {e}"})