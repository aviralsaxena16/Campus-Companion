# In backend/app/agent/tools/contest_scanner_tool.py
import httpx
import json
import asyncio
import os
from typing import Type, Optional, List, Dict, Any
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables to get the new API key
load_dotenv()

class ContestScannerInput(BaseModel):
    site_name: Optional[str] = Field(description="Optional. The specific contest site to scan. Can be 'leetcode' or 'codeforces'. If not provided, both will be scanned.")

class ContestScannerTool(BaseTool):
    name: str = "contest_scanner_tool"
    description: str = "Scans LeetCode and Codeforces for upcoming contests using reliable APIs."
    args_schema: Type[ContestScannerInput] = ContestScannerInput

    async def _fetch_leetcode(self) -> List[Dict[str, Any]]:
        api_url = "https://clist.by/api/v4/contest/"
        
        # --- CHANGE: Load the API key from your .env file ---
        api_key = os.getenv("CLIST_API_KEY")
        if not api_key:
            return [{"error": "CList API key not found in .env file."}]
        
        headers = {"Authorization": api_key}
        params = {
            "resource": "leetcode.com",
            "start__gte": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
            "order_by": "start"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                # --- CHANGE: Pass the headers to the request ---
                response = await client.get(api_url, headers=headers, params=params, timeout=15)
                response.raise_for_status()
                data = response.json()
            
            contests = data.get('objects', [])
            formatted = []
            for c in contests:
                start = datetime.fromisoformat(c['start'].replace('Z', '+00:00'))
                end = datetime.fromisoformat(c['end'].replace('Z', '+00:00'))
                formatted.append({
                    "title": c['event'], "start_time": start.isoformat(), "end_time": end.isoformat(),
                    "location": "Online", "description": f"LeetCode Contest. Register at: {c['href']}"
                })
            return formatted
        except Exception as e:
            print(f"Error fetching LeetCode from CList.by: {e}")
            return []

    async def _fetch_codeforces(self) -> List[Dict[str, Any]]:
        api_url = "https://codeforces.com/api/contest.list?gym=false"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(api_url, timeout=10)
                response.raise_for_status()
                data = response.json()
            if data.get('status') != 'OK': return []
            
            contests = [c for c in data.get('result', []) if c.get('phase') == 'BEFORE']
            formatted = []
            for c in contests:
                start = datetime.fromtimestamp(c['startTimeSeconds'])
                end = start + timedelta(seconds=c['durationSeconds'])
                formatted.append({
                    "title": c['name'], "start_time": start.isoformat(), "end_time": end.isoformat(),
                    "location": "Online", "description": f"Codeforces Contest. Type: {c['type']}"
                })
            return formatted
        except Exception as e:
            print(f"Error fetching Codeforces: {e}")
            return []

    async def _arun(self, site_name: Optional[str] = None):
        tasks = []
        if site_name:
            site = site_name.lower()
            if site == 'leetcode':
                tasks.append(self._fetch_leetcode())
            elif site == 'codeforces':
                tasks.append(self._fetch_codeforces())
        else:
            tasks.append(self._fetch_leetcode())
            tasks.append(self._fetch_codeforces())
        
        results = await asyncio.gather(*tasks)
        all_contests = [contest for sublist in results for contest in sublist]
        sorted_contests = sorted(all_contests, key=lambda x: x['start_time'])
        return json.dumps(sorted_contests)

    def _run(self, site_name: Optional[str] = None):
        raise NotImplementedError("This tool is async only.")