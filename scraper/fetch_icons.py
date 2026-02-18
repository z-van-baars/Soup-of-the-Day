#!/usr/bin/env python3
"""
fetch_icons.py — Download TotK ingredient icons + update sell prices from ZeldaWiki.gg

Reads ../data/ingredients.json, fetches each ingredient's wiki page,
grabs the TotK Icon PNG and corrects the sell_price. Writes updated JSON.

Usage:  py scraper/fetch_icons.py   (run from project root)
"""

import json
import re
import time
from pathlib import Path
import requests
from bs4 import BeautifulSoup

BASE_URL  = "https://zeldawiki.wiki/wiki/"
CDN_BASE  = "https://cdn.wikimg.net"
HEADERS   = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"}
RATE_SEC  = 1.2  # polite delay between requests

ROOT      = Path(__file__).parent.parent
DATA_FILE = ROOT / "data" / "ingredients.json"
IMG_DIR   = ROOT / "images" / "ingredients"
IMG_DIR.mkdir(parents=True, exist_ok=True)

# Effect keyword → our effect ID (matched against Use(s) field)
EFFECT_MAP = {
    "attack up":        "attack-up",
    "defense up":       "defense-up",
    "movement speed up":"speed-up",
    "speed up":         "speed-up",
    "stealth up":       "stealth-up",
    "cold resistance":  "cold-resist",
    "heat resistance":  "heat-resist",
    "shock resistance": "shock-resist",
    "flame guard":      "flame-guard",
    "fireproof":        "flame-guard",
    "energizing":       "energizing",
    "enduring":         "enduring",
    "hearty":           "hearty",
    "gloom resistance": "gloom-resist",
}


def wiki_url(name: str) -> str:
    return BASE_URL + name.strip().replace(" ", "_")


def parse_totk_sell_price(value_text: str) -> int | None:
    """Extract TotK sell price from Value infobox field."""
    # Format: "... TotK Tears of the Kingdom : 5 Rupees ..."
    # or: "Tears of the Kingdom 3 Rupees"
    m = re.search(r"(?:TotK|Tears of the Kingdom)[^0-9]*?(\d+)\s*Rupees", value_text)
    if m:
        return int(m.group(1))
    # Fallback: first number before "Rupees"
    m = re.search(r"(\d+)\s*Rupees", value_text)
    return int(m.group(1)) if m else None


def parse_effect(uses_text: str) -> str | None:
    """Detect effect from Use(s) field."""
    uses_lower = uses_text.lower()
    for kw, eid in EFFECT_MAP.items():
        if kw in uses_lower:
            return eid
    return None


def find_totk_icon_url(soup: BeautifulSoup, ingredient_name: str) -> str | None:
    """
    Find the TotK inventory icon URL.
    Pattern: TotK_<Name>_Icon.png (case-sensitive on CDN).
    Prefer exact match; fall back to any TotK*Icon image.
    """
    # Build expected filename base
    name_slug = ingredient_name.replace(" ", "_").replace("-", "-")
    expected = f"TotK_{name_slug}_Icon.png"

    best = None
    fallback = None

    for img in soup.find_all("img"):
        src = img.get("src", "") or img.get("data-src", "")
        if not src:
            continue

        filename = src.split("/")[-1].split("?")[0]

        if filename == expected:
            best = src
            break
        # Partial match: TotK*Icon.png and not a thumb (we want full-res)
        if filename.startswith("TotK_") and "_Icon.png" in filename and "px-" not in filename:
            fallback = src

    return best or fallback


def download(url: str, dest: Path) -> bool:
    """Download a file. Returns True on success."""
    try:
        time.sleep(RATE_SEC * 0.3)
        r = requests.get(url, headers=HEADERS, timeout=20, stream=True)
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"    [WARN] Download failed: {e}")
        return False


def scrape_ingredient(ingredient: dict) -> dict:
    """Fetch wiki page for one ingredient, update icon + sell_price. Returns updated dict."""
    name = ingredient["name"]
    url = wiki_url(name)

    print(f"  Fetching: {name}")
    try:
        time.sleep(RATE_SEC)
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 404:
            print(f"    [SKIP] 404 — {url}")
            return ingredient
        r.raise_for_status()
    except Exception as e:
        print(f"    [ERROR] {e}")
        return ingredient

    soup = BeautifulSoup(r.text, "html.parser")
    infobox = soup.find("aside", class_="portable-infobox")

    updated = dict(ingredient)

    # ── Sell price ────────────────────────────────────────────────
    if infobox:
        for item in infobox.find_all("div", class_="pi-item"):
            label = item.find(class_=lambda c: c and "pi-data-label" in c)
            value = item.find(class_=lambda c: c and "pi-data-value" in c)
            if label and value and label.get_text(strip=True) == "Value":
                sell = parse_totk_sell_price(value.get_text(separator=" ", strip=True))
                if sell is not None:
                    updated["sell_price"] = sell

    # ── Effect (only update if currently null to avoid overwriting curated data) ──
    if infobox and updated["effect"] is None:
        for item in infobox.find_all("div", class_="pi-item"):
            label = item.find(class_=lambda c: c and "pi-data-label" in c)
            value = item.find(class_=lambda c: c and "pi-data-value" in c)
            if label and value and label.get_text(strip=True) == "Use(s)":
                eff = parse_effect(value.get_text(separator=" ", strip=True))
                if eff:
                    updated["effect"] = eff

    # ── Icon ──────────────────────────────────────────────────────
    icon_url = find_totk_icon_url(soup, name)
    slug = ingredient["id"]
    dest = IMG_DIR / f"{slug}.png"

    if icon_url:
        # Make absolute URL
        if icon_url.startswith("//"):
            icon_url = "https:" + icon_url
        elif icon_url.startswith("/"):
            icon_url = "https://zeldawiki.wiki" + icon_url

        print(f"    Icon: {icon_url.split('/')[-1]}")
        if dest.exists():
            print(f"    [SKIP] Icon already downloaded")
        else:
            ok = download(icon_url, dest)
            if ok:
                print(f"    ✓ Saved {dest.name}")
            else:
                print(f"    ✗ Download failed")
    else:
        print(f"    [WARN] No TotK icon found for {name}")

    updated["icon"] = f"images/ingredients/{slug}.png"
    return updated


def main():
    print("=== SoupOfTheDay Icon + Price Scraper ===")
    print(f"Source: {BASE_URL}")
    print(f"Icons -> {IMG_DIR}\n")

    with open(DATA_FILE, encoding="utf-8") as f:
        ingredients = json.load(f)

    print(f"Loaded {len(ingredients)} ingredients\n")

    updated = []
    ok_count = 0
    skip_count = 0

    for ing in ingredients:
        result = scrape_ingredient(ing)
        updated.append(result)

        icon_path = IMG_DIR / f"{ing['id']}.png"
        if icon_path.exists():
            ok_count += 1
        else:
            skip_count += 1

    # Write updated JSON
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(updated, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Done. Icons: {ok_count} downloaded, {skip_count} missing.")
    print(f"✓ Updated {DATA_FILE.name}")


if __name__ == "__main__":
    main()
