/**
 * ingredient-grid.js — Renders the ingredient card grid
 *
 * Supports three display modes:
 *   'ingredient' — click to add to recipe builder
 *   'merchant'   — click to toggle ownership checkbox
 *   'goal'       — read-only display (cards not interactive in goal results,
 *                  but grid stays visible for reference)
 */

const IngredientGrid = (() => {
  let _ingredients = [];
  let _mode = 'ingredient';
  let _onSelect = null;
  let _onMerchantToggle = null;
  let _merchantOwned = new Set();
  let _selectedIds = new Set();
  let _showFuse = false;

  // Category → CSS color class
  const CAT_COLOR = {
    fruit:        '#e06060',
    vegetable:    '#70c060',
    mushroom:     '#c07040',
    meat:         '#c04040',
    fish:         '#4080c0',
    seafood:      '#4070a0',
    herb:         '#50a850',
    nut:          '#a08050',
    bug:          '#80a030',
    lizard:       '#60b060',
    frog:         '#40b080',
    'monster-part': '#a04050',
    'dragon-part':  '#c08020',
    mineral:      '#8090c0',
  };

  function init(ingredients, { onSelect, onMerchantToggle } = {}) {
    _ingredients = ingredients;
    _onSelect = onSelect;
    _onMerchantToggle = onMerchantToggle;
  }

  function setMode(mode) {
    _mode = mode;
    renderGrid();
  }

  function setShowFuse(val) {
    _showFuse = val;
    renderGrid();
  }

  function setSelectedIds(ids) {
    _selectedIds = new Set(ids);
  }

  function setMerchantOwned(owned) {
    _merchantOwned = owned instanceof Set ? owned : new Set(owned);
  }

  /**
   * Full re-render of the grid with current filter/search state.
   */
  function renderGrid(filteredIngredients) {
    const grid = document.getElementById('ingredient-grid');
    if (!grid) return;

    const items = filteredIngredients || _ingredients;

    if (items.length === 0) {
      grid.innerHTML = '<div class="no-results">No ingredients match your filters.</div>';
      document.getElementById('ingredient-count') &&
        (document.getElementById('ingredient-count').textContent = '');
      return;
    }

    grid.innerHTML = '';

    for (const ing of items) {
      grid.appendChild(_createCard(ing));
    }

    const countEl = document.getElementById('ingredient-count');
    if (countEl) {
      countEl.textContent = `${items.length} ingredient${items.length !== 1 ? 's' : ''}`;
    }
  }

  function _createCard(ing) {
    const card = document.createElement('div');
    card.className = 'ingredient-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('title', ing.name);
    card.dataset.id = ing.id;

    if (_mode === 'ingredient') {
      if (_selectedIds.has(ing.id)) card.classList.add('selected');
      card.addEventListener('click', () => {
        if (_onSelect) _onSelect(ing);
      });
    } else if (_mode === 'merchant') {
      card.classList.add('merchant-mode');

      const check = document.createElement('div');
      check.className = 'merchant-check' + (_merchantOwned.has(ing.id) ? ' checked' : '');
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        const owned = _merchantOwned.has(ing.id);
        if (owned) _merchantOwned.delete(ing.id);
        else _merchantOwned.add(ing.id);
        check.classList.toggle('checked', !owned);
        if (_onMerchantToggle) _onMerchantToggle(ing.id, !owned);
      });
      card.appendChild(check);
      card.addEventListener('click', () => {
        const owned = _merchantOwned.has(ing.id);
        if (owned) _merchantOwned.delete(ing.id);
        else _merchantOwned.add(ing.id);
        check.classList.toggle('checked', !owned);
        if (_onMerchantToggle) _onMerchantToggle(ing.id, !owned);
      });
    }

    // Icon area
    const iconWrap = document.createElement('div');
    iconWrap.className = 'ingredient-icon-wrap';

    const img = document.createElement('img');
    img.className = 'ingredient-icon';
    img.alt = ing.name;
    img.loading = 'lazy';
    img.src = ing.icon;
    img.onerror = () => {
      // Replace with placeholder if image missing
      iconWrap.removeChild(img);
      const placeholder = document.createElement('div');
      placeholder.className = 'ingredient-icon-placeholder';
      placeholder.style.background = CAT_COLOR[ing.category] || '#4a4a4a';
      placeholder.textContent = ing.name.slice(0, 2).toUpperCase();
      iconWrap.appendChild(placeholder);
    };
    iconWrap.appendChild(img);
    card.appendChild(iconWrap);

    // Name
    const nameEl = document.createElement('div');
    nameEl.className = 'ingredient-name';
    nameEl.textContent = ing.name;
    card.appendChild(nameEl);

    // Effect badge (small dot or emoji)
    if (ing.effect) {
      const badge = document.createElement('div');
      badge.className = 'effect-badge';
      badge.textContent = _effectEmoji(ing.effect);
      badge.title = ing.effect;
      card.appendChild(badge);
    }

    // Blue fuse glow border
    if (ing.fuse_value && ing.fuse_value > 1) {
      card.classList.add('has-fuse');
    }

    // Price / fuse badge
    if (ing.sell_price > 0) {
      const price = document.createElement('div');
      price.className = 'price-badge';
      if (_showFuse && ing.fuse_value && ing.fuse_value > 1) {
        price.innerHTML = `${ing.sell_price}<span class="price-separator"> - </span><span class="price-fuse">${ing.fuse_value}</span>`;
        price.title = `Sell: ${ing.sell_price}r  |  Fuse bonus: ${ing.fuse_value}`;
      } else {
        price.textContent = String(ing.sell_price);
        price.title = `Sell price: ${ing.sell_price} rupees`;
      }
      card.appendChild(price);
    }

    return card;
  }

  // Quick emoji for effect type
  function _effectEmoji(effectId) {
    const map = {
      'attack-up':   '⚔️',
      'defense-up':  '🛡️',
      'speed-up':    '💨',
      'stealth-up':  '👣',
      'cold-resist': '🔥',
      'heat-resist': '❄️',
      'shock-resist':'⚡',
      'flame-guard': '🔥',
      'energizing':  '💚',
      'enduring':    '🌀',
      'hearty':      '💛',
      'gloom-resist':'🌑',
    };
    return map[effectId] || '✨';
  }

  /**
   * Update selection state without full re-render.
   */
  function updateCardSelection(ingredientId, selected) {
    const card = document.querySelector(`.ingredient-card[data-id="${ingredientId}"]`);
    if (card) card.classList.toggle('selected', selected);
  }

  return { init, setMode, setSelectedIds, setMerchantOwned, setShowFuse, renderGrid, updateCardSelection };
})();
