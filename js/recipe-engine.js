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
   * Returns array of { ingredients, result } sorted by hearts desc, then ingredient count asc.
   *
   * For performance, we limit combo search to up to 4 ingredients (5 is computationally expensive
   * without precomputation). Combos with the fewest ingredients that hit the target are ranked first.
   */
  function findBestCombos(targetEffectId, targetTier, allIngredients, effects, maxResults = 20) {
    const effectDef = (effects || []).find(e => e.id === targetEffectId);
    if (!effectDef) return [];

    const threshold = effectDef.potency_thresholds?.[targetTier - 1] ?? 0;

    // Filter to candidates: ingredients that contribute to targetEffectId or are monster parts (for elixir targets)
    const targetEffect = effectDef;
    const isElixirEffect = allIngredients.some(i => i.type === 'critter' && i.effect === targetEffectId);

    let candidates;
    if (isElixirEffect) {
      // Elixir: critters with matching effect + monster parts
      candidates = allIngredients.filter(i =>
        (i.type === 'critter' && i.effect === targetEffectId) ||
        i.type === 'monster'
      );
    } else {
      // Food: ingredients with matching effect
      candidates = allIngredients.filter(i =>
        i.type === 'food' && i.effect === targetEffectId
      );
    }

    if (candidates.length === 0) return [];

    const results = [];

    // Try combos of size 1..5 among candidates
    function combineIngredients(arr, size) {
      if (size === 1) return arr.map(x => [x]);
      const result = [];
      for (let i = 0; i <= arr.length - size; i++) {
        const rest = combineIngredients(arr.slice(i + 1), size - 1);
        for (const c of rest) result.push([arr[i], ...c]);
      }
      return result;
    }

    for (let size = 1; size <= Math.min(5, candidates.length); size++) {
      const combos = combineIngredients(candidates, size);
      for (const combo of combos) {
        const recipe = computeRecipe(combo, effects);
        if (recipe.type === 'dubious') continue;
        if (!recipe.effect) continue;
        if (recipe.effect.effectId !== targetEffectId) continue;
        if (recipe.effect.tier < targetTier) continue;

        results.push({ ingredients: combo, result: recipe });
        if (results.length >= maxResults * 3) break; // collect extras for sorting
      }
      if (results.length >= maxResults * 3) break;
    }

    // Sort: fewest ingredients first, then most hearts, then best sell value
    results.sort((a, b) => {
      const sizeDiff = a.ingredients.length - b.ingredients.length;
      if (sizeDiff !== 0) return sizeDiff;
      const heartsDiff = b.result.hearts - a.result.hearts;
      if (heartsDiff !== 0) return heartsDiff;
      return b.result.sellValue - a.result.sellValue;
    });

    return results.slice(0, maxResults);
  }

  /**
   * Merchant mode: given a set of owned ingredient IDs, find all valid recipes
   * sorted by sell value descending.
   *
   * @param {boolean} options.allowDuplicates - If true, each ingredient can fill
   *   multiple slots (infinite quantity assumed). Defaults to true.
   */
  function findAllValidRecipes(ownedIngredientIds, allIngredients, effects, maxResults = 30, options = {}) {
    const { allowDuplicates = true } = options;
    const owned = allIngredients.filter(i => ownedIngredientIds.has(i.id));
    if (owned.length === 0) return [];

    const seen = new Set();
    const results = [];

    // Standard combinations (no repeat) — each item used at most once
    function combineUnique(arr, size) {
      if (size === 1) return arr.map(x => [x]);
      const result = [];
      for (let i = 0; i <= arr.length - size; i++) {
        for (const c of combineUnique(arr.slice(i + 1), size - 1))
          result.push([arr[i], ...c]);
      }
      return result;
    }

    // Combinations with repetition — each item can fill multiple slots
    function combineRepeat(arr, size) {
      if (size === 0) return [[]];
      const result = [];
      for (let i = 0; i < arr.length; i++) {
        for (const c of combineRepeat(arr.slice(i), size - 1))
          result.push([arr[i], ...c]);
      }
      return result;
    }

    const combineFn = allowDuplicates ? combineRepeat : combineUnique;

    // For infinite mode with large inventories, cap candidates to avoid
    // combinatorial explosion. Always preserve all critters (needed for elixirs),
    // then fill remaining slots with highest sell-price non-critters.
    const CAP = 24;
    let candidates = owned;
    if (allowDuplicates && owned.length > CAP) {
      const critters = owned.filter(i => i.type === 'critter');
      const nonCritters = owned.filter(i => i.type !== 'critter')
        .sort((a, b) => b.sell_price - a.sell_price)
        .slice(0, Math.max(CAP - critters.length, 8));
      candidates = [...critters, ...nonCritters];
    }

    const maxSize = allowDuplicates ? 5 : Math.min(5, candidates.length);

    for (let size = maxSize; size >= 1; size--) {
      if (!allowDuplicates && candidates.length > 12 && size > 3) continue;

      const combos = combineFn(candidates, size);
      for (const combo of combos) {
        const key = combo.map(i => i.id).sort().join(',');
        if (seen.has(key)) continue;
        seen.add(key);

        const recipe = computeRecipe(combo, effects);
        if (recipe.type === 'dubious') continue;

        results.push({ ingredients: combo, result: recipe });
      }
    }

    results.sort((a, b) => b.result.sellValue - a.result.sellValue);
    return results.slice(0, maxResults);
  }

  return {
    computeRecipe,
    findBestCombos,
    findAllValidRecipes,
    determineRecipeType,
    formatDuration,
  };
})();
