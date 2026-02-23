# TotK Cooking Mechanics Reference

*Source: Austin John Plays — "Every Single Cooking Mechanic in TotK" (transcript, lightly edited)*

---

## Heart Recovery

Every edible ingredient has a heart value. The game uses **quarter-heart precision** (each quarter = 1 internal unit, 1 full heart = 4 units).

- **Raw food**: listed heart value is used directly
- **Baked food** (dropped and set on fire): value × 1.5
- **Cooked food** (pot): sum of all ingredient values × 2

> **Example**: Apple = 2 units (half a heart). Cooked alone → 4 units = 1 heart. Five apples → 10 units × 2 = 20 units = 5 hearts.

### Hidden Heart Bonuses
- **Acorn** and **Chickaloo Tree Nut**: hidden bonus hearts when added to any dish
- **Dragon parts** (excluding spikes): also grant bonus hearts when included

---

## Critical Cooks

Base chance of a critical cook is **10%** on any dish. A critical cook grants one of:
- Extra hearts restored
- Higher potency/tier (for buffed dishes)
- Longer duration

### Increased Crit Chance
| Condition | Chance |
|---|---|
| Default | 10% |
| Monster gut or tail in an elixir | 30% |
| Cane sugar in a meal | 30% |
| Golden apple in any dish | 100% |
| Gibdo in an elixir | 100% |
| Any dragon part (not spikes) in any dish | 100% |
| Star fragment in any dish | 100% |
| Blood moon (±30 minutes) | 100% |

---

## Buff Durations

Each eligible ingredient for a given buff contributes a flat duration amount. A second ingredient in the recipe always adds a bonus **+30 seconds** on top. Monster parts with high duration values (e.g. Bokoblin Horns: 40 sec, Bokoblin Guts: 2 min 40 sec, Lizalfos Horns: 30 min) add their specific values. Maximum possible buff duration caps at **30 minutes**.

---

## Tiered Buffs

All tiered buffs follow the same structure: ingredients have a **potency level** (1, 2, or 3), and total potency must meet a **threshold** to achieve a given tier.

### Attack Up (Mighty)
| Tier | Required Potency | Ingredients |
|---|---|---|
| 1 | 1 | Mighty Thistle (1), Bladed Rhino Beetle (1) |
| 2 | 5 | Muddy Banana (2), Mighty Carp (2), Razorclaw Crab (2), Razorshroom (2) |
| 3 | 7 | Mighty Porgy (3) |

### Defense Up (Tough)
Same thresholds (1 / 5 / 7). Ingredients: Amaranth/Rugged Rhino Beetle (1), Armored Carp/Iron-Shell Crab/Iron Shroom/Fortified Pumpkin (2), Armored Porgy (3).

### Speed Up (Hasty)
Thresholds: 1 / 5. No tier 3 ingredient — use combinations. Ingredients: Rushroom/Swift Carrot (1), Fleet-Lotus Seeds/Swift Violet/Hot-Footed Frog (2).

### Stealth Up (Sneaky)
Thresholds: 1 / 6 / 9 *(higher than most)*. Ingredients: Blue Nightshade/Sneaky River Snail/Sunset Firefly (1), Silent Shroom/Stealthfin Trout (2), Silent Princess (3).

### Cold Resistance (Spicy)
Thresholds: 1 / 6. No tier 3. Ingredients: Spicy Pepper/Summerwing Butterfly/Warm Sizzlefin (1), Sunshroom/Warm Darner (2), Sizzlefin Trout (3 — but tier cap is 2).

### Heat Resistance (Chilly)
Thresholds: 1 / 6. No tier 3. Ingredients: Cold Safflina/Hydromelon/Winterwing Butterfly (1), Chillshroom/Cold Darner (2), Chillfin Trout (3 — but tier cap is 2).

### Shock Resistance (Electro)
Thresholds: 1 / 4 / 6 *(lower than most)*. Ingredients: Electric Safflina/Thunderwing Butterfly/Voltfruit (1), Electric Darner/Zapshroom (2), Voltfin Trout (3).

### Flame Guard (Fireproof)
Thresholds: 1 / 7. Elixir-only (no food ingredients). Fireproof Lizard (1), Smotherwing Butterfly (2).

### Gloom Resistance (Gloom-Warding)
Thresholds: 1 / 2 / 3 *(very low)*. Only ingredient: Dark Clump (cannot be cooked alone — must combine with plain food, no other buffs). Three Dark Clumps + one plain food = max tier.

### Swim Speed Up (Zesty)
Thresholds: 1 / 5. Only elemental fruits provide this buff; all are level 1, so tier 2 requires critical cook.

### Glow (Bright)
Thresholds: 1 / 5. Brightcap Mushroom (1), Deep Firefly/Glowing Cave Fish (2).

### Slip Resistance (Sticky)
Thresholds: 1 / 5. Elixir-only. Sticky Frog (1), Sticky Lizard (2).

---

## Untied Buffs

These three effects have **no tiers** — the output scales with ingredient potency directly.

### Extra Hearts (Hearty)

Grants **full heart recovery** plus extra **yellow temporary hearts**. The number of bonus hearts equals the **sum of effect_potency of hearty food/critter ingredients** (monster parts do not contribute hearts).

| Level | Extra Hearts | Ingredients |
|---|---|---|
| 1 | 1 | Hearty Truffle |
| 2 | 2 | Hearty Bass |
| 3 | 3 | Hearty Radish |
| 4 | 4 | Big Hearty Truffle, Hearty Lizard, Hearty Salmon |
| 5 | 5 | Big Hearty Radish |

> **Note**: Internal values are ×4 these numbers, but the simplified display is hearts directly.

> **App data issue**: Hearty Lizard is listed as `effect_potency: 2` but should be **4**.

### Stamina Recovery (Energizing)

Instantly restores stamina. Display uses a **stamina ring** model: each ring = 5 segments, **max 3 rings** (15 segments).

Total potency threshold to reach max (3 rings): **11 internal points**. Approximate display formula:

```
segments = min(15, round(total_potency × 15 / 11))
rings    = segments / 5
```

| Ingredient Level | In-Game Contribution | Examples |
|---|---|---|
| 1 | 1 segment | Restless Cricket, Stambulb, Stamina Shroom |
| 2 | 2 segments | Bright-Eyed Crab, Courser Bee Honey |
| 4 | ~5 segments (1 ring) | Staminoka Bass |
| 6 | ~8 segments | Energetic Rhino Beetle |

> **App data issue**: Staminoka Bass is listed as `effect_potency: 2` but the in-game contribution is equivalent to ~4–5 units. This needs a data audit and likely a correction to **4** or **5**.

### Extra Stamina (Enduring)

Grants temporary extra yellow stamina wheels. Max: **2 rings** (10 segments).

Display formula using app `effect_potency` directly as segments:

```
segments = min(10, total_enduring_potency)   (food/critter only, not monster parts)
rings    = segments / 5
```

| Ingredient | App Potency | Segments | Examples |
|---|---|---|---|
| Level 1 | 1 | 1 | Endura Shroom |
| Level 2 | 1 | 1 | Tireless Frog |
| Level 4 | 2 | 2 | Endura Carrot |

> **Verified**: 2× Endura Carrot (potency 2 each = 4 total) → 4 segments = 0.8 rings ≈ "just over ¾ ring" ✓

---

## Gloom Recovery

Restores Gloom-eaten (darkened) hearts over time. Two ingredients only: Sun Pumpkin (level 1, requires questline) and Sundelion (level 3). Internal values are ×4 the displayed numbers. Max = 15 recovery hearts.

---

## Dubious Food

Any incompatible mix (food + critter, single monster part, critter alone, etc.) produces Dubious Food. Moza at Rospro Pass Wellspring can re-cook dubious food for 10 rupees.
