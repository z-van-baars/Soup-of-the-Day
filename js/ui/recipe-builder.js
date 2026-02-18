/**
 * recipe-builder.js — Manages the 5-slot recipe staging area
 */

const RecipeBuilder = (() => {
  const MAX_SLOTS = 5;
  let _slots = []; // array of ingredient objects (up to 5)
  let _onChange = null;

  // Category → background color for slot placeholder icon
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

  function init(onChangeFn) {
    _onChange = onChangeFn;

    // Clear button
    document.getElementById('clear-recipe-btn')?.addEventListener('click', clearAll);

    // Collapse toggle button (mobile only — hidden on desktop via CSS)
    document.getElementById('recipe-toggle-btn')?.addEventListener('click', () => {
      document.getElementById('recipe-sidebar')?.classList.toggle('collapsed');
      _updateToggleBtn();
    });

    _renderSlots();
  }

  /**
   * Add an ingredient to the next empty slot.
   * Returns true if added, false if full.
   */
  function addIngredient(ingredient) {
    if (_slots.length >= MAX_SLOTS) return false;
    _slots.push(ingredient);
    _renderSlots();
    _autoExpand();
    _onChange && _onChange([..._slots]);
    return true;
  }

  /**
   * Remove ingredient at a given slot index.
   */
  function removeIngredient(index) {
    if (index < 0 || index >= _slots.length) return;
    _slots.splice(index, 1);
    _renderSlots();
    _onChange && _onChange([..._slots]);
  }

  /**
   * Load a set of ingredients into the builder (e.g., from a favorite or goal combo).
   */
  function loadIngredients(ingredients) {
    _slots = ingredients.slice(0, MAX_SLOTS);
    _renderSlots();
    _autoExpand();
    _onChange && _onChange([..._slots]);
  }

  function clearAll() {
    _slots = [];
    _renderSlots();
    _onChange && _onChange([]);
  }

  function getIngredients() { return [..._slots]; }

  function isFull() { return _slots.length >= MAX_SLOTS; }

  function _renderSlots() {
    const container = document.getElementById('recipe-slots');
    if (!container) return;

    const slotEls = container.querySelectorAll('.recipe-slot');
    slotEls.forEach((el, i) => {
      el.innerHTML = '';
      el.className = 'recipe-slot';
      el.onclick = null;

      const ingredient = _slots[i];
      if (ingredient) {
        el.classList.add('filled');
        el.onclick = () => removeIngredient(i);

        // Icon
        const iconWrap = document.createElement('div');
        iconWrap.className = 'slot-icon-wrap';

        const img = document.createElement('img');
        img.className = 'slot-icon';
        img.src = ingredient.icon;
        img.alt = ingredient.name;
        img.onerror = () => {
          iconWrap.removeChild(img);
          const ph = document.createElement('div');
          ph.className = 'slot-icon-placeholder';
          ph.style.background = CAT_COLOR[ingredient.category] || '#4a4a4a';
          ph.textContent = ingredient.name.slice(0, 2).toUpperCase();
          iconWrap.appendChild(ph);
        };
        iconWrap.appendChild(img);
        el.appendChild(iconWrap);

        // Name
        const nameEl = document.createElement('div');
        nameEl.className = 'slot-name';
        nameEl.textContent = ingredient.name;
        el.appendChild(nameEl);

        // Remove hint
        const hint = document.createElement('div');
        hint.className = 'slot-remove-hint';
        hint.textContent = '✕';
        el.appendChild(hint);
      } else {
        el.classList.add('empty');
        const ph = document.createElement('span');
        ph.className = 'slot-placeholder';
        ph.textContent = 'Empty';
        el.appendChild(ph);
      }
    });

    _updateSlotSummary();
  }

  // Update the ●●●○○ summary in the recipe header
  function _updateSlotSummary() {
    const el = document.getElementById('recipe-slot-summary');
    if (el) {
      el.textContent = Array.from({ length: MAX_SLOTS }, (_, i) => _slots[i] ? '●' : '○').join('');
    }
  }

  // Auto-expand the recipe panel on mobile when slots become non-empty
  function _autoExpand() {
    if (_slots.length === 0) return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    const sidebar = document.getElementById('recipe-sidebar');
    if (sidebar?.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
      _updateToggleBtn();
    }
  }

  // Sync the toggle button arrow with collapsed state
  function _updateToggleBtn() {
    const btn = document.getElementById('recipe-toggle-btn');
    const collapsed = document.getElementById('recipe-sidebar')?.classList.contains('collapsed');
    if (btn) btn.textContent = collapsed ? '▲' : '▼';
  }

  return { init, addIngredient, removeIngredient, loadIngredients, clearAll, getIngredients, isFull };
})();
