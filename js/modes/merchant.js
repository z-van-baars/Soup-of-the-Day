/**
 * merchant.js — Merchant Mode
 *
 * User checks off which ingredients they own (session-only state).
 * Engine computes all valid recipes from that inventory, ranked by sell value.
 */

const MerchantMode = (() => {
  let _effects = [];
  let _ingredients = [];
  let _ownedQtys = new Map(); // id → qty (1–5), session only

  function activate(ingredients, effects) {
    _effects = effects;
    _ingredients = ingredients;

    // Show merchant panel
    document.getElementById('merchant-panel')?.removeAttribute('hidden');
    document.getElementById('goal-panel')?.setAttribute('hidden', '');
    document.getElementById('search-bar-wrap')?.removeAttribute('hidden');

    // Set grid to merchant mode
    IngredientGrid.setMode('merchant');
    IngredientGrid.setMerchantOwned(_ownedQtys);

    // Wire buttons (clone to remove stale listeners)
    const checkAllBtn = document.getElementById('merchant-check-all');
    const checkNoneBtn = document.getElementById('merchant-check-none');
    const calcBtn = document.getElementById('merchant-calc-btn');
    checkAllBtn?.replaceWith(checkAllBtn.cloneNode(true));
    checkNoneBtn?.replaceWith(checkNoneBtn.cloneNode(true));
    calcBtn?.replaceWith(calcBtn.cloneNode(true));

    document.getElementById('merchant-check-all')?.addEventListener('click', () => {
      const grid = document.getElementById('ingredient-grid');
      grid?.querySelectorAll('.ingredient-card[data-id]').forEach(card => {
        IngredientGrid.setMerchantQty(card.dataset.id, 5);
      });
    });

    document.getElementById('merchant-check-none')?.addEventListener('click', () => {
      const grid = document.getElementById('ingredient-grid');
      grid?.querySelectorAll('.ingredient-card[data-id]').forEach(card => {
        IngredientGrid.setMerchantQty(card.dataset.id, 0);
      });
    });

    document.getElementById('merchant-calc-btn')?.addEventListener('click', _calculate);

    document.getElementById('results-content').innerHTML =
      '<p class="placeholder-text">Set quantities for ingredients you own, then click Calculate.</p>';
  }

  function onMerchantToggle(id, qty) {
    if (qty <= 0) _ownedQtys.delete(id);
    else _ownedQtys.set(id, qty);
  }

  function _calculate() {
    const resultsEl = document.getElementById('results-content');
    if (!resultsEl) return;

    if (_ownedQtys.size === 0) {
      resultsEl.innerHTML = '<p class="placeholder-text">Set at least one ingredient quantity first.</p>';
      return;
    }

    const capped = _ownedQtys.size > 30;
    const label = capped ? 'Best Sell Value Recipes (top 30 by value)' : 'Best Sell Value Recipes';

    resultsEl.innerHTML = '<p class="placeholder-text">Calculating...</p>';

    setTimeout(() => {
      const combos = RecipeEngine.findAllValidRecipes(_ownedQtys, _ingredients, _effects, 30);
      Results.renderComboList(combos, label);
    }, 10);
  }

  return { activate, onMerchantToggle };
})();
