/**
 * results.js — Render recipe results and manage favorites section
 */

const Results = (() => {
  function renderResult(result, ingredientList) {
    const container = document.getElementById('results-content');
    if (!container) return;

    if (!result || result.type === 'empty') {
      container.innerHTML = '<p class="placeholder-text">Add ingredients and cook to see results.</p>';
      return;
    }

    container.innerHTML = '';
    container.appendChild(_buildResultCard(result, ingredientList));

    // Refresh favorites display
    renderFavorites();
  }

  function renderComboList(combos, title = 'Best Combos') {
    const container = document.getElementById('results-content');
    if (!container) return;

    container.innerHTML = '';

    if (!combos || combos.length === 0) {
      container.innerHTML = '<p class="placeholder-text">No valid combos found.</p>';
      return;
    }

    const heading = document.createElement('h3');
    heading.style.cssText = 'font-family:Cinzel,serif;font-size:12px;color:var(--gold-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;';
    heading.textContent = title;
    container.appendChild(heading);

    for (const combo of combos) {
      container.appendChild(_buildComboCard(combo));
    }
  }

  function _buildResultCard(result, ingredientList) {
    const card = document.createElement('div');
    card.className = `result-card ${result.type === 'dubious' ? 'dubious' : ''}`;

    // Name + type badge
    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'baseline';
    nameRow.style.gap = '6px';

    const nameEl = document.createElement('div');
    nameEl.className = 'result-name';
    nameEl.textContent = result.name;
    nameRow.appendChild(nameEl);

    if (result.type !== 'empty') {
      const badge = document.createElement('span');
      badge.className = `result-type-badge ${result.type}`;
      badge.textContent = result.type.toUpperCase();
      nameRow.appendChild(badge);
    }
    card.appendChild(nameRow);

    // Effect
    if (result.effect && result.type !== 'dubious') {
      const effectRow = document.createElement('div');
      effectRow.className = 'result-effect';

      const effectName = document.createElement('div');
      effectName.className = 'result-effect-name';
      const effectLabel = result.effect.effectDef?.name || result.effect.effectId;
      effectName.textContent = effectLabel;
      effectRow.appendChild(effectName);

      if (result.effect.tier > 0) {
        const tierBadge = document.createElement('span');
        tierBadge.className = `result-tier-badge tier-${result.effect.tier}`;
        const tierName = result.effect.effectDef?.tier_names?.[result.effect.tier - 1] || `Tier ${result.effect.tier}`;
        tierBadge.textContent = tierName;
        effectRow.appendChild(tierBadge);
      }

      card.appendChild(effectRow);
    }

    // Stats
    const stats = document.createElement('div');
    stats.className = 'result-stats';

    const addStat = (label, value) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span class="stat-label">${label}</span><span class="stat-value">${value}</span>`;
      stats.appendChild(row);
    };

    if (result.hearts > 0) addStat('❤️ Hearts', `+${result.hearts}`);
    if (result.duration && result.duration !== '—') addStat('⏱ Duration', result.duration);
    addStat('<img src="images/rupee.png" class="rupee-icon" alt=""> Sell', `<span class="sell-value">${result.sellValue}r</span>`);
    if (result.effect?.totalPotency) addStat('✨ Potency', result.effect.totalPotency);

    card.appendChild(stats);

    // Warnings
    for (const warn of (result.warnings || [])) {
      const warnEl = document.createElement('div');
      warnEl.className = 'result-warn';
      warnEl.textContent = `⚠️ ${warn}`;
      card.appendChild(warnEl);
    }

    // Actions
    if (result.type !== 'dubious' && result.type !== 'empty') {
      const actions = document.createElement('div');
      actions.className = 'result-actions';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn-secondary';
      saveBtn.textContent = '⭐ Save';
      saveBtn.addEventListener('click', () => {
        const ids = ingredientList.map(i => i.id);
        const label = result.name;
        Storage.saveFavorite(label, ids);
        renderFavorites();
        showToast('Recipe saved!', 'success');
      });
      actions.appendChild(saveBtn);

      card.appendChild(actions);
    }

    return card;
  }

  function _buildComboCard(combo) {
    const card = document.createElement('div');
    card.className = 'combo-card';

    // Ingredient tags
    const tagsRow = document.createElement('div');
    tagsRow.className = 'combo-ingredients';
    for (const ing of combo.ingredients) {
      const tag = document.createElement('span');
      tag.className = 'combo-ingredient-tag';
      tag.textContent = ing.name;
      tagsRow.appendChild(tag);
    }
    card.appendChild(tagsRow);

    // Stats row
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
    const sellS = document.createElement('span');
    sellS.innerHTML = `<img src="images/rupee.png" class="rupee-icon" alt=""> <span class="sell-value">${r.sellValue}r</span>`;
    statsRow.appendChild(sellS);

    card.appendChild(statsRow);

    // Click to load into builder
    card.addEventListener('click', () => {
      RecipeBuilder.loadIngredients(combo.ingredients);
      // Trigger cook
      document.getElementById('cook-btn')?.click();
    });

    return card;
  }

  function renderFavorites() {
    const section = document.getElementById('favorites-section');
    const list = document.getElementById('favorites-list');
    if (!section || !list) return;

    const favs = Storage.getFavorites();
    if (favs.length === 0) {
      section.setAttribute('hidden', '');
      return;
    }

    section.removeAttribute('hidden');
    list.innerHTML = '';

    favs.forEach((fav, idx) => {
      const item = document.createElement('div');
      item.className = 'favorite-item';

      const label = document.createElement('span');
      label.className = 'favorite-label';
      label.textContent = fav.label;
      label.title = fav.ingredients.join(', ');
      item.appendChild(label);

      const loadBtn = document.createElement('button');
      loadBtn.className = 'favorite-load';
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', () => {
        const ingredients = fav.ingredients
          .map(id => Data.getIngredientById(id))
          .filter(Boolean);
        RecipeBuilder.loadIngredients(ingredients);
        document.getElementById('cook-btn')?.click();
      });
      item.appendChild(loadBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'favorite-delete';
      delBtn.textContent = '✕';
      delBtn.title = 'Delete saved recipe';
      delBtn.addEventListener('click', () => {
        Storage.deleteFavorite(idx);
        renderFavorites();
      });
      item.appendChild(delBtn);

      list.appendChild(item);
    });
  }

  function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  return { renderResult, renderComboList, renderFavorites, showToast };
})();
