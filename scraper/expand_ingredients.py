#!/usr/bin/env python3
"""
expand_ingredients.py — Merge new TotK ingredients into ingredients.json
and download missing icons from ZeldaWiki.gg.

Run from project root:  py scraper/expand_ingredients.py
"""

import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT      = Path(__file__).parent.parent
DATA_FILE = ROOT / "data" / "ingredients.json"
IMG_DIR   = ROOT / "images" / "ingredients"
IMG_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://zeldawiki.wiki/wiki/"
HEADERS  = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"}
RATE_SEC = 1.1

# ── All new ingredients not in the existing dataset ───────────────────────────
# Format: id, name, category, type, effect, effect_potency, effect_duration_sec, hearts, sell_price
# type: food | critter | monster

NEW_INGREDIENTS = [
    # ── FOOD: FRUIT ───────────────────────────────────────────────────────────
    dict(id="golden-apple",     name="Golden Apple",     category="fruit",     type="food",    effect="hearty",      effect_potency=1, effect_duration_sec=0,   hearts=1.0,  sell_price=8),
    dict(id="palm-fruit",       name="Palm Fruit",       category="fruit",     type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=0.5,  sell_price=4),
    dict(id="fire-fruit",       name="Fire Fruit",       category="fruit",     type="food",    effect="cold-resist", effect_potency=1, effect_duration_sec=60,  hearts=0.5,  sell_price=3),
    dict(id="ice-fruit",        name="Ice Fruit",        category="fruit",     type="food",    effect="heat-resist", effect_potency=1, effect_duration_sec=60,  hearts=0.5,  sell_price=3),
    dict(id="shock-fruit",      name="Shock Fruit",      category="fruit",     type="food",    effect="shock-resist",effect_potency=1, effect_duration_sec=60,  hearts=0.5,  sell_price=3),

    # ── FOOD: VEGETABLE ───────────────────────────────────────────────────────
    dict(id="hylian-tomato",    name="Hylian Tomato",    category="vegetable", type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=1.0,  sell_price=4),
    dict(id="sun-pumpkin",      name="Sun Pumpkin",      category="vegetable", type="food",    effect="gloom-resist",effect_potency=2, effect_duration_sec=120, hearts=0.5,  sell_price=5),

    # ── FOOD: MUSHROOM ────────────────────────────────────────────────────────
    dict(id="zapshroom",        name="Zapshroom",        category="mushroom",  type="food",    effect="shock-resist",effect_potency=2, effect_duration_sec=90,  hearts=0.5,  sell_price=4),
    dict(id="skyshroom",        name="Skyshroom",        category="mushroom",  type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=0.5,  sell_price=3),

    # ── FOOD: HERB / SEASONING ────────────────────────────────────────────────
    dict(id="stambulb",         name="Stambulb",         category="herb",      type="food",    effect="energizing",  effect_potency=1, effect_duration_sec=0,   hearts=0.0,  sell_price=4),
    dict(id="sundelion",        name="Sundelion",        category="herb",      type="food",    effect="gloom-resist",effect_potency=2, effect_duration_sec=120, hearts=0.0,  sell_price=8),
    dict(id="courser-bee-honey",name="Courser Bee Honey",category="herb",      type="food",    effect="energizing",  effect_potency=1, effect_duration_sec=0,   hearts=1.0,  sell_price=10),
    dict(id="hateno-cheese",    name="Hateno Cheese",    category="herb",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=1.0,  sell_price=5),
    dict(id="goron-spice",      name="Goron Spice",      category="herb",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=0.0,  sell_price=4),
    dict(id="rock-salt",        name="Rock Salt",        category="herb",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=0.0,  sell_price=2),
    dict(id="oil-jar",          name="Oil Jar",          category="herb",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=0.0,  sell_price=3),
    dict(id="monster-extract",  name="Monster Extract",  category="herb",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=0.0,  sell_price=12),
    dict(id="dark-clump",       name="Dark Clump",       category="herb",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=0.0,  sell_price=5),
    dict(id="star-fragment",    name="Star Fragment",    category="herb",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=1.0,  sell_price=200),

    # ── FOOD: MEAT ────────────────────────────────────────────────────────────
    dict(id="raw-whole-bird",   name="Raw Whole Bird",   category="meat",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=3.0,  sell_price=35),
    dict(id="raw-bird-thigh",   name="Raw Bird Thigh",   category="meat",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=2.0,  sell_price=15),

    # ── FOOD: FISH ────────────────────────────────────────────────────────────
    dict(id="hearty-salmon",    name="Hearty Salmon",    category="fish",      type="food",    effect="hearty",      effect_potency=3, effect_duration_sec=0,   hearts=2.0,  sell_price=20),
    dict(id="stealthfin-trout", name="Stealthfin Trout", category="fish",      type="food",    effect="stealth-up",  effect_potency=2, effect_duration_sec=100, hearts=1.0,  sell_price=10),
    dict(id="sanke-carp",       name="Sanke Carp",       category="fish",      type="food",    effect=None,          effect_potency=0, effect_duration_sec=0,   hearts=0.5,  sell_price=20),
    dict(id="ancient-arowana",  name="Ancient Arowana",  category="fish",      type="food",    effect="speed-up",    effect_potency=2, effect_duration_sec=90,  hearts=1.5,  sell_price=6),
    dict(id="mighty-porgy",     name="Mighty Porgy",     category="fish",      type="food",    effect="attack-up",   effect_potency=2, effect_duration_sec=110, hearts=1.0,  sell_price=10),
    dict(id="armored-porgy",    name="Armored Porgy",    category="fish",      type="food",    effect="defense-up",  effect_potency=2, effect_duration_sec=110, hearts=1.0,  sell_price=10),

    # ── CRITTERS ──────────────────────────────────────────────────────────────
    dict(id="fairy",            name="Fairy",            category="bug",       type="critter", effect="hearty",      effect_potency=1, effect_duration_sec=0,   hearts=0.0,  sell_price=2),
    dict(id="sticky-frog",      name="Sticky Frog",      category="frog",      type="critter", effect="stealth-up",  effect_potency=1, effect_duration_sec=90,  hearts=0.0,  sell_price=10),
    dict(id="hightail-lizard",  name="Hightail Lizard",  category="lizard",    type="critter", effect="speed-up",    effect_potency=1, effect_duration_sec=90,  hearts=0.0,  sell_price=2),
    dict(id="sticky-lizard",    name="Sticky Lizard",    category="lizard",    type="critter", effect="stealth-up",  effect_potency=1, effect_duration_sec=90,  hearts=0.0,  sell_price=8),

    # ── MONSTER PARTS: Chuchu ──────────────────────────────────────────────────
    dict(id="chuchu-jelly",          name="Chuchu Jelly",          category="monster-part", type="monster", effect=None, effect_potency=1, effect_duration_sec=60,  hearts=0, sell_price=2),
    dict(id="red-chuchu-jelly",      name="Red Chuchu Jelly",      category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=4),
    dict(id="white-chuchu-jelly",    name="White Chuchu Jelly",    category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=4),
    dict(id="yellow-chuchu-jelly",   name="Yellow Chuchu Jelly",   category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=4),

    # ── MONSTER PARTS: Octorok ────────────────────────────────────────────────
    dict(id="octo-balloon",      name="Octo Balloon",      category="monster-part", type="monster", effect=None, effect_potency=1, effect_duration_sec=60,  hearts=0, sell_price=5),
    dict(id="octorok-tentacle",  name="Octorok Tentacle",  category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=10),

    # ── MONSTER PARTS: Keese ─────────────────────────────────────────────────
    dict(id="keese-eyeball",         name="Keese Eyeball",         category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=2),
    dict(id="fire-keese-eyeball",    name="Fire Keese Eyeball",    category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=6),
    dict(id="ice-keese-eyeball",     name="Ice Keese Eyeball",     category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=6),
    dict(id="electric-keese-eyeball",name="Electric Keese Eyeball",category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=6),
    dict(id="keese-wing",            name="Keese Wing",            category="monster-part", type="monster", effect=None, effect_potency=1, effect_duration_sec=60,  hearts=0, sell_price=3),
    dict(id="fire-keese-wing",       name="Fire Keese Wing",       category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=8),
    dict(id="ice-keese-wing",        name="Ice Keese Wing",        category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=8),
    dict(id="electric-keese-wing",   name="Electric Keese Wing",   category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=8),

    # ── MONSTER PARTS: Aerocuda / Gibdo ──────────────────────────────────────
    dict(id="aerocuda-wing",  name="Aerocuda Wing",  category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=6),
    dict(id="gibdo-wing",     name="Gibdo Wing",     category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=6),
    dict(id="gibdo-bone",     name="Gibdo Bone",     category="monster-part", type="monster", effect=None, effect_potency=1, effect_duration_sec=60,  hearts=0, sell_price=3),
    dict(id="gibdo-guts",     name="Gibdo Guts",     category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=2),

    # ── MONSTER PARTS: Gleeok ────────────────────────────────────────────────
    dict(id="gleeok-wing",         name="Gleeok Wing",         category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=38),
    dict(id="gleeok-flame-horn",   name="Gleeok Flame Horn",   category="monster-part", type="monster", effect=None, effect_potency=6, effect_duration_sec=210, hearts=0, sell_price=70),
    dict(id="gleeok-ice-horn",     name="Gleeok Ice Horn",     category="monster-part", type="monster", effect=None, effect_potency=6, effect_duration_sec=210, hearts=0, sell_price=90),
    dict(id="gleeok-thunder-horn", name="Gleeok Thunder Horn", category="monster-part", type="monster", effect=None, effect_potency=8, effect_duration_sec=225, hearts=0, sell_price=150),
    dict(id="gleeok-guts",         name="Gleeok Guts",         category="monster-part", type="monster", effect=None, effect_potency=7, effect_duration_sec=225, hearts=0, sell_price=200),

    # ── MONSTER PARTS: Molduga ───────────────────────────────────────────────
    dict(id="molduga-fin", name="Molduga Fin", category="monster-part", type="monster", effect=None, effect_potency=4, effect_duration_sec=150, hearts=0, sell_price=30),
    dict(id="molduga-jaw", name="Molduga Jaw", category="monster-part", type="monster", effect=None, effect_potency=4, effect_duration_sec=150, hearts=0, sell_price=30),

    # ── MONSTER PARTS: Bokoblin variants ──────────────────────────────────────
    dict(id="blue-bokoblin-horn",       name="Blue Bokoblin Horn",       category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=5),
    dict(id="black-bokoblin-horn",      name="Black Bokoblin Horn",      category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=9),
    dict(id="silver-bokoblin-horn",     name="Silver Bokoblin Horn",     category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=25),
    dict(id="boss-bokoblin-horn",       name="Boss Bokoblin Horn",       category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=14),
    dict(id="blue-boss-bokoblin-horn",  name="Blue Boss Bokoblin Horn",  category="monster-part", type="monster", effect=None, effect_potency=4, effect_duration_sec=150, hearts=0, sell_price=26),
    dict(id="black-boss-bokoblin-horn", name="Black Boss Bokoblin Horn", category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=36),
    dict(id="silver-boss-bokoblin-horn",name="Silver Boss Bokoblin Horn",category="monster-part", type="monster", effect=None, effect_potency=6, effect_duration_sec=210, hearts=0, sell_price=44),
    dict(id="boss-bokoblin-fang",       name="Boss Bokoblin Fang",       category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=15),
    dict(id="boss-bokoblin-guts",       name="Boss Bokoblin Guts",       category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=60),

    # ── MONSTER PARTS: Lizalfos variants ──────────────────────────────────────
    dict(id="blue-lizalfos-horn",       name="Blue Lizalfos Horn",       category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=10),
    dict(id="black-lizalfos-horn",      name="Black Lizalfos Horn",      category="monster-part", type="monster", effect=None, effect_potency=4, effect_duration_sec=150, hearts=0, sell_price=15),
    dict(id="silver-lizalfos-horn",     name="Silver Lizalfos Horn",     category="monster-part", type="monster", effect=None, effect_potency=6, effect_duration_sec=210, hearts=0, sell_price=30),
    dict(id="fire-breath-lizalfos-horn",name="Fire Breath Lizalfos Horn",category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=15),
    dict(id="ice-breath-lizalfos-horn", name="Ice Breath Lizalfos Horn", category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=15),
    dict(id="blue-lizalfos-tail",       name="Blue Lizalfos Tail",       category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=20),
    dict(id="black-lizalfos-tail",      name="Black Lizalfos Tail",      category="monster-part", type="monster", effect=None, effect_potency=6, effect_duration_sec=210, hearts=0, sell_price=22),
    dict(id="silver-lizalfos-tail",     name="Silver Lizalfos Tail",     category="monster-part", type="monster", effect=None, effect_potency=7, effect_duration_sec=225, hearts=0, sell_price=24),
    dict(id="fire-breath-lizalfos-tail",name="Fire Breath Lizalfos Tail",category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=22),
    dict(id="ice-breath-lizalfos-tail", name="Ice Breath Lizalfos Tail", category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=22),
    dict(id="electric-lizalfos-tail",   name="Electric Lizalfos Tail",   category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=22),

    # ── MONSTER PARTS: Lynel (TotK names) ────────────────────────────────────
    dict(id="lynel-saber-horn",          name="Lynel Saber Horn",          category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=40),
    dict(id="blue-maned-lynel-saber-horn",name="Blue-Maned Lynel Saber Horn",category="monster-part",type="monster",effect=None,effect_potency=7,effect_duration_sec=210,hearts=0, sell_price=70),
    dict(id="silver-lynel-saber-horn",   name="Silver Lynel Saber Horn",   category="monster-part", type="monster", effect=None, effect_potency=9, effect_duration_sec=240, hearts=0, sell_price=150),
    dict(id="lynel-mace-horn",           name="Lynel Mace Horn",           category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=40),
    dict(id="blue-maned-lynel-mace-horn",name="Blue-Maned Lynel Mace Horn",category="monster-part",type="monster", effect=None, effect_potency=7, effect_duration_sec=210, hearts=0, sell_price=70),
    dict(id="white-maned-lynel-mace-horn",name="White-Maned Lynel Mace Horn",category="monster-part",type="monster",effect=None,effect_potency=8,effect_duration_sec=225,hearts=0,sell_price=90),
    dict(id="silver-lynel-mace-horn",    name="Silver Lynel Mace Horn",    category="monster-part", type="monster", effect=None, effect_potency=9, effect_duration_sec=240, hearts=0, sell_price=150),

    # ── MONSTER PARTS: Construct ──────────────────────────────────────────────
    dict(id="soldier-construct-horn-i",   name="Soldier Construct Horn I",   category="monster-part", type="monster", effect=None, effect_potency=1, effect_duration_sec=60,  hearts=0, sell_price=2),
    dict(id="soldier-construct-horn-ii",  name="Soldier Construct Horn II",  category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=4),
    dict(id="soldier-construct-horn-iii", name="Soldier Construct Horn III", category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=10),
    dict(id="soldier-construct-horn-iv",  name="Soldier Construct Horn IV",  category="monster-part", type="monster", effect=None, effect_potency=4, effect_duration_sec=150, hearts=0, sell_price=24),
    dict(id="captain-construct-horn-i",   name="Captain Construct Horn I",   category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=3),
    dict(id="captain-construct-horn-ii",  name="Captain Construct Horn II",  category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=9),
    dict(id="captain-construct-horn-iii", name="Captain Construct Horn III", category="monster-part", type="monster", effect=None, effect_potency=4, effect_duration_sec=150, hearts=0, sell_price=12),
    dict(id="captain-construct-horn-iv",  name="Captain Construct Horn IV",  category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=80),

    # ── MONSTER PARTS: Hinox ──────────────────────────────────────────────────
    dict(id="hinox-horn",       name="Hinox Horn",       category="monster-part", type="monster", effect=None, effect_potency=4, effect_duration_sec=150, hearts=0, sell_price=15),
    dict(id="blue-hinox-horn",  name="Blue Hinox Horn",  category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=35),
    dict(id="black-hinox-horn", name="Black Hinox Horn", category="monster-part", type="monster", effect=None, effect_potency=6, effect_duration_sec=210, hearts=0, sell_price=60),
    dict(id="stalnox-horn",     name="Stalnox Horn",     category="monster-part", type="monster", effect=None, effect_potency=4, effect_duration_sec=150, hearts=0, sell_price=15),

    # ── MONSTER PARTS: Moblin variants ───────────────────────────────────────
    dict(id="blue-moblin-horn",   name="Blue Moblin Horn",   category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=9),
    dict(id="black-moblin-horn",  name="Black Moblin Horn",  category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=15),
    dict(id="silver-moblin-horn", name="Silver Moblin Horn", category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=30),

    # ── MONSTER PARTS: Horriblin variants ────────────────────────────────────
    dict(id="blue-horriblin-horn",   name="Blue Horriblin Horn",   category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=9),
    dict(id="black-horriblin-horn",  name="Black Horriblin Horn",  category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=15),
    dict(id="silver-horriblin-horn", name="Silver Horriblin Horn", category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=30),
    dict(id="horriblin-guts",        name="Horriblin Guts",        category="monster-part", type="monster", effect=None, effect_potency=4, effect_duration_sec=150, hearts=0, sell_price=25),

    # ── MONSTER PARTS: Like Like ──────────────────────────────────────────────
    dict(id="like-like-stone",  name="Like Like Stone",  category="monster-part", type="monster", effect=None, effect_potency=2, effect_duration_sec=90,  hearts=0, sell_price=15),
    dict(id="fire-like-stone",  name="Fire Like Stone",  category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=25),
    dict(id="ice-like-stone",   name="Ice Like Stone",   category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=25),
    dict(id="shock-like-stone", name="Shock Like Stone", category="monster-part", type="monster", effect=None, effect_potency=3, effect_duration_sec=120, hearts=0, sell_price=25),

    # ── MONSTER PARTS: Frox ───────────────────────────────────────────────────
    dict(id="frox-fang",          name="Frox Fang",          category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=40),
    dict(id="obsidian-frox-fang", name="Obsidian Frox Fang", category="monster-part", type="monster", effect=None, effect_potency=6, effect_duration_sec=210, hearts=0, sell_price=40),
    dict(id="blue-white-frox-fang",name="Blue-White Frox Fang",category="monster-part",type="monster",effect=None, effect_potency=7, effect_duration_sec=225, hearts=0, sell_price=40),
    dict(id="frox-fingernail",    name="Frox Fingernail",    category="monster-part", type="monster", effect=None, effect_potency=5, effect_duration_sec=180, hearts=0, sell_price=40),

    # ── DRAGON PARTS ─────────────────────────────────────────────────────────
    dict(id="dinarals-scale",       name="Dinraal's Scale",       category="dragon-part", type="monster", effect=None, effect_potency=5,  effect_duration_sec=300,  hearts=0, sell_price=150),
    dict(id="naydras-scale",        name="Naydra's Scale",        category="dragon-part", type="monster", effect=None, effect_potency=5,  effect_duration_sec=300,  hearts=0, sell_price=150),
    dict(id="farosh-scale",         name="Farosh's Scale",        category="dragon-part", type="monster", effect=None, effect_potency=5,  effect_duration_sec=300,  hearts=0, sell_price=150),
    dict(id="light-dragons-scale",  name="Light Dragon's Scale",  category="dragon-part", type="monster", effect=None, effect_potency=5,  effect_duration_sec=300,  hearts=0, sell_price=150),
    dict(id="dinarals-claw",        name="Dinraal's Claw",        category="dragon-part", type="monster", effect=None, effect_potency=7,  effect_duration_sec=900,  hearts=0, sell_price=180),
    dict(id="naydras-claw",         name="Naydra's Claw",         category="dragon-part", type="monster", effect=None, effect_potency=7,  effect_duration_sec=900,  hearts=0, sell_price=180),
    dict(id="farosh-claw",          name="Farosh's Claw",         category="dragon-part", type="monster", effect=None, effect_potency=7,  effect_duration_sec=900,  hearts=0, sell_price=180),
    dict(id="light-dragons-claw",   name="Light Dragon's Claw",   category="dragon-part", type="monster", effect=None, effect_potency=7,  effect_duration_sec=900,  hearts=0, sell_price=180),
    dict(id="dinarals-fang",        name="Dinraal's Fang",        category="dragon-part", type="monster", effect=None, effect_potency=8,  effect_duration_sec=1200, hearts=0, sell_price=250),
    dict(id="naydras-fang",         name="Naydra's Fang",         category="dragon-part", type="monster", effect=None, effect_potency=8,  effect_duration_sec=1200, hearts=0, sell_price=250),
    dict(id="farosh-fang",          name="Farosh's Fang",         category="dragon-part", type="monster", effect=None, effect_potency=8,  effect_duration_sec=1200, hearts=0, sell_price=250),
    dict(id="light-dragons-fang",   name="Light Dragon's Fang",   category="dragon-part", type="monster", effect=None, effect_potency=8,  effect_duration_sec=1200, hearts=0, sell_price=250),
    dict(id="dinarals-horn",        name="Dinraal's Horn",        category="dragon-part", type="monster", effect=None, effect_potency=10, effect_duration_sec=1800, hearts=0, sell_price=300),
    dict(id="naydras-horn",         name="Naydra's Horn",         category="dragon-part", type="monster", effect=None, effect_potency=10, effect_duration_sec=1800, hearts=0, sell_price=300),
    dict(id="farosh-horn",          name="Farosh's Horn",         category="dragon-part", type="monster", effect=None, effect_potency=10, effect_duration_sec=1800, hearts=0, sell_price=300),
    dict(id="light-dragons-horn",   name="Light Dragon's Horn",   category="dragon-part", type="monster", effect=None, effect_potency=10, effect_duration_sec=1800, hearts=0, sell_price=300),
    dict(id="dinarals-spike",       name="Dinraal's Spike",       category="dragon-part", type="monster", effect=None, effect_potency=6,  effect_duration_sec=600,  hearts=0, sell_price=30),
    dict(id="naydras-spike",        name="Naydra's Spike",        category="dragon-part", type="monster", effect=None, effect_potency=6,  effect_duration_sec=600,  hearts=0, sell_price=30),
    dict(id="farosh-spike",         name="Farosh's Spike",        category="dragon-part", type="monster", effect=None, effect_potency=6,  effect_duration_sec=600,  hearts=0, sell_price=30),
    dict(id="light-dragons-spike",  name="Light Dragon's Spike",  category="dragon-part", type="monster", effect=None, effect_potency=6,  effect_duration_sec=600,  hearts=0, sell_price=30),
]

# ── Icon fetcher (same logic as fetch_icons.py) ───────────────────────────────

def find_totk_icon_url(soup, ingredient_name):
    slug = ingredient_name.replace(" ", "_").replace("'", "").replace("\u2019", "")
    expected = f"TotK_{slug}_Icon.png"
    best = fallback = None
    for img in soup.find_all("img"):
        src = img.get("src", "") or img.get("data-src", "")
        fname = src.split("/")[-1].split("?")[0]
        if fname == expected:
            return src
        if fname.startswith("TotK_") and "_Icon.png" in fname and "px-" not in fname:
            fallback = src
    return fallback


def fetch_icon(name, slug):
    dest = IMG_DIR / f"{slug}.png"
    if dest.exists():
        print(f"    [SKIP] icon already downloaded")
        return

    url = BASE_URL + name.replace(" ", "_")
    try:
        time.sleep(RATE_SEC)
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 404:
            print(f"    [SKIP] 404 on wiki")
            return
        r.raise_for_status()
    except Exception as e:
        print(f"    [ERROR] {e}")
        return

    soup = BeautifulSoup(r.text, "html.parser")
    icon_url = find_totk_icon_url(soup, name)

    if not icon_url:
        # Try BotW icon as fallback
        for img in soup.find_all("img"):
            src = img.get("src", "") or img.get("data-src", "")
            fname = src.split("/")[-1]
            if fname.startswith("BotW_") and "_Icon.png" in fname and "px-" not in fname:
                icon_url = src
                break

    if icon_url:
        if icon_url.startswith("//"):
            icon_url = "https:" + icon_url
        try:
            time.sleep(0.3)
            resp = requests.get(icon_url, headers=HEADERS, timeout=15, stream=True)
            resp.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
            print(f"    + Saved {dest.name} ({dest.stat().st_size} bytes)")
        except Exception as e:
            print(f"    [WARN] icon download failed: {e}")
    else:
        print(f"    [WARN] no icon found on wiki")


def main():
    print("=== SoupOfTheDay Ingredient Expander ===\n")

    with open(DATA_FILE, encoding="utf-8") as f:
        existing = json.load(f)

    existing_ids = {i["id"] for i in existing}
    print(f"Existing ingredients: {len(existing)}")
    print(f"New ingredients to add: {len(NEW_INGREDIENTS)}")

    added = []
    skipped = 0

    for ing in NEW_INGREDIENTS:
        if ing["id"] in existing_ids:
            skipped += 1
            continue

        # Build full record
        record = {
            "id": ing["id"],
            "name": ing["name"],
            "category": ing["category"],
            "subcategory": None,
            "effect": ing.get("effect"),
            "effect_potency": ing.get("effect_potency", 0),
            "effect_duration_sec": ing.get("effect_duration_sec", 0),
            "hearts": ing.get("hearts", 0),
            "sell_price": ing.get("sell_price", 0),
            "type": ing["type"],
            "icon": f"images/ingredients/{ing['id']}.png",
        }

        print(f"  + {record['name']}")
        fetch_icon(record["name"], record["id"])
        added.append(record)

    merged = existing + added
    merged.sort(key=lambda x: (x["type"], x["category"], x["name"]))

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    print(f"\nDone: {len(added)} added, {skipped} already existed.")
    print(f"Total: {len(merged)} ingredients")


if __name__ == "__main__":
    main()
