import os
import httpx
from typing import Any

LATENODE_API_URL = os.getenv("LATENODE_API_URL", "")
LATENODE_API_KEY = os.getenv("LATENODE_API_KEY", "")


class LatenodeClient:
    """Client for triggering Latenode AI workflows via HTTP."""

    def __init__(self, api_url: str = LATENODE_API_URL, api_key: str = LATENODE_API_KEY):
        if not api_url:
            raise ValueError("LATENODE_API_URL is required")
        self.api_url = api_url.rstrip("/")
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"

    def trigger(self, payload: dict[str, Any] = {}) -> dict:
        """Send a payload to the Latenode webhook trigger URL."""
        with httpx.Client(timeout=30) as client:
            response = client.post(self.api_url, json=payload, headers=self.headers)
            response.raise_for_status()
            return response.json() if response.content else {}

    async def trigger_async(self, payload: dict[str, Any] = {}) -> dict:
        """Async version of trigger."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self.api_url, json=payload, headers=self.headers)
            response.raise_for_status()
            return response.json() if response.content else {}


if __name__ == "__main__":
    import json

    client = LatenodeClient()
    result = client.trigger({"message": "Hello from Python", "source": "latenode_client"})
    print(json.dumps(result, indent=2, ensure_ascii=False))
