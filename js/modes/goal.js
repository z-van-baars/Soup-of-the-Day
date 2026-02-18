/**
 * goal.js — Goal Mode
 *
 * User selects a target effect + tier.
 * Engine finds the best ingredient combos to achieve it.
 * Results shown as clickable combo cards (click loads into builder).
 *
 * View modes (toggled via goal-view-toggle button):
 *   'recipes' — combo list fills the panel, grid hidden
 *   'grid'    — ingredient grid visible with relevant items highlighted
 */

const GoalMode = (() => {
  let _effects = [];
  let _ingredients = [];
  let _viewMode = 'recipes'; // persists across re-activations

  function activate(ingredients, effects) {
    _effects = effects;
    _ingredients = ingredients;

    // Show goal panel, hide others
    document.getElementById('goal-panel')?.removeAttribute('hidden');
    document.getElementById('merchant-panel')?.setAttribute('hidden', '');

    // Right sidebar: show cooked-result placeholder
    document.getElementById('results-content').innerHTML =
      '<p class="placeholder-text">Click a combo to see its cooked result.</p>';

    IngredientGrid.setMode('ingredient');
    _populateEffectDropdown();

    // Wire view toggle button
    const viewBtn = document.getElementById('goal-view-toggle');
    if (viewBtn) viewBtn.onclick = _toggleViewMode;

    // Re-apply state on re-activation
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

    for (const effect of _effects) {
      const opt = document.createElement('option');
      opt.value = effect.id;
      opt.textContent = effect.name + (effect.description ? ` — ${effect.description.split('.')[0]}` : '');
      select.appendChild(opt);
    }

    select.onchange = _onEffectChange;
  }

  function _onEffectChange() {
    const effectId = document.getElementById('goal-effect-select')?.value;
    _highlightContributing(effectId);
    _syncTierOptions();
    _onSearch();
  }

  function _syncTierOptions() {
    const effectId = document.getElementById('goal-effect-select')?.value;
    const tierSelect = document.getElementById('goal-tier-select');
    if (!tierSelect) return;

    const effectDef = _effects.find(e => e.id === effectId);
    const tiers = effectDef?.tiers || 0;
    const tierField = tierSelect.closest('.goal-field');

    if (!effectId || tiers === 0) {
      if (tierField) tierField.style.display = 'none';
      return;
    }

    const prevVal = tierSelect.value;
    tierSelect.innerHTML = '';

    const bestOpt = document.createElement('option');
    bestOpt.value = 'best';
    bestOpt.textContent = 'Best Available';
    tierSelect.appendChild(bestOpt);

    for (let t = 1; t <= tiers; t++) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = effectDef?.tier_names?.[t - 1] || `Tier ${t}`;
      tierSelect.appendChild(opt);
    }

    if (prevVal === 'best' || (parseInt(prevVal, 10) >= 1 && parseInt(prevVal, 10) <= tiers)) {
      tierSelect.value = prevVal;
    } else {
      tierSelect.value = 'best';
    }

    if (tierField) tierField.style.display = '';
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

      // Respect active sidebar filters — lets users exclude dragon parts etc.
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

      // Deduplicate: same ingredient count + same effective outcome
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

          for (const combo of combos) {
            resultsEl.appendChild(_buildComboCard(combo));
          }
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

    // Tier badge
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
    }
  }

  function _highlightContributing(effectId) {
    if (!effectId) {
      IngredientGrid.setHighlightedIds([]);
      return;
    }

    // Is this effect achievable via critters (elixir route)?
    const hasElixirRoute = _ingredients.some(i => i.type === 'critter' && i.effect === effectId);

    let ids;
    if (hasElixirRoute) {
      ids = _ingredients
        .filter(i => (i.type === 'critter' && i.effect === effectId) || i.type === 'monster')
        .map(i => i.id);
    } else {
      ids = _ingredients
        .filter(i => i.effect === effectId)
        .map(i => i.id);
    }

    IngredientGrid.setHighlightedIds(ids);
  }

  // Expose for app.js to clean up on mode switch
  function getViewMode() { return _viewMode; }

  return { activate, getViewMode };
})();
