# SoupOfTheDay — Agent Primer

## What This Is

A client-side web app for calculating optimal cooking/elixir recipes in *The Legend of Zelda: Tears of the Kingdom*. Three modes:

- **Ingredient mode** — pick up to 5 ingredients, see a live-cooked result
- **Goal mode** — choose a target effect and tier, get ranked recipe combos
- **Merchant mode** — check ingredients you own, find the highest sell-value recipes

Deployed on GitHub Pages. Repo: `https://github.com/z-van-baars/Soup-of-the-Day`
Push: `git add -A && git commit -m "..." && git push` from the project directory.

---

## Tech Stack

- Pure HTML + CSS + vanilla JS (no build system, no frameworks, no bundler)
- Static site — GitHub Pages serves it directly
- All logic is client-side; no backend

---

## File Map

```
index.html                  — Full DOM structure (read this first for layout context)
css/styles.css              — All styling, including mobile media queries at bottom
data/
  ingredients.json          — 226 ingredients: id, name, category, effect, sell_price,
                              fuse_value, hearts, effect_potency, effect_duration_sec,
                              type (food/critter/monster), icon path
  effects.json              — 16 effect definitions: id, name, prefix, description,
                              tiers, potency_thresholds, tier_names
js/
  data.js                   — Loads + caches JSON, exposes Data.loadData()
  storage.js                — localStorage for favorites
  recipe-engine.js          — Core cooking logic (computeRecipe, findBestCombos,
                              findAllValidRecipes)
  app.js                    — Main orchestrator, wires all modules, _updateGrid(),
                              _activateMode(), sort controls
  ui/
    filters.js              — Filter sidebar state (activeCategories, activeSubcategories,
                              activeEffects); exposes Filters.passes(ingredient)
    search.js               — Search bar state; exposes Search.matches(ingredient)
    ingredient-grid.js      — Renders ingredient cards; manages _highlightedIds,
                              _selectedIds, _merchantOwned; exposes setHighlightedIds()
    recipe-builder.js       — Manages 5-slot recipe staging, slot summary dots,
                              collapse/expand on mobile
    results.js              — Renders cooked result cards and combo lists
  modes/
    ingredient.js           — Ingredient mode logic; auto-cooks on every slot change
    goal.js                 — Goal mode: combo search, view toggle (recipes/grid),
                              _highlightContributing(), getRelevantIds()
    merchant.js             — Merchant mode: owned-ingredient tracking, calculate button
```

---

## Data Model

### Ingredient schema (ingredients.json)

```json
{
  "id": "swift-violet",
  "name": "Swift Violet",
  "category": "herb",          // fruit/vegetable/mushroom/meat/fish/seafood/herb/nut/
                               // bug/lizard/frog/monster-part/dragon-part/mineral
  "subcategory": null,         // used for monster-part subcategories (horns/guts/etc.)
  "effect": "speed-up",        // effect id, or null
  "effect_potency": 1,
  "effect_duration_sec": 70,
  "hearts": 0,
  "sell_price": 10,
  "type": "food",              // food | critter | monster
  "icon": "images/ingredients/swift-violet.png",
  "fuse_value": 1              // weapon fuse attack bonus, or null
}
```

### Effect schema (effects.json)

```json
{
  "id": "speed-up",
  "name": "Hasty",
  "prefix": "Hasty",
  "description": "Temporarily boosts movement speed.",
  "tiers": 2,
  "potency_thresholds": [1, 5],
  "tier_names": ["Low", "High"]
}
```

Effects with `"tiers": 0` are un-tiered (hearty, energizing, enduring).

---

## Sell Value Formula

```
sell_value = round(sum(ingredient.sell_price) × multiplier)

multiplier: 1 item=1.2x | 2=1.3x | 3=1.4x | 4=1.6x | 5=1.8x
```

---

## Recipe Types

| Rule | Type |
|---|---|
| Only food ingredients | Meal |
| Critter(s) + monster-part(s), no food | Elixir |
| Anything else | Dubious Food |

Elixirs: critters provide the effect; monster parts boost potency/duration.
Dragon parts are treated as `type: "monster"` and function as very powerful elixir boosters.

---

## UI Layout

### Desktop

3-column CSS grid:
```
[Filters sidebar 200px] | [Ingredient section 1fr] | [Recipe builder auto / Results 1fr]
```
- `grid-template-rows: auto 1fr` — recipe-sidebar in row 1 (natural height), results-panel in row 2
- Both sections in column 3 get explicit `grid-column: 3; grid-row: N`

### Mobile (max-width: 768px)

Flex column stack:
```
[Header — fixed 52px]
[Ingredient section — flex: 1, overflow hidden, scrolls internally]
[Results panel — max-height 30vh, border-top]
[Recipe sidebar — collapsible, border-top]
```

Filter sidebar is a fixed drawer that slides in from the left (z-index 90).
Overlay backdrop (z-index 89) dims content and closes drawer on tap.

### Key CSS classes

| Class | Where | Effect |
|---|---|---|
| `.goal-active` | `.ingredient-section` | Hides grid + search, grows mode-panel to fill section |
| `.collapsed` | `.recipe-sidebar` | Hides `.recipe-body` (slots), shows only header bar |
| `.open` | `.filters-sidebar` | Slides filter drawer in from left |
| `.effect-[effectId]` | `.ingredient-card` | Colored border + inward edge glow (always visible) |
| `.fuse-t[1-4]` | `.ingredient-card` | Radial blue center glow (replaces old border) |
| `.highlighted` | `.ingredient-card` | Goal mode — amplifies effect glow; amber for no-effect cards |
| `.selected` | `.ingredient-card` | Gold border — ingredient is in the recipe slots |

---

## Three Modes

### Ingredient Mode
- Grid shows all ingredients filtered by sidebar + search
- Click a card → added to next empty recipe slot → auto-cooks live
- Clicking a filled slot removes it → auto-recooks
- Recipe sidebar auto-expands on mobile when first ingredient added

### Goal Mode
Controls row (left to right): `[☰ Filters] [🔍/📋 toggle] [Best/tier select] [Effect dropdown]`

- **Recipes view** (📋, default): `.goal-active` on ingredient-section; combo list fills panel
- **Grid view** (🔍): removes `.goal-active`, shows filtered grid (only relevant ingredients), highlights glow with their effect color
- Effect dropdown uses short names only (Sneaky, Hasty, etc.) — no description inline
- Tier select always visible, defaults to "Best" (auto-finds highest achievable tier)
- Filters sidebar applies to combo search — dragon parts off by default
- Combos deduplicated by `(ingredient_count, sellValue, tier, durationSec)`
- Clicking a combo: loads slots + directly calls `RecipeEngine.computeRecipe` + `Results.renderResult`
- `goal:grid-update` custom event fires when effect changes in grid view → app.js calls `_updateGrid()`

### Merchant Mode
- Cards are checkboxes (own/don't own)
- "Infinite qty" ON (default): each owned ingredient can repeat across slots
- "Infinite qty" OFF: each owned ingredient fills at most 1 slot
- Calculate button → `findAllValidRecipes()` with deduplication by `(sellValue, effectId, tier)`
- Cap: 30 candidates in infinite mode to avoid combinatorial explosion; notice shown in results title when capped
- Results sorted by sell value descending

---

## Key Systems

### Filters
`filters.js` maintains:
- `activeCategories` Set — defaults include everything **except** `dragon-part`
- `activeSubcategories` Set — monster part subcategories, all ON by default
- `activeEffects` Set — empty = all effects pass; add to this to block an effect
- `fuseHideAll`, `fuseMaxEnabled`, `fuseMaxValue` — fuse filter state

`Filters.passes(ingredient)` returns true/false. Called in `_updateGrid()` and in goal mode's `_onSearch()`.

### Sort
State in `app.js`: `sortField` ('name'|'value'|'fuse'), `sortAsc` (bool), `prevSortField`.
- `sortAsc = false` = ascending (A→Z or low→high)
- `sortAsc = true` = descending (Z→A or high→low)
- Default: Name sort, A→Z (`sortAsc = false`)
- When switching to value/fuse: resets to descending (`sortAsc = true`)

### Recipe Engine
`recipe-engine.js` exposes:
- `computeRecipe(ingredients, effects)` → result object
- `findBestCombos(effectId, tier, ingredients, effects, maxResults)` → for Goal mode
- `findAllValidRecipes(ownedIds, allIngredients, effects, maxResults, options)` → for Merchant mode

`findAllValidRecipes` deduplicates by `(sellValue, effectId, tier)` after sorting; candidates are sorted alphabetically first so the canonical form is the alphabetically-first ingredient at max quantity.

### Recipe Builder
`recipe-builder.js` manages `_slots[]` (up to 5 ingredients).
- `_renderSlots()` re-renders and calls `_updateSlotSummary()` (●●○○○ dots in header)
- `_autoExpand()` removes `.collapsed` on mobile when slots become non-empty
- `loadIngredients()` calls `_autoExpand()` — used when goal combo is clicked

---

## Visual System

### Effect-colored borders
Every ingredient card with an effect gets a CSS class `effect-[effectId]` applied in `_createCard()`. Each has a border + inward edge glow. The `.highlighted` + `effect-X` combination amplifies both.

Current effect → color:
| Effect | Color (approximate) |
|---|---|
| attack-up | crimson `220,55,55` |
| defense-up | steel blue `65,125,220` |
| speed-up | cyan `0,200,200` |
| stealth-up | purple `155,55,210` |
| cold-resist | amber `220,130,40` |
| heat-resist | icy blue `80,195,240` |
| shock-resist | electric yellow `220,200,40` |
| flame-guard | fire orange `210,75,30` |
| energizing | lime `75,195,75` |
| enduring | emerald `35,175,120` |
| hearty | rose `215,75,120` |
| gloom-resist | teal `35,155,155` |
| swim-speed-up | ocean blue `35,130,210` |
| bright | gold `225,195,50` |
| slip-resist | rain blue `120,170,240` |

The `.highlighted` fallback (for monster parts with no effect) is gold/amber `rgba(200,165,60,0.65)`.

### Fuse tiers (radial center glow via background layer)
`fuse-t1` = fuse 1–5 (barely visible) → `fuse-t4` = fuse 26+ (strong, leveled off).
Applied as background radial gradient — does NOT conflict with effect border/shadow.

---

## Deployment

GitHub Pages auto-deploys from `main`. Typical turnaround: 1–2 minutes.
No build step. Just push. See `PUBLISHING.md` for hosting/monetization options.

---

## Known Issues & Bugs

### Active
1. **No images for recently-added ingredients** — Dazzlefruit, Splash Fruit, Glowing Cave Fish, Swift Carrot, White-Maned Lynel Saber Horn all show text placeholders. Images need to be sourced and added to `images/ingredients/`.

2. **Gleeok Ice Horn image** — flagged at initial launch as possibly the wrong image. Needs visual verification in-game.

3. **Merchant mode exact qty (Bug #3)** — ownership is binary (you own it or you don't). There's no way to say "I have 3 of these." With infinite qty OFF, the engine assumes exactly 1 of everything. Noted as a usability gap but not yet addressed.

4. **Hearty Durian** — present in the dataset but reportedly removed from TotK's overworld (Nintendo removed it to stop BotW-era heart farming). Currently showing in the app. Decision pending: remove it, or keep it for completeness?

5. **Hyrule Loach** — medium-confidence candidate for a missing ingredient (a fish, present in both BotW and TotK). Not yet added pending verification.

### Minor / Won't Fix Now
- The `⚔ Fuse` toggle in the search bar shows/hides the sell|fuse badge on cards; this is display-only and doesn't interact with the new fuse glow system.
- Effect dropdown in Goal mode uses a native `<select>` which shows the same text in the collapsed state and the options. A richer display (name in trigger, description in options) would require a custom div-based dropdown.

---

## Open Questions

- **Hearty Durian**: keep or remove?
- **Hyrule Loach**: confirm it exists in TotK and add it?
- **Merchant exact-qty UX**: should quantity be tracked per ingredient (input field), or is binary own/don't-own sufficient?
- **Effect dropdown**: build a custom dropdown to show descriptions in options while keeping short name in the trigger, or keep native select with name-only?
- **Goal mode on mobile**: the filter + toggle + tier + effect all fit in one row, but on very small phones (<360px) it might clip. Monitor and address if reported.

---

## Potential Future Features

- **Ko-fi / donate button** in the footer (see `PUBLISHING.md` for full options)
- **Deploy to Netlify or itch.io** for better visibility / custom domain
- **Per-ingredient quantity in Merchant mode** — replace binary checkbox with a small number input so "I have 3 of these" is expressible
- **Custom dropdown for Goal mode effect selector** — trigger shows short name, options show name + italic description
- **Favorites / saved recipes** — partially scaffolded in `results.js`, not fully wired
- **Recipe sharing** — URL-encode a recipe so you can link someone to a specific combo
- **Missing ingredient images** — Dazzlefruit, Splash Fruit, Glowing Cave Fish, Swift Carrot, White-Maned Lynel Saber Horn

### Polish items from today's session
**#7 — Effect dropdown ordering**
Currently the effect list appears in JSON insertion order (attack-up, defense-up, speed-up, etc.). Could be alphabetized or grouped semantically (stat buffs / elemental resists / stamina-heart effects / misc). Low urgency, minimal friction to change.

**#8 — "No results" guidance in Goal mode**
When `findBestCombos` returns 0 results, the message is just "No combos found. Try a lower tier." A better message would tell the user *why* — e.g., "Speed-up Tier 2 requires 5+ potency. Try combining 5× Fleet-Lotus Seeds, or check that speed-up ingredients aren't filtered out." Requires reading the effect's `potency_thresholds` and generating a contextual hint.

---

## Session Log — What We Built Today

This was a major polish session. Changes shipped (all on `main`):

### Data corrections
- Added 5 missing TotK ingredients: **Swift Carrot** (speed-up vegetable), **Dazzlefruit** (no-effect fruit), **Splash Fruit** (swim-speed-up fruit), **Glowing Cave Fish** (bright fish), **White-Maned Lynel Saber Horn** (monster-part, fuse 44)
- Added 2 new effects: `swim-speed-up` (Zesty) and `bright`
- Added `slip-resist` (Sticky) effect; corrected **Sticky Frog** and **Sticky Lizard** from `stealth-up` to `slip-resist`
- Dragon parts set to **off by default** in filter sidebar

### Mobile layout overhaul
- **results-panel** moved out of `recipe-sidebar` to be a direct sibling in `app-main`
- Desktop: CSS grid `grid-template-rows: auto 1fr` — recipe builder row 1, results row 2
- Mobile flex stack: ingredient section (flex: 1) → results panel (max-height 30vh) → recipe sidebar (collapsible)
- Recipe sidebar starts **collapsed** on mobile; auto-expands when ingredients are added; ▲/▼ toggle; ●●○○○ slot summary in header

### Goal mode redesign
- Controls condensed to a **single row**: Filter | 🔍/📋 | Tier | Effect
- Tier select always visible, defaults to **Best Available**
- **Browse/Recipe toggle**: 🔍 shows filtered ingredient grid with effect highlights; 📋 shows combo list
- Grid view actually **filters** to only relevant ingredients (not just highlights)
- Sidebar filters (including dragon parts off) apply to combo search
- Combo results **deduplicated** by (ingredient_count, sellValue, tier, durationSec)
- Filter button order fixed (was sorting to right due to inherited `order: 1`)

### Visual system
- 15 effect-specific **colored borders + inner glow** on ingredient cards, visible in all three modes
- **Fuse glow**: radial background gradient replacing the flat blue border (4 tiers: barely visible → strong at 26+), stacks cleanly with effect border
- Effect + fuse visuals stack without conflict (different CSS layers: border/shadow vs. background)
- Glow intensity bumped +15% after first pass feedback

### Merchant mode fixes
- Removed hard `size > 3` skip that blocked 4–5 ingredient combos with >12 owned items
- Raised candidate cap from 24 to 30; shows notice when cap is active
- Deduplicated value-equivalent results by (sellValue, effectId, tier) — collapses e.g. all Lynel Guts vs Gleeok Guts permutations into one canonical entry

### Sort fix
- Name sort now defaults A→Z; value/fuse sort defaults high→low

---

## What's Next

1. **Verify + source images** for the 5 new ingredients (top priority for visual polish)
2. **Hearty Durian decision** — keep or remove from dataset
3. **Hyrule Loach** — confirm presence in TotK, add if verified
4. **Effect dropdown ordering** (#7 — low effort, see above)
5. **No-results guidance** (#8 — moderate effort, see above)
6. **Merchant exact-qty UX** — design and implement per-ingredient quantity
7. **Custom effect dropdown** in Goal mode — trigger shows short name, options show description
8. **Ko-fi/donate link** when ready to publish more broadly
