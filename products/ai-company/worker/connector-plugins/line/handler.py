"""
LINE Connector Handler

Self-contained handler for LINE webhook processing, signature verification,
message sending, and agent environment configuration.
"""

import base64
import hmac
import hashlib
import json
import time
import os
import urllib.request
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "app"))
from connector_base import ConnectorHandler


class Handler(ConnectorHandler):
    """LINE Official Account connector handler."""

    async def receive_webhook(self, request) -> dict:
        """
        Verify LINE signature, parse events, and write messages to queue.jsonl.
        Handles text and image message types.
        """
        channel_secret = self.config.get("channelSecret", "")
        access_token = self.config.get("accessToken", "")

        body = await request.body()
        signature = request.headers.get("x-line-signature", "")

        # HMAC-SHA256 signature verification
        expected = base64.b64encode(
            hmac.HMAC(channel_secret.encode(), body, hashlib.sha256).digest()
        ).decode()
        if not hmac.compare_digest(signature, expected):
            return {"error": "Invalid signature"}

        data = json.loads(body)
        inbox_dir = Path(f"/workspace/data/connectors/{self.connector_id}/inbox")
        inbox_dir.mkdir(parents=True, exist_ok=True)

        for event in data.get("events", []):
            if event.get("type") != "message":
                continue

            user_id = event.get("source", {}).get("userId", "unknown")
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")
            msg_type = event.get("message", {}).get("type", "")

            if msg_type == "text":
                entry = json.dumps({
                    "timestamp": timestamp,
                    "userId": user_id,
                    "message": event["message"]["text"],
                    "connectorId": self.connector_id,
                }, ensure_ascii=False) + "\n"
                with open(inbox_dir / "queue.jsonl", "a") as f:
                    f.write(entry)

            elif msg_type == "image":
                media_dir = inbox_dir / "media"
                media_dir.mkdir(exist_ok=True)
                msg_id = event["message"]["id"]
                try:
                    req = urllib.request.Request(
                        f"https://api-data.line.me/v2/bot/message/{msg_id}/content",
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    res = urllib.request.urlopen(req, timeout=10)
                    if res.status == 200:
                        ts = time.strftime("%Y%m%d%H%M%S")
                        filepath = media_dir / f"{ts}_{msg_id}.jpg"
                        filepath.write_bytes(res.read())
                        entry = json.dumps({
                            "timestamp": timestamp,
                            "userId": user_id,
                            "type": "image",
                            "mediaPath": str(filepath),
                            "message": "[画像]",
                            "connectorId": self.connector_id,
                        }, ensure_ascii=False) + "\n"
                        with open(inbox_dir / "queue.jsonl", "a") as f:
                            f.write(entry)
                except Exception:
                    pass

        return {"status": "ok"}

    async def verify(self) -> dict:
        """Verify LINE Bot credentials via Bot Info API."""
        access_token = self.config.get("accessToken", "")
        if not access_token:
            return {"botVerified": False, "botError": "No access token"}

        try:
            req = urllib.request.Request(
                "https://api.line.me/v2/bot/info",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            res = urllib.request.urlopen(req, timeout=5)
            bot_info = json.loads(res.read())
            return {
                "botVerified": True,
                "botName": bot_info.get("displayName", ""),
                "botId": bot_info.get("userId", ""),
            }
        except Exception as e:
            return {"botVerified": False, "botError": str(e)}

    async def send_message(self, user_id: str, message: str) -> dict:
        """Send a push message to a LINE user."""
        access_token = self.config.get("accessToken", "")
        if not access_token:
            return {"error": "No access token"}

        payload = json.dumps({
            "to": user_id,
            "messages": [{"type": "text", "text": message}],
        }).encode()

        req = urllib.request.Request(
            "https://api.line.me/v2/bot/message/push",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
            method="POST",
        )

        try:
            res = urllib.request.urlopen(req, timeout=10)
            return {"status": "ok", "statusCode": res.status}
        except Exception as e:
            return {"error": str(e)}

    def get_agent_env(self, inbox_dir: str) -> dict:
        """Return environment variables for the LINE agent process."""
        return {
            "LINE_CHANNEL_SECRET": self.config.get("channelSecret", ""),
            "LINE_ACCESS_TOKEN": self.config.get("accessToken", ""),
            "LINE_CHANNEL_ID": self.config.get("channelId", ""),
            "LINE_INBOX_DIR": inbox_dir,
            "LINE_QUEUE_FILE": f"{inbox_dir}/queue.jsonl",
        }
