#!/usr/bin/env python3
"""
SoupOfTheDay — Zelda Wiki Scraper
Scrapes ingredient data + icons from the Zelda Fandom wiki.

Usage:
    pip install requests beautifulsoup4 pillow
    python scrape_wiki.py

Outputs:
    ../data/ingredients.json
    ../data/effects.json
    ../images/ingredients/<name>.png

NOTE: This is a one-time scraper — run locally, commit the output.
Data is static at runtime (GitHub Pages, no server).

Wiki source: https://zelda.fandom.com/wiki/
Confirm the URL before scraping; wiki structure may have changed.
"""

import json
import os
import re
import time
import urllib.parse
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ── Config ─────────────────────────────────────────────────────────────────────
BASE_URL = "https://zelda.fandom.com/wiki/"
GAME_SLUG = "Tears_of_the_Kingdom"
HEADERS = {
    "User-Agent": "SoupOfTheDay-Scraper/1.0 (educational; contact: see repo)"
}
RATE_LIMIT_SEC = 1.0  # Be polite

OUT_DIR = Path(__file__).parent.parent
DATA_DIR = OUT_DIR / "data"
IMG_DIR = OUT_DIR / "images" / "ingredients"

DATA_DIR.mkdir(exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)

# ── Category map (wiki category → our category) ──────────────────────────────
# Adjust these based on wiki's actual category naming
CATEGORY_MAP = {
    "Fruits": "fruit",
    "Vegetables": "vegetable",
    "Mushrooms": "mushroom",
    "Meats": "meat",
    "Fish": "fish",
    "Seafood": "seafood",
    "Herbs": "herb",
    "Nuts": "nut",
    "Bugs": "bug",
    "Lizards": "lizard",
    "Frogs": "frog",
    "Monster Parts": "monster-part",
    "Dragon Parts": "dragon-part",
    "Minerals": "mineral",
}

# ── Effect name → our effect ID ───────────────────────────────────────────────
EFFECT_NAME_MAP = {
    "Mighty": "attack-up",
    "Tough": "defense-up",
    "Hasty": "speed-up",
    "Sneaky": "stealth-up",
    "Spicy": "cold-resist",
    "Chilly": "heat-resist",
    "Electro": "shock-resist",
    "Fireproof": "flame-guard",
    "Energizing": "energizing",
    "Enduring": "enduring",
    "Hearty": "hearty",
    "Gloom-Warding": "gloom-resist",
}

# ── Type map (category → type) ────────────────────────────────────────────────
TYPE_MAP = {
    "fruit": "food",
    "vegetable": "food",
    "mushroom": "food",
    "meat": "food",
    "fish": "food",
    "seafood": "food",
    "herb": "food",
    "nut": "food",
    "bug": "critter",
    "lizard": "critter",
    "frog": "critter",
    "monster-part": "monster",
    "dragon-part": "dragon",
    "mineral": "mineral",
}


def slugify(name: str) -> str:
    """Convert ingredient name to URL/filename slug."""
    name = name.lower()
    name = re.sub(r"['\u2019]", "", name)
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return name.strip("-")


def fetch(url: str) -> BeautifulSoup | None:
    """Fetch a URL and return BeautifulSoup, with rate limiting."""
    try:
        time.sleep(RATE_LIMIT_SEC)
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as e:
        print(f"  [WARN] Failed to fetch {url}: {e}")
        return None


def download_image(img_url: str, dest: Path) -> bool:
    """Download an image to dest. Returns True on success."""
    try:
        time.sleep(RATE_LIMIT_SEC * 0.5)
        resp = requests.get(img_url, headers=HEADERS, timeout=15, stream=True)
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"  [WARN] Image download failed for {img_url}: {e}")
        return False


def parse_ingredient_page(url: str, category: str) -> dict | None:
    """
    Scrape a single ingredient page.

    Returns ingredient dict or None if parsing fails.

    NOTE: The exact selectors here will depend on the wiki's infobox structure.
    You may need to inspect the page HTML and adjust these selectors.
    """
    soup = fetch(url)
    if not soup:
        return None

    # Try to get the infobox (Fandom wikis use .portable-infobox or .wikitable)
    infobox = soup.find("aside", class_="portable-infobox")
    if not infobox:
        # Fallback: look for standard wikitable
        infobox = soup.find("table", class_="wikitable")

    if not infobox:
        print(f"  [WARN] No infobox found at {url}")
        return None

    name = soup.find("h1", class_="page-header__title")
    name = name.get_text(strip=True) if name else url.split("/")[-1].replace("_", " ")

    # Parse infobox rows
    data = {}
    for item in infobox.find_all("div", class_="pi-item"):
        label_el = item.find("h3", class_="pi-data-label")
        value_el = item.find("div", class_="pi-data-value")
        if label_el and value_el:
            label = label_el.get_text(strip=True).lower()
            value = value_el.get_text(strip=True)
            data[label] = value

    # Parse icon
    img_el = infobox.find("img")
    icon_url = None
    if img_el:
        icon_url = img_el.get("src") or img_el.get("data-src")
        # Strip scale params from Fandom CDN URLs
        if icon_url and "/revision/" in icon_url:
            icon_url = icon_url.split("/revision/")[0] + "/revision/latest?format=original"

    slug = slugify(name)
    img_dest = IMG_DIR / f"{slug}.png"
    icon_path = f"images/ingredients/{slug}.png"

    if icon_url and not img_dest.exists():
        print(f"  Downloading icon for {name}...")
        download_image(icon_url, img_dest)

    # Parse effect from infobox data
    effect_raw = data.get("effect", data.get("cooking effect", ""))
    effect_id = None
    effect_potency = 0
    effect_duration = 0
    for effect_name, eid in EFFECT_NAME_MAP.items():
        if effect_name.lower() in effect_raw.lower():
            effect_id = eid
            break

    # Parse potency (often listed as "Effect Potency" or in tiers)
    potency_raw = data.get("effect potency", data.get("potency", "0"))
    try:
        effect_potency = int(re.search(r"\d+", potency_raw).group())
    except (AttributeError, ValueError):
        effect_potency = 1 if effect_id else 0

    # Parse duration
    duration_raw = data.get("duration", data.get("effect duration", "0"))
    try:
        mins_match = re.search(r"(\d+):(\d+)", duration_raw)
        if mins_match:
            effect_duration = int(mins_match.group(1)) * 60 + int(mins_match.group(2))
        else:
            effect_duration = int(re.search(r"\d+", duration_raw).group())
    except (AttributeError, ValueError):
        effect_duration = 0

    # Parse hearts
    hearts_raw = data.get("hearts restored", data.get("hearts", "0"))
    try:
        hearts = float(re.search(r"[\d.]+", hearts_raw).group())
    except (AttributeError, ValueError):
        hearts = 0.0

    # Parse sell price
    sell_raw = data.get("selling price", data.get("sell price", data.get("value", "0")))
    try:
        sell_price = int(re.search(r"\d+", sell_raw).group())
    except (AttributeError, ValueError):
        sell_price = 0

    ingredient_type = TYPE_MAP.get(category, "food")

    return {
        "id": slug,
        "name": name,
        "category": category,
        "subcategory": None,
        "effect": effect_id,
        "effect_potency": effect_potency,
        "effect_duration_sec": effect_duration,
        "hearts": hearts,
        "sell_price": sell_price,
        "type": ingredient_type,
        "icon": icon_path,
    }


def get_ingredient_list(category_wiki_name: str) -> list[str]:
    """
    Get list of ingredient page URLs from a wiki category page.

    Adjust the URL pattern and link selectors to match the wiki's structure.
    The Zelda fandom wiki uses categories like:
    https://zelda.fandom.com/wiki/Category:Tears_of_the_Kingdom_Fruits
    """
    cat_slug = category_wiki_name.replace(" ", "_")
    url = f"{BASE_URL}Category:{GAME_SLUG}_{cat_slug}"
    print(f"Fetching category: {url}")

    soup = fetch(url)
    if not soup:
        return []

    links = []
    # Fandom wiki category pages list items in .category-page__members
    member_section = soup.find("div", class_="category-page__members")
    if member_section:
        for a in member_section.find_all("a", class_="category-page__member-link"):
            href = a.get("href", "")
            if href and not any(x in href for x in [":", "#"]):
                full_url = urllib.parse.urljoin(BASE_URL, href)
                links.append(full_url)
    else:
        # Fallback: look for #mw-pages
        mw_pages = soup.find("div", id="mw-pages")
        if mw_pages:
            for a in mw_pages.find_all("a"):
                href = a.get("href", "")
                if href and not href.startswith("#"):
                    full_url = urllib.parse.urljoin("https://zelda.fandom.com", href)
                    links.append(full_url)

    print(f"  Found {len(links)} ingredients")
    return links


def scrape_all() -> None:
    """Main scraper entry point."""
    print("=== SoupOfTheDay Wiki Scraper ===\n")
    print("Target:", BASE_URL)
    print("Output:", OUT_DIR, "\n")

    all_ingredients = []
    errors = []

    for wiki_cat_name, our_category in CATEGORY_MAP.items():
        print(f"\n--- Category: {wiki_cat_name} → {our_category} ---")
        urls = get_ingredient_list(wiki_cat_name)

        for url in urls:
            ingredient_name = url.split("/")[-1].replace("_", " ")
            print(f"  Scraping: {ingredient_name}")
            try:
                ingredient = parse_ingredient_page(url, our_category)
                if ingredient:
                    all_ingredients.append(ingredient)
                    print(f"  ✓ {ingredient['name']} (effect={ingredient['effect']}, "
                          f"hearts={ingredient['hearts']}, sell={ingredient['sell_price']})")
                else:
                    errors.append(url)
            except Exception as e:
                print(f"  [ERROR] {url}: {e}")
                errors.append(url)

    # Sort by category then name
    all_ingredients.sort(key=lambda x: (x["category"], x["name"]))

    # Write output
    ingredients_path = DATA_DIR / "ingredients.json"
    with open(ingredients_path, "w", encoding="utf-8") as f:
        json.dump(all_ingredients, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Wrote {len(all_ingredients)} ingredients to {ingredients_path}")

    if errors:
        print(f"\n⚠ {len(errors)} pages failed:")
        for url in errors:
            print(f"  {url}")

    print("\nDone! Commit data/ and images/ to your repo.")


if __name__ == "__main__":
    scrape_all()
