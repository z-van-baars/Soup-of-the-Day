/**
 * merchant.js — Merchant Mode
 *
 * User checks off which ingredients they own (session-only state).
 * Engine computes all valid recipes from that inventory, ranked by sell value.
 */

const MerchantMode = (() => {
  let _effects = [];
  let _ingredients = [];
  let _ownedIds = new Set(); // session only

  function activate(ingredients, effects) {
    _effects = effects;
    _ingredients = ingredients;

    // Show merchant panel
    document.getElementById('merchant-panel')?.removeAttribute('hidden');
    document.getElementById('goal-panel')?.setAttribute('hidden', '');
    document.getElementById('search-bar-wrap')?.removeAttribute('hidden');

    // Set grid to merchant mode
    IngredientGrid.setMode('merchant');
    IngredientGrid.setMerchantOwned(_ownedIds);

    // Wire buttons
    const checkAllBtn = document.getElementById('merchant-check-all');
    const checkNoneBtn = document.getElementById('merchant-check-none');
    const calcBtn = document.getElementById('merchant-calc-btn');

    // Remove old listeners by cloning
    checkAllBtn?.replaceWith(checkAllBtn.cloneNode(true));
    checkNoneBtn?.replaceWith(checkNoneBtn.cloneNode(true));
    calcBtn?.replaceWith(calcBtn.cloneNode(true));

    document.getElementById('merchant-check-all')?.addEventListener('click', () => {
      // Add all currently visible ingredients to owned
      const grid = document.getElementById('ingredient-grid');
      grid?.querySelectorAll('.ingredient-card[data-id]').forEach(card => {
        _ownedIds.add(card.dataset.id);
        card.querySelector('.merchant-check')?.classList.add('checked');
      });
    });

    document.getElementById('merchant-check-none')?.addEventListener('click', () => {
      const grid = document.getElementById('ingredient-grid');
      grid?.querySelectorAll('.ingredient-card[data-id]').forEach(card => {
        _ownedIds.delete(card.dataset.id);
        card.querySelector('.merchant-check')?.classList.remove('checked');
      });
    });

    document.getElementById('merchant-calc-btn')?.addEventListener('click', _calculate);


    // Show placeholder in results
    document.getElementById('results-content').innerHTML =
      '<p class="placeholder-text">Check ingredients you own, then click Calculate.</p>';
  }

  function onMerchantToggle(id, owned) {
    if (owned) _ownedIds.add(id);
    else _ownedIds.delete(id);
  }

  function _calculate() {
    const resultsEl = document.getElementById('results-content');
    if (!resultsEl) return;

    if (_ownedIds.size === 0) {
      resultsEl.innerHTML = '<p class="placeholder-text">Check at least one ingredient first.</p>';
      return;
    }

    const allowDuplicates = document.getElementById('infinite-qty-toggle')?.checked ?? true;
    const capped = allowDuplicates && _ownedIds.size > 30;
    const modeLabel = allowDuplicates
      ? (capped ? 'infinite qty — showing top 30 items by value' : 'infinite qty')
      : 'exact qty';

    resultsEl.innerHTML = `<p class="placeholder-text">Calculating (${modeLabel})...</p>`;

    setTimeout(() => {
      const combos = RecipeEngine.findAllValidRecipes(
        _ownedIds, _ingredients, _effects, 30,
        { allowDuplicates }
      );
      Results.renderComboList(combos, `Best Sell Value Recipes (${modeLabel})`);
    }, 10);
  }

  function getOwnedIds() { return new Set(_ownedIds); }

  return { activate, onMerchantToggle, getOwnedIds };
})();
