/**
 * goal.js — Goal Mode
 *
 * View modes:
 *   'recipes' — combo list fills panel (goal-active), grid hidden
 *   'grid'    — ingredient grid visible, filtered to relevant items
 */

const GoalMode = (() => {
  let _effects = [];
  let _ingredients = [];
  let _viewMode = 'recipes';

  function activate(ingredients, effects) {
    _effects = effects;
    _ingredients = ingredients;

    document.getElementById('goal-panel')?.removeAttribute('hidden');
    document.getElementById('merchant-panel')?.setAttribute('hidden', '');

    document.getElementById('results-content').innerHTML =
      '<p class="placeholder-text">Click a combo to see its cooked result.</p>';

    IngredientGrid.setMode('ingredient');
    _populateEffectDropdown();

    const viewBtn = document.getElementById('goal-view-toggle');
    if (viewBtn) viewBtn.onclick = _toggleViewMode;

    const effectId = document.getElementById('goal-effect-select')?.value;
    if (effectId) {
      _highlightContributing(effectId);
      _syncTierOptions();
      _applyViewMode();
      _onSearch();
    } else {
      _highlightContributing('');
      _syncTierOptions();
      _applyViewMode();
      const resultsEl = document.getElementById('goal-results');
      if (resultsEl) resultsEl.innerHTML = '';
    }
  }

  function _populateEffectDropdown() {
    const select = document.getElementById('goal-effect-select');
    if (!select) return;

    if (select.options.length > 1) {
      select.onchange = _onEffectChange;
      return;
    }

    const groups = [
      { label: 'Stat Buffs',        ids: ['attack-up', 'defense-up', 'speed-up', 'stealth-up', 'swim-speed-up'] },
      { label: 'Hearts & Stamina',  ids: ['hearty', 'energizing', 'enduring'] },
      { label: 'Elemental Resists', ids: ['cold-resist', 'heat-resist', 'shock-resist', 'flame-guard', 'slip-resist'] },
      { label: 'Special',           ids: ['gloom-resist', 'bright'] },
    ];

    for (const group of groups) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      for (const id of group.ids) {
        const effect = _effects.find(e => e.id === id);
        if (!effect) continue;
        const opt = document.createElement('option');
        opt.value = effect.id;
        opt.textContent = effect.name;
        optgroup.appendChild(opt);
      }
      select.appendChild(optgroup);
    }

    select.onchange = _onEffectChange;
  }

  function _onEffectChange() {
    const effectId = document.getElementById('goal-effect-select')?.value;
    _highlightContributing(effectId);
    _syncTierOptions();
    _onSearch();
    // In grid view, re-filter the ingredient grid to new effect
    if (_viewMode === 'grid') {
      document.dispatchEvent(new CustomEvent('goal:grid-update'));
    }
  }

  function _syncTierOptions() {
    const effectId = document.getElementById('goal-effect-select')?.value;
    const tierSelect = document.getElementById('goal-tier-select');
    if (!tierSelect) return;

    const effectDef = _effects.find(e => e.id === effectId);
    const tiers = effectDef?.tiers || 0;

    const prevVal = tierSelect.value;
    tierSelect.innerHTML = '';

    // "Best" is always the first and default option
    const bestOpt = document.createElement('option');
    bestOpt.value = 'best';
    bestOpt.textContent = 'Best';
    tierSelect.appendChild(bestOpt);

    // Tier options only when effect has named tiers
    if (tiers > 0) {
      for (let t = 1; t <= tiers; t++) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = effectDef?.tier_names?.[t - 1] || `T${t}`;
        tierSelect.appendChild(opt);
      }
    }

    // Restore prior selection if still valid
    if (prevVal === 'best' || (parseInt(prevVal, 10) >= 1 && parseInt(prevVal, 10) <= tiers)) {
      tierSelect.value = prevVal;
    } else {
      tierSelect.value = 'best';
    }

    // Tier field always visible (no hiding)
    tierSelect.onchange = _onSearch;
  }

  function _onSearch() {
    const effectId = document.getElementById('goal-effect-select')?.value;
    const tierVal = document.getElementById('goal-tier-select')?.value;
    const resultsEl = document.getElementById('goal-results');

    if (!effectId) {
      if (resultsEl) resultsEl.innerHTML = '';
      return;
    }

    if (resultsEl) resultsEl.innerHTML = '<p class="placeholder-text">Searching…</p>';

    setTimeout(() => {
      const effectDef = _effects.find(e => e.id === effectId);
      const filteredIngredients = _ingredients.filter(i => Filters.passes(i));

      let combos = [];
      let resolvedTier = null;

      if (!tierVal || tierVal === 'best') {
        const maxTier = effectDef?.tiers || 3;
        for (let t = maxTier; t >= 1; t--) {
          combos = RecipeEngine.findBestCombos(effectId, t, filteredIngredients, _effects, 20);
          if (combos.length > 0) { resolvedTier = t; break; }
        }
      } else {
        resolvedTier = parseInt(tierVal, 10) || 1;
        combos = RecipeEngine.findBestCombos(effectId, resolvedTier, filteredIngredients, _effects, 20);
      }

      // Deduplicate by effective outcome
      const goalSeen = new Set();
      combos = combos.filter(c => {
        const key = `${c.ingredients.length}|${c.result.sellValue}|${c.result.tier}|${c.result.effect?.durationSec ?? 0}`;
        if (goalSeen.has(key)) return false;
        goalSeen.add(key);
        return true;
      });

      const tierName = resolvedTier
        ? (effectDef?.tier_names?.[resolvedTier - 1] || `Tier ${resolvedTier}`)
        : '';
      const title = tierName
        ? `${effectDef?.name || effectId} — ${tierName}`
        : (effectDef?.name || effectId);

      if (resultsEl) {
        resultsEl.innerHTML = '';
        if (combos.length === 0) {
          resultsEl.innerHTML = `<p class="placeholder-text">No combos found for ${title}. Try a lower tier.</p>`;
        } else {
          const heading = document.createElement('p');
          heading.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-bottom:8px;';
          heading.textContent = `${combos.length} combo${combos.length !== 1 ? 's' : ''} found for ${title}. Click to load.`;
          resultsEl.appendChild(heading);
          for (const combo of combos) resultsEl.appendChild(_buildComboCard(combo));
        }
      }
    }, 10);
  }

  function _buildComboCard(combo) {
    const card = document.createElement('div');
    card.className = 'combo-card';
    card.style.marginBottom = '6px';

    const tagsRow = document.createElement('div');
    tagsRow.className = 'combo-ingredients';
    for (const ing of combo.ingredients) {
      const tag = document.createElement('span');
      tag.className = 'combo-ingredient-tag';
      tag.textContent = ing.name;
      tagsRow.appendChild(tag);
    }
    card.appendChild(tagsRow);

    const statsRow = document.createElement('div');
    statsRow.className = 'combo-stats';
    const r = combo.result;

    if (r.tier > 0 && r.effect?.effectDef?.tier_names?.[r.tier - 1]) {
      const tierBadge = document.createElement('span');
      tierBadge.className = `result-tier-badge tier-${r.tier}`;
      tierBadge.style.marginRight = '4px';
      tierBadge.textContent = r.effect.effectDef.tier_names[r.tier - 1];
      statsRow.appendChild(tierBadge);
    }
    if (r.hearts > 0) {
      const s = document.createElement('span');
      s.innerHTML = `❤️ <span>${r.hearts}</span>`;
      statsRow.appendChild(s);
    }
    if (r.duration && r.duration !== '—') {
      const s = document.createElement('span');
      s.innerHTML = `⏱ <span>${r.duration}</span>`;
      statsRow.appendChild(s);
    }
    const sell = document.createElement('span');
    sell.innerHTML = `💰 <span class="sell-value">${r.sellValue}r</span>`;
    statsRow.appendChild(sell);
    card.appendChild(statsRow);

    card.addEventListener('click', () => {
      RecipeBuilder.loadIngredients(combo.ingredients);
      const result = RecipeEngine.computeRecipe(combo.ingredients, _effects);
      Results.renderResult(result, combo.ingredients);
    });

    return card;
  }

  function _toggleViewMode() {
    _viewMode = _viewMode === 'recipes' ? 'grid' : 'recipes';
    _applyViewMode();
  }

  function _applyViewMode() {
    const section = document.querySelector('.ingredient-section');
    const btn = document.getElementById('goal-view-toggle');
    const goalResults = document.getElementById('goal-results');

    if (_viewMode === 'recipes') {
      section?.classList.add('goal-active');
      if (goalResults) goalResults.style.display = '';
      if (btn) { btn.textContent = '🔍'; btn.title = 'Browse ingredient grid'; }
    } else {
      section?.classList.remove('goal-active');
      if (goalResults) goalResults.style.display = 'none';
      if (btn) { btn.textContent = '📋'; btn.title = 'Show best recipes'; }
      // Trigger grid re-filter for the current effect
      document.dispatchEvent(new CustomEvent('goal:grid-update'));
    }
  }

  function _highlightContributing(effectId) {
    if (!effectId) {
      IngredientGrid.setHighlightedIds([]);
      return;
    }
    const hasElixirRoute = _ingredients.some(i => i.type === 'critter' && i.effect === effectId);
    let ids;
    if (hasElixirRoute) {
      ids = _ingredients
        .filter(i => (i.type === 'critter' && i.effect === effectId) || i.type === 'monster')
        .map(i => i.id);
    } else {
      ids = _ingredients.filter(i => i.effect === effectId).map(i => i.id);
    }
    IngredientGrid.setHighlightedIds(ids);
  }

  /**
   * Returns a Set of ingredient IDs relevant to effectId, or null if all should show.
   * Used by app.js to filter the grid in goal grid view.
   */
  function getRelevantIds(effectId) {
    if (!effectId) return null;
    const hasElixirRoute = _ingredients.some(i => i.type === 'critter' && i.effect === effectId);
    if (hasElixirRoute) {
      return new Set(
        _ingredients
          .filter(i => (i.type === 'critter' && i.effect === effectId) || i.type === 'monster')
          .map(i => i.id)
      );
    }
    return new Set(_ingredients.filter(i => i.effect === effectId).map(i => i.id));
  }

  function getViewMode() { return _viewMode; }

  return { activate, getViewMode, getRelevantIds };
})();
