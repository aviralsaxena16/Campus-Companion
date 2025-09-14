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
    description: str = "Useful for scraping a webpage to find a timeline or a list of events. It returns the scraped text content that can be parsed for event information."
    args_schema: Type[BaseModel] = ScraperInput

    def _run(self, url: str):
        raise NotImplementedError("This tool is async only.")

    async def _arun(self, url: str):
        """Asynchronously scrapes a webpage, handling dynamic content."""
        try:
            print(f"[DEBUG] Scraping URL: {url}")  # Added debug logging
            
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                )
                page = await context.new_page()
                await page.goto(url, timeout=30000)  # Increased timeout
                
                try:
                    await page.wait_for_selector('body', timeout=10000)
                    await page.wait_for_load_state('networkidle', timeout=15000)
                except:
                    pass  # Continue even if waiting fails
                
                html_content = await page.content()
                await browser.close()

                soup = BeautifulSoup(html_content, 'html.parser')
                
                # Remove script and style elements
                for script in soup(["script", "style", "nav", "footer", "header"]):  # Remove more noise
                    script.decompose()
                
                # Get text content
                raw_text = soup.get_text(separator=' ', strip=True)
                
                lines = raw_text.split('\n')
                cleaned_lines = [line.strip() for line in lines if line.strip() and len(line.strip()) > 3]
                cleaned_text = '\n'.join(cleaned_lines)
                
                # Return first 5000 characters to avoid token limits
                result = cleaned_text[:5000]
                print(f"[DEBUG] Scraped {len(result)} characters")  # Added debug logging
                return result

        except PlaywrightTimeoutError:
            error_message = "Error: The page took too long to load or a key element was not found."
            print(f"[DEBUG] {error_message}")  # Added debug logging
            return error_message
        except Exception as e:
            error_message = f"Error: An unexpected error occurred while scraping: {str(e)}"
            print(f"[DEBUG] {error_message}")  # Added debug logging
            return error_message
