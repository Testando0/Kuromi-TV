#!/usr/bin/env python3
"""Build a browser-friendly catalog from streams recently marked healthy."""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
IMPORT = ROOT / ".import"
OUT = ROOT / "channels.json"
ONLINE_URL = "https://dearbulut.github.io/iptv/api/v1/channels.online.json"
FREE_TV_URL = "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"
MIN_SCORE = 70
MIN_UPTIME = 80


def fetch_json():
    request = Request(ONLINE_URL, headers={"User-Agent": "Kuromi-TV catalog updater/1.0"})
    with urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    # Use the CI health result instead of blindly importing every URL from a playlist.
    data_path = IMPORT / "dear_online.json"
    channels = fetch_json() if not data_path.exists() else json.loads(data_path.read_text(encoding="utf-8"))
    result = []
    for channel in channels:
        healthy = []
        for stream in channel.get("streams") or []:
            health = stream.get("health") or {}
            url = stream.get("url") or ""
            if health.get("status") != "online":
                continue
            if not url.startswith(("http://", "https://")):
                continue
            if "[" in url or "]" in url:
                continue  # unresolved ad/device placeholders are not playable URLs
            if stream.get("referrer") or stream.get("user_agent"):
                continue  # browsers cannot supply these headers from a video element
            if float(health.get("score") or 0) < MIN_SCORE:
                continue
            if float(health.get("uptime") or 0) < MIN_UPTIME:
                continue
            healthy.append({
                "url": url,
                "title": stream.get("title") or channel.get("name"),
                "quality": stream.get("quality"),
                "rank": stream.get("rank"),
                "score": health.get("score"),
                "uptime": health.get("uptime"),
                "checked_at": health.get("checked_at"),
                "source": "dearbulut-health",
            })
        if not healthy:
            continue
        healthy.sort(key=lambda s: (-(float(s.get("rank") or 0)), -(float(s.get("score") or 0)), s["url"]))
        result.append({
            "id": channel.get("id"),
            "name": channel.get("name") or channel.get("id"),
            "country": channel.get("country") or "",
            "categories": channel.get("categories") or ["other"],
            "languages": channel.get("languages") or [],
            "logo": channel.get("logo"),
            "website": channel.get("website"),
            "streams": healthy,
            "sources": ["dearbulut-health"],
        })
    result.sort(key=lambda c: (c["country"] or "ZZ", c["name"].lower(), c["id"] or ""))
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "health_policy": {"status": "online", "min_score": MIN_SCORE, "min_uptime": MIN_UPTIME, "headers_required": False},
        "sources": [ONLINE_URL, FREE_TV_URL],
        "channels": result,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Generated {OUT}: {len(result)} channels, {sum(len(c['streams']) for c in result)} healthy browser-compatible streams")


if __name__ == "__main__": main()
