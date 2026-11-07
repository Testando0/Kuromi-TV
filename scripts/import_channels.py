#!/usr/bin/env python3
"""Build the local channel catalog from the public sources listed in SOURCES."""
from __future__ import annotations
import json, re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
IMPORT = ROOT / ".import"
OUT = ROOT / "channels.json"

SOURCE_LABELS = {
    "iptv_channels.json": "iptv-org",
    "iptv_streams.json": "iptv-org",
    "iptv_index.m3u": "iptv-org",
    "dear_online.json": "dearbulut",
    "dear_channels.json": "dearbulut",
    "dear_streams.json": "dearbulut",
    "dear_best.m3u": "dearbulut",
    "streamline_index.m3u": "streamline-iptv",
}


def load_json(name):
    path = IMPORT / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def clean_name(value: str | None, fallback: str = "Canal") -> str:
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    return value or fallback


def base_id(value: str | None) -> str:
    value = clean_name(value, "channel")
    return re.sub(r"@[A-Za-z0-9_.-]+$", "", value)


def add_stream(catalog, cid, name, url, meta=None, source="unknown"):
    if not url or not str(url).startswith(("http://", "https://")):
        return
    cid = base_id(cid or name)
    if not cid:
        return
    item = catalog.setdefault(cid, {
        "id": cid, "name": clean_name(name, cid), "country": "", "categories": [],
        "languages": [], "logo": None, "website": None, "streams": [], "sources": []
    })
    if name and item["name"] == cid:
        item["name"] = clean_name(name, cid)
    meta = meta or {}
    for field in ("country", "logo", "website"):
        if not item[field] and meta.get(field):
            item[field] = meta[field]
    for field in ("categories", "languages"):
        values = meta.get(field) or []
        if isinstance(values, str): values = [values]
        for value in values:
            if value and value not in item[field]: item[field].append(value)
    stream = {"url": str(url), "title": clean_name(meta.get("title") or name, item["name"]), "source": source}
    for field in ("quality", "referrer", "user_agent"):
        if meta.get(field): stream[field] = meta[field]
    if not any(s["url"] == stream["url"] for s in item["streams"]):
        item["streams"].append(stream)
    if source not in item["sources"]: item["sources"].append(source)


def parse_m3u(path, source, catalog):
    if not path.exists(): return
    attrs = {}
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if line.startswith("#EXTINF"):
            attrs = {}
            body = line.split(",", 1)
            head = body[0]
            name = clean_name(body[1] if len(body) > 1 else "Canal")
            for key, value in re.findall(r'([\w-]+)="([^"]*)"', head): attrs[key] = value
            attrs["name"] = name
        elif line and not line.startswith("#") and attrs:
            categories = [x.strip().lower() for x in attrs.get("group-title", "").split(";") if x.strip()]
            langs = [x.strip() for x in attrs.get("tvg-language", "").split(";") if x.strip()]
            add_stream(catalog, attrs.get("tvg-id") or attrs.get("tvg-name") or attrs.get("name"), attrs.get("tvg-name") or attrs.get("name"), line, {
                "country": attrs.get("tvg-country", "").split(";")[0], "categories": categories, "languages": langs,
                "logo": attrs.get("tvg-logo"), "title": attrs.get("name")
            }, source)
            attrs = {}


def main():
    catalog = {}
    # Rich channel metadata from both API families.
    metadata = {}
    for filename in ("iptv_channels.json", "dear_channels.json", "dear_online.json"):
        for channel in load_json(filename):
            cid = base_id(channel.get("id"))
            if cid:
                metadata[cid] = channel
                metadata[cid].setdefault("streams", [])
    for filename, source in (("iptv_streams.json", "iptv-org"), ("dear_streams.json", "dearbulut")):
        for stream in load_json(filename):
            channel = metadata.get(base_id(stream.get("channel")))
            meta = channel or {}
            add_stream(catalog, stream.get("channel") or stream.get("title"), (channel or {}).get("name") or stream.get("title"), stream.get("url"), {
                "country": meta.get("country"), "categories": meta.get("categories"), "languages": meta.get("languages"),
                "logo": meta.get("logo"), "website": meta.get("website"), "title": stream.get("title"),
                "quality": stream.get("quality"), "referrer": stream.get("referrer"), "user_agent": stream.get("user_agent")
            }, source)
    for filename, source in SOURCE_LABELS.items():
        if filename.endswith(".m3u"): parse_m3u(IMPORT / filename, source, catalog)

    # Add metadata-only channels when a stream was supplied by another playlist.
    for cid, item in catalog.items():
        meta = metadata.get(cid, {})
        for field in ("country", "logo", "website"):
            if not item[field]: item[field] = meta.get(field)
        for field in ("categories", "languages"):
            for value in meta.get(field) or []:
                if value not in item[field]: item[field].append(value)
        item["categories"] = sorted(set(item["categories"])) or ["other"]
        item["languages"] = sorted(set(item["languages"]))
        item["streams"].sort(key=lambda s: (s.get("source", ""), s["url"]))
        item["sources"].sort()

    channels = sorted(catalog.values(), key=lambda c: (c["country"] or "ZZ", c["name"].lower(), c["id"]))
    payload = {"generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(), "sources": list(SOURCE_LABELS.values()), "channels": channels}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Generated {OUT} with {len(channels)} channels and {sum(len(c['streams']) for c in channels)} streams")

if __name__ == "__main__": main()
