/**
 * goal.js — Goal Mode
 *
 * User selects a target effect + tier.
 * Engine finds the best ingredient combos to achieve it.
 * Results shown as clickable combo cards (click loads into builder).
 */

const GoalMode = (() => {
  let _effects = [];
  let _ingredients = [];

  function activate(ingredients, effects) {
    _effects = effects;
    _ingredients = ingredients;

    // Show goal panel, hide others
    document.getElementById('goal-panel')?.removeAttribute('hidden');
    document.getElementById('merchant-panel')?.setAttribute('hidden', '');
    document.getElementById('search-bar-wrap')?.removeAttribute('hidden');

    // Populate effect select
    _populateEffectDropdown();

    // Wire up buttons (use onclick to avoid listener accumulation on re-activation)
    const searchBtn = document.getElementById('goal-search-btn');
    if (searchBtn) searchBtn.onclick = _onSearch;

    // Set grid to display mode (still useful for reference browsing)
    IngredientGrid.setMode('ingredient');

    // Clear results placeholder
    const resultsEl = document.getElementById('goal-results');
    if (resultsEl) {
      resultsEl.innerHTML = '<p class="placeholder-text">Select an effect and tier, then click Find Recipes.</p>';
    }
  }

  function _populateEffectDropdown() {
    const select = document.getElementById('goal-effect-select');
    if (!select) return;

    // Don't re-populate if already done
    if (select.options.length > 1) return;

    for (const effect of _effects) {
      const opt = document.createElement('option');
      opt.value = effect.id;
      opt.textContent = effect.name + (effect.description ? ` — ${effect.description.split('.')[0]}` : '');
      select.appendChild(opt);
    }

    // Update tier dropdown based on selected effect
    select.addEventListener('change', _syncTierOptions);
    _syncTierOptions();
  }

  function _syncTierOptions() {
    const effectId = document.getElementById('goal-effect-select')?.value;
    const tierSelect = document.getElementById('goal-tier-select');
    if (!tierSelect) return;

    const effectDef = _effects.find(e => e.id === effectId);
    const tiers = effectDef?.tiers || 3;
    const currentTier = parseInt(tierSelect.value, 10) || 1;

    tierSelect.innerHTML = '';
    for (let t = 1; t <= tiers; t++) {
      const opt = document.createElement('option');
      opt.value = t;
      const tierLabel = effectDef?.tier_names?.[t - 1] || `Tier ${t}`;
      opt.textContent = tierLabel;
      tierSelect.appendChild(opt);
    }

    // Restore selection if valid
    if (currentTier <= tiers) tierSelect.value = currentTier;

    // For effects with no tiers (hearty, energizing, enduring), hide tier selector
    const tierField = tierSelect.closest('.goal-field');
    if (tierField) {
      tierField.style.display = tiers === 0 ? 'none' : '';
    }
  }

  function _onSearch() {
    const effectId = document.getElementById('goal-effect-select')?.value;
    const tier = parseInt(document.getElementById('goal-tier-select')?.value, 10) || 1;
    const resultsEl = document.getElementById('goal-results');

    if (!effectId) {
      if (resultsEl) resultsEl.innerHTML = '<p class="placeholder-text">Please select an effect first.</p>';
      return;
    }

    if (resultsEl) {
      resultsEl.innerHTML = '<p class="placeholder-text">Searching…</p>';
    }

    // Small timeout to let the "Searching…" render
    setTimeout(() => {
      const combos = RecipeEngine.findBestCombos(effectId, tier, _ingredients, _effects, 20);
      const effectDef = _effects.find(e => e.id === effectId);
      const tierName = effectDef?.tier_names?.[tier - 1] || `Tier ${tier}`;
      const title = `${effectDef?.name || effectId} — ${tierName}`;

      if (resultsEl) {
        resultsEl.innerHTML = '';
        if (combos.length === 0) {
          resultsEl.innerHTML = `<p class="placeholder-text">No combos found for ${title}. Try a lower tier.</p>`;
        } else {
          const heading = document.createElement('p');
          heading.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-bottom:8px;';
          heading.textContent = `${combos.length} combo${combos.length !== 1 ? 's' : ''} found for ${title}. Click a combo to load it.`;
          resultsEl.appendChild(heading);

          for (const combo of combos) {
            resultsEl.appendChild(_buildComboCard(combo));
          }
        }
      }

      // Also update the main results panel
      Results.renderComboList(combos, title);
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
    sell.innerHTML = `💰 <span>${r.sellValue}r</span>`;
    statsRow.appendChild(sell);
    card.appendChild(statsRow);

    card.addEventListener('click', () => {
      RecipeBuilder.loadIngredients(combo.ingredients);
    });

    return card;
  }

  return { activate };
})();
