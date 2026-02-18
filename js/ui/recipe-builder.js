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

    // Cook button (handled externally via cook-btn, but we wire it here too)
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
   * Load a set of ingredients into the builder (e.g., from a favorite).
   */
  function loadIngredients(ingredients) {
    _slots = ingredients.slice(0, MAX_SLOTS);
    _renderSlots();
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
  }

  return { init, addIngredient, removeIngredient, loadIngredients, clearAll, getIngredients, isFull };
})();
