/**
 * recipe-engine.js — Core TotK cooking calculation logic
 *
 * TotK rules implemented:
 * - Max 5 ingredients
 * - Elixir = 1+ critter (bug/lizard/frog) + 1+ monster-part, no food
 * - Meal = food only
 * - Mixed type → Dubious Food (except elixir combos)
 * - Dominant effect wins (highest total potency)
 * - Effect tier unlocked at potency thresholds
 * - Duration = sum of duration contributions from effect ingredients
 * - Hearts = sum of hearts from food ingredients
 * - Sell value = base sell * tier multiplier (approximation)
 */

const RecipeEngine = (() => {

  const FOOD_CATEGORIES = new Set([
    'fruit', 'vegetable', 'mushroom', 'meat', 'fish', 'seafood', 'herb', 'nut'
  ]);
  const CRITTER_TYPES = new Set(['critter']);
  const MONSTER_TYPES = new Set(['monster']);

  // Sell value multipliers by ingredient count
  const COUNT_SELL_MULT = { 1: 1.2, 2: 1.3, 3: 1.4, 4: 1.6, 5: 1.8 };

  /**
   * Determine what kind of recipe this is.
   * Returns: 'meal' | 'elixir' | 'dubious' | 'empty'
   */
  function determineRecipeType(ingredients) {
    if (!ingredients || ingredients.length === 0) return 'empty';

    const hasFood    = ingredients.some(i => i.type === 'food');
    const hasCritter = ingredients.some(i => i.type === 'critter');
    const hasMonster = ingredients.some(i => i.type === 'monster');

    if (hasFood && !hasCritter && !hasMonster) return 'meal';
    if (hasCritter && hasMonster && !hasFood)  return 'elixir';
    if (!hasFood && !hasCritter && hasMonster)  return 'dubious'; // monster only = no critter
    return 'dubious'; // mixed types
  }

  /**
   * Compute the dominant effect from a list of ingredients.
   * For elixirs: critters provide the effect, monster parts boost potency.
   * For meals: food provides the effect.
   *
   * Returns: { effectId, totalPotency, durationSec } or null
   */
  function computeDominantEffect(ingredients, recipeType, effects) {
    const potencyByEffect = {};
    let totalMonsterPotency = 0;
    let totalMonsterDuration = 0;

    for (const ing of ingredients) {
      if (recipeType === 'elixir') {
        if (ing.type === 'monster') {
          // Monster parts boost potency/duration of the dominant critter effect
          totalMonsterPotency += ing.effect_potency || 0;
          totalMonsterDuration += ing.effect_duration_sec || 0;
          continue;
        }
        if (ing.type !== 'critter') continue;
      } else if (recipeType === 'meal') {
        if (ing.type !== 'food') continue;
      }

      if (!ing.effect) continue;

      if (!potencyByEffect[ing.effect]) {
        potencyByEffect[ing.effect] = { potency: 0, duration: 0 };
      }
      potencyByEffect[ing.effect].potency += ing.effect_potency || 0;
      potencyByEffect[ing.effect].duration += ing.effect_duration_sec || 0;
    }

    // Find dominant effect (highest potency; ties broken by first encountered)
    let dominant = null;
    let maxPotency = 0;
    for (const [effectId, data] of Object.entries(potencyByEffect)) {
      if (data.potency > maxPotency) {
        maxPotency = data.potency;
        dominant = { effectId, ...data };
      }
    }

    if (!dominant) return null;

    // Add monster part bonuses for elixirs
    if (recipeType === 'elixir') {
      dominant.potency += totalMonsterPotency;
      dominant.duration += totalMonsterDuration;
    }

    // Determine tier
    const effectDef = (effects || []).find(e => e.id === dominant.effectId);
    let tier = 0;
    if (effectDef && effectDef.potency_thresholds && effectDef.potency_thresholds.length > 0) {
      const thresholds = effectDef.potency_thresholds;
      for (let t = thresholds.length - 1; t >= 0; t--) {
        if (dominant.potency >= thresholds[t]) {
          tier = t + 1;
          break;
        }
      }
    }

    return {
      effectId: dominant.effectId,
      effectDef,
      totalPotency: dominant.potency,
      tier,
      durationSec: dominant.duration,
    };
  }

  /**
   * Compute total hearts restored from ingredients.
   * Only food contributes hearts; elixirs typically restore 0.
   */
  function computeHearts(ingredients, recipeType) {
    if (recipeType === 'elixir') return 0;
    return ingredients.reduce((sum, i) => sum + (i.type === 'food' ? (i.hearts || 0) : 0), 0);
  }

  /**
   * Compute sell value.
   * Sum of component sell prices × multiplier based on ingredient count.
   */
  function computeSellValue(ingredients) {
    const base = ingredients.reduce((sum, i) => sum + (i.sell_price || 0), 0);
    const mult = COUNT_SELL_MULT[Math.min(ingredients.length, 5)] || 1.2;
    return Math.round(base * mult);
  }

  /**
   * Generate a recipe name from the result.
   */
  function generateRecipeName(recipeType, effectResult, hearts) {
    if (recipeType === 'dubious') return 'Dubious Food';
    if (recipeType === 'empty')   return '—';

    if (!effectResult) {
      // No effect — plain dish
      if (recipeType === 'elixir') return 'Plain Elixir';
      const heartsStr = hearts >= 3 ? 'Hearty ' : hearts >= 1 ? ' ' : 'Plain ';
      return `${heartsStr.trim()} Dish`.trim();
    }

    const prefix = effectResult.effectDef?.prefix || '';
    const suffix = recipeType === 'elixir' ? 'Elixir' : 'Dish';
    const tierName = effectResult.effectDef?.tier_names?.[effectResult.tier - 1] || '';

    if (effectResult.effectDef?.tiers === 0) {
      // Untiers effects (hearty, energizing, enduring)
      return `${prefix} ${suffix}`.trim();
    }

    return tierName
      ? `${prefix} ${suffix} (${tierName})`
      : `${prefix} ${suffix}`;
  }

  /**
   * Format duration in M:SS
   */
  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Main compute function — takes an array of ingredient objects + effects array.
   * Returns a full result object.
   */
  function computeRecipe(ingredients, effects) {
    if (!ingredients || ingredients.length === 0) {
      return { type: 'empty', name: '—', effect: null, tier: 0, hearts: 0, sellValue: 0, duration: '—', warnings: [] };
    }

    const recipeType = determineRecipeType(ingredients);
    const warnings = [];

    if (recipeType === 'dubious') {
      warnings.push('Incompatible ingredient mix — produces Dubious Food.');
    }

    const effectResult = recipeType === 'dubious' ? null : computeDominantEffect(ingredients, recipeType, effects);
    const hearts = computeHearts(ingredients, recipeType);
    const tier = effectResult?.tier || 0;
    const sellValue = computeSellValue(ingredients);
    const name = generateRecipeName(recipeType, effectResult, hearts);

    // Warn about extra hearts in elixir context
    if (recipeType === 'elixir' && ingredients.some(i => i.type === 'food')) {
      warnings.push('Food + critter/monster mix makes Dubious Food.');
    }

    return {
      type: recipeType,
      name,
      effect: effectResult,
      tier,
      hearts,
      sellValue,
      duration: effectResult ? formatDuration(effectResult.durationSec) : '—',
      warnings,
    };
  }

  /**
   * Goal mode: find all ingredient combos (up to 5) that achieve targetEffectId at >= targetTier.
   * Ingredients may repeat (e.g. 5× same critter for max duration).
   *
   * @param {Map|null} ownedQtys - Optional Map<id, qty>. When provided, constrains search to
   *   owned ingredients at their specified quantities. When null, all allIngredients are fair
   *   game with unlimited repetition (capped per item at 5 = recipe max).
   *
   * Sorted: longest duration → fewest ingredients → most hearts → best sell value.
   */
  function findBestCombos(targetEffectId, targetTier, allIngredients, effects, maxResults = 20, ownedQtys = null) {
    const effectDef = (effects || []).find(e => e.id === targetEffectId);
    if (!effectDef) return [];

    const isElixirEffect = allIngredients.some(i => i.type === 'critter' && i.effect === targetEffectId);

    let candidates;
    if (isElixirEffect) {
      candidates = allIngredients.filter(i =>
        (i.type === 'critter' && i.effect === targetEffectId) || i.type === 'monster'
      );
    } else {
      candidates = allIngredients.filter(i =>
        i.type === 'food' && i.effect === targetEffectId
      );
    }

    if (ownedQtys) {
      // Constrain to owned items only
      candidates = candidates.filter(i => (ownedQtys.get(i.id) || 0) > 0);
    } else if (isElixirEffect) {
      // Unlimited mode: cap monster parts to keep search space manageable.
      // Keep all critters (essential) + top 12 monster parts by sell price.
      const critters = candidates.filter(i => i.type === 'critter');
      const monsters = candidates.filter(i => i.type === 'monster')
        .sort((a, b) => (b.sell_price || 0) - (a.sell_price || 0))
        .slice(0, 12);
      candidates = [...critters, ...monsters];
    }

    if (candidates.length === 0) return [];

    // Alphabetical order for canonical multiset generation
    candidates = [...candidates].sort((a, b) => a.name.localeCompare(b.name));

    // Per-item max slots: from ownedQtys if constrained, otherwise 5 (recipe max)
    const getMaxQty = (id) => ownedQtys ? Math.min(ownedQtys.get(id) || 0, 5) : 5;

    // Suffix capacity for pruning: can remaining items fill slotsLeft?
    const suffixCap = new Array(candidates.length + 1).fill(0);
    for (let k = candidates.length - 1; k >= 0; k--) {
      suffixCap[k] = suffixCap[k + 1] + getMaxQty(candidates[k].id);
    }

    const results = [];

    function generateCombos(itemIdx, slotsLeft, current) {
      if (slotsLeft === 0) {
        const recipe = computeRecipe(current, effects);
        if (recipe.type === 'dubious') return;
        if (!recipe.effect) return;
        if (recipe.effect.effectId !== targetEffectId) return;
        if (targetTier > 0 && recipe.effect.tier < targetTier) return;
        results.push({ ingredients: [...current], result: recipe });
        return;
      }
      if (itemIdx >= candidates.length) return;
      if (suffixCap[itemIdx] < slotsLeft) return;

      const item = candidates[itemIdx];
      const maxK = Math.min(getMaxQty(item.id), slotsLeft);
      for (let k = 0; k <= maxK; k++) {
        for (let j = 0; j < k; j++) current.push(item);
        generateCombos(itemIdx + 1, slotsLeft - k, current);
        for (let j = 0; j < k; j++) current.pop();
      }
    }

    // Largest combos first — 5-ingredient recipes tend to have the longest duration
    for (let size = 5; size >= 1; size--) {
      generateCombos(0, size, []);
    }

    // Sort: longest duration → fewest ingredients → most hearts → best sell value
    results.sort((a, b) => {
      const durDiff = (b.result.effect?.durationSec ?? 0) - (a.result.effect?.durationSec ?? 0);
      if (durDiff !== 0) return durDiff;
      const sizeDiff = a.ingredients.length - b.ingredients.length;
      if (sizeDiff !== 0) return sizeDiff;
      const heartsDiff = b.result.hearts - a.result.hearts;
      if (heartsDiff !== 0) return heartsDiff;
      return b.result.sellValue - a.result.sellValue;
    });

    return results.slice(0, maxResults);
  }

  /**
   * Merchant mode: given a Map of owned ingredient IDs → quantities (1–5),
   * find all valid recipes sorted by sell value descending.
   *
   * Each ingredient can fill at most qty slots. qty=5 is equivalent to
   * the old "infinite" mode since recipes cap at 5 ingredients.
   */
  function findAllValidRecipes(ownedQtys, allIngredients, effects, maxResults = 30) {
    const owned = allIngredients.filter(i => (ownedQtys.get(i.id) || 0) > 0);
    if (owned.length === 0) return [];

    // Cap candidates to avoid combinatorial explosion; always preserve critters.
    const CAP = 30;
    let candidates = owned;
    if (owned.length > CAP) {
      const critters = owned.filter(i => i.type === 'critter');
      const nonCritters = owned.filter(i => i.type !== 'critter')
        .sort((a, b) => b.sell_price - a.sell_price)
        .slice(0, Math.max(CAP - critters.length, 8));
      candidates = [...critters, ...nonCritters];
    }

    // Alphabetical order → canonical multiset ordering, no dedup needed.
    candidates = [...candidates].sort((a, b) => a.name.localeCompare(b.name));

    // Precompute suffix capacity for pruning: max slots each remaining item can fill.
    const suffixCap = new Array(candidates.length + 1).fill(0);
    for (let k = candidates.length - 1; k >= 0; k--) {
      suffixCap[k] = suffixCap[k + 1] + Math.min(ownedQtys.get(candidates[k].id) || 0, 5);
    }

    const results = [];

    // Recursively build multiset combos of exactly `slotsLeft` items from
    // candidates[itemIdx..], using each item at most min(qty, slotsLeft) times.
    function generateCombos(itemIdx, slotsLeft, current) {
      if (slotsLeft === 0) {
        const recipe = computeRecipe(current, effects);
        if (recipe.type !== 'dubious') {
          results.push({ ingredients: [...current], result: recipe });
        }
        return;
      }
      if (itemIdx >= candidates.length) return;
      if (suffixCap[itemIdx] < slotsLeft) return; // can't fill remaining slots

      const item = candidates[itemIdx];
      const maxK = Math.min(ownedQtys.get(item.id) || 0, slotsLeft);
      for (let k = 0; k <= maxK; k++) {
        for (let j = 0; j < k; j++) current.push(item);
        generateCombos(itemIdx + 1, slotsLeft - k, current);
        for (let j = 0; j < k; j++) current.pop();
      }
    }

    for (let size = 5; size >= 1; size--) {
      generateCombos(0, size, []);
    }

    results.sort((a, b) => b.result.sellValue - a.result.sellValue);

    // Deduplicate value-equivalent outcomes: same sell value + effect + tier.
    const rankSeen = new Set();
    const deduped = results.filter(r => {
      const rKey = `${r.result.sellValue}|${r.result.effect?.effectId ?? 'none'}|${r.result.tier}`;
      if (rankSeen.has(rKey)) return false;
      rankSeen.add(rKey);
      return true;
    });

    return deduped.slice(0, maxResults);
  }

  return {
    computeRecipe,
    findBestCombos,
    findAllValidRecipes,
    determineRecipeType,
    formatDuration,
  };
})();
