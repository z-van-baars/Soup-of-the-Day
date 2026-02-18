"""
update_fuse_subcategory.py

Reads full_list.xlsx to get fuse bonus values, then updates ingredients.json with:
  - fuse_value: looked up from xlsx (or manual overrides), null if not found
  - subcategory: for monster-part category items, mapped from explicit ID lists
"""

import json
import re
import openpyxl

# -- Paths --
BASE = "C:/Users/Zachary.VanBaars/Documents/CCTestBed/Chateau/Projects/SoupOfTheDay"
XLSX_PATH  = f"{BASE}/full_list.xlsx"
JSON_PATH  = f"{BASE}/data/ingredients.json"

# -- Helpers --
def normalize(s):
    """Lowercase, strip everything that is not a-z or 0-9."""
    return re.sub(r"[^a-z0-9]", "", s.lower())

# -- Step 1: Read xlsx -> name->fuse_value dict --
wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
ws = wb.active

xlsx_map = {}  # normalized name -> fuse value
for row in ws.iter_rows(min_row=2, values_only=True):
    item_name, price, fuse_bonus = row[0], row[1], row[2]
    if item_name is None:
        continue
    key = normalize(str(item_name))
    if fuse_bonus is not None:
        try:
            xlsx_map[key] = int(fuse_bonus)
        except (ValueError, TypeError):
            pass

print(f"Loaded {len(xlsx_map)} entries from xlsx.")

# -- Step 2: Manual overrides (ingredient-id -> fuse_value) --
MANUAL_OVERRIDES = {
    "ice-keese-eyeball":           4,
    "black-boss-bokoblin-horn":   27,
    "black-lizalfos-tail":        24,
    "blue-boss-bokoblin-horn":    16,
    "blue-lizalfos-tail":         16,
    "boss-bokoblin-fang":          6,
    "captain-construct-horn-i":    5,
    "captain-construct-horn-ii":  15,
    "captain-construct-horn-iii": 25,
    "captain-construct-horn-iv":  35,
    "electric-lizalfos-tail":     10,
    "fire-breath-lizalfos-horn":  15,
    "fire-breath-lizalfos-tail":  10,
    "ice-breath-lizalfos-horn":   15,
    "ice-breath-lizalfos-tail":   10,
    "silver-boss-bokoblin-horn":  37,
    "silver-lizalfos-tail":       31,
    "soldier-construct-horn-i":    3,
    "soldier-construct-horn-ii":   8,
    "soldier-construct-horn-iii": 18,
    "soldier-construct-horn-iv":  24,
    "frox-fang":                  14,
    "energetic-rhino-beetle":      1,
    "rugged-rhino-beetle":         1,
    "smotherwing-butterfly":       1,
    "sizzlefin-trout":             1,
    "fleet-lotus-seeds":           1,
    "hearty-durian":               1,
    "brightcap-mushroom":          1,
}

# -- Step 3: Subcategory map for monster-parts --
_SUBCAT_LISTS = {
    "eyeballs": [
        "keese-eyeball", "fire-keese-eyeball", "ice-keese-eyeball",
        "electric-keese-eyeball",
    ],
    "wings": [
        "keese-wing", "fire-keese-wing", "ice-keese-wing", "electric-keese-wing",
        "aerocuda-wing", "gibdo-wing", "gleeok-wing",
    ],
    "horns": [
        "bokoblin-horn", "blue-bokoblin-horn", "black-bokoblin-horn",
        "silver-bokoblin-horn", "boss-bokoblin-horn", "blue-boss-bokoblin-horn",
        "black-boss-bokoblin-horn", "silver-boss-bokoblin-horn",
        "lizalfos-horn", "blue-lizalfos-horn", "black-lizalfos-horn",
        "silver-lizalfos-horn", "fire-breath-lizalfos-horn",
        "ice-breath-lizalfos-horn",
        "moblin-horn", "blue-moblin-horn", "black-moblin-horn",
        "silver-moblin-horn",
        "horriblin-horn", "blue-horriblin-horn", "black-horriblin-horn",
        "silver-horriblin-horn",
        "lynel-saber-horn", "blue-maned-lynel-saber-horn",
        "silver-lynel-saber-horn", "lynel-mace-horn",
        "blue-maned-lynel-mace-horn", "white-maned-lynel-mace-horn",
        "silver-lynel-mace-horn",
        "hinox-horn", "blue-hinox-horn", "black-hinox-horn", "stalnox-horn",
        "gleeok-flame-horn", "gleeok-ice-horn", "gleeok-thunder-horn",
    ],
    "fangs": [
        "bokoblin-fang", "boss-bokoblin-fang", "moblin-fang",
        "frox-fang", "obsidian-frox-fang", "blue-white-frox-fang",
        "hinox-tooth",
    ],
    "tails": [
        "lizalfos-tail", "blue-lizalfos-tail", "black-lizalfos-tail",
        "silver-lizalfos-tail", "fire-breath-lizalfos-tail",
        "ice-breath-lizalfos-tail", "electric-lizalfos-tail",
    ],
    "guts": [
        "bokoblin-guts", "boss-bokoblin-guts", "moblin-guts",
        "horriblin-guts", "lynel-guts", "hinox-guts", "gibdo-guts",
        "gleeok-guts", "molduga-guts",
    ],
    "claws": [
        "horriblin-claw", "lizalfos-talon", "frox-fingernail", "hinox-toenail",
    ],
    "jellies": [
        "chuchu-jelly", "red-chuchu-jelly", "white-chuchu-jelly",
        "yellow-chuchu-jelly",
    ],
    "zonai": [
        "soldier-construct-horn-i", "soldier-construct-horn-ii",
        "soldier-construct-horn-iii", "soldier-construct-horn-iv",
        "captain-construct-horn-i", "captain-construct-horn-ii",
        "captain-construct-horn-iii", "captain-construct-horn-iv",
    ],
    "other": [
        "octo-balloon", "octorok-tentacle", "like-like-stone",
        "fire-like-stone", "ice-like-stone", "shock-like-stone",
        "lynel-hoof", "gibdo-bone", "molduga-fin", "molduga-jaw",
    ],
}

SUBCATEGORY_MAP = {}
for subcat, ids in _SUBCAT_LISTS.items():
    for ingredient_id in ids:
        SUBCATEGORY_MAP[ingredient_id] = subcat

# -- Step 4: Load and update ingredients.json --
with open(JSON_PATH, encoding="utf-8") as f:
    ingredients = json.load(f)

matched    = []
null_items = []

for item in ingredients:
    item_id   = item["id"]
    item_name = item["name"]
    category  = item.get("category")

    # fuse_value
    norm_name = normalize(item_name)
    fuse_val  = xlsx_map.get(norm_name)

    if fuse_val is None:
        fuse_val = MANUAL_OVERRIDES.get(item_id)

    item["fuse_value"] = fuse_val

    if fuse_val is not None:
        matched.append(item_id)
    else:
        null_items.append(item_id)

    # subcategory (monster-parts only)
    if category == "monster-part":
        item["subcategory"] = SUBCATEGORY_MAP.get(item_id, "other")

# -- Step 5: Save --
with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(ingredients, f, indent=2, ensure_ascii=False)

# -- Step 6: Summary --
print(f"\n=== fuse_value summary ===")
print(f"  Matched (non-null): {len(matched)}")
print(f"  Null (not found):   {len(null_items)}")

if null_items:
    print(f"\n  Items with null fuse_value ({len(null_items)}):")
    for uid in sorted(null_items):
        print(f"    - {uid}")

print(f"\n=== subcategory summary (monster-parts) ===")
from collections import Counter
mp_subcats = Counter(
    item.get("subcategory")
    for item in ingredients
    if item.get("category") == "monster-part"
)
for subcat, count in sorted(mp_subcats.items()):
    print(f"  {subcat:20s}: {count}")

print("\nDone. ingredients.json updated.")
