"""Google Calendar — Nango proxy + local fallback."""

import datetime
import json
import os
import urllib.parse

from fastapi import APIRouter
from app.db import query

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"
NANGO_BASE = "https://api.nango.dev"


@router.get("/calendar/events")
async def get_calendar_events(month: str = ""):
    if not month:
        month = datetime.datetime.now().strftime("%Y-%m")

    year, mon = month.split("-")
    time_min = f"{month}-01T00:00:00+09:00"
    last_day = (datetime.date(int(year), int(mon), 1) + datetime.timedelta(days=32)).replace(day=1) - datetime.timedelta(days=1)
    time_max = f"{month}-{last_day.day}T23:59:59+09:00"

    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return _local_fallback()

    import httpx
    connection_id = ""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{NANGO_BASE}/connections", headers={"Authorization": f"Bearer {secret}"}, timeout=10)
            conns = resp.json().get("connections", [])
            match = next((c for c in conns if c.get("provider_config_key") == "google-calendar"), None)
            if match:
                connection_id = match["connection_id"]
        except Exception:
            pass

    if not connection_id:
        return _local_fallback()

    endpoint = f"/calendar/v3/calendars/primary/events?timeMin={urllib.parse.quote(time_min)}&timeMax={urllib.parse.quote(time_max)}&singleEvents=true&orderBy=startTime&maxResults=100"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.request(
                "GET", f"{NANGO_BASE}/proxy{endpoint}",
                headers={"Authorization": f"Bearer {secret}", "Connection-Id": connection_id, "Provider-Config-Key": "google-calendar"},
                timeout=15,
            )
            data = resp.json()
        except Exception as e:
            return {"events": [], "error": str(e)}

    events = []
    for item in data.get("items", []):
        start = item.get("start", {})
        end = item.get("end", {})
        if "dateTime" in start:
            date = start["dateTime"][:10]
            start_time = start["dateTime"][11:16]
            end_time = end.get("dateTime", "")[11:16] if "dateTime" in end else ""
        else:
            date = start.get("date", "")
            start_time = end_time = ""

        events.append({
            "id": item.get("id", ""), "title": item.get("summary", ""),
            "description": item.get("description", ""), "date": date,
            "startTime": start_time, "endTime": end_time, "type": "meeting",
        })
    return {"events": events, "source": "google"}


def _local_fallback():
    rows = query(
        "SELECT id, data FROM data_store WHERE collection = 'calendar_events' AND user_id = %s ORDER BY created_at DESC",
        (DEV_USER_ID,)
    )
    entries = []
    for r in rows:
        d = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        d["_id"] = r["id"]
        entries.append(d)
    return {"events": entries, "source": "local"}
