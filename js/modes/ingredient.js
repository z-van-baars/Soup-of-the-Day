/**
 * ingredient.js — Ingredient Mode
 *
 * User picks up to 5 ingredients; recipe is computed in real-time when they cook.
 * Grid shows all ingredients filtered by current category/search state.
 */

const IngredientMode = (() => {
  let _effects = [];
  let _currentIngredients = [];

  function activate(effects) {
    _effects = effects;

    // Show search bar
    document.getElementById('search-bar-wrap')?.removeAttribute('hidden');

    // Hide mode-specific panels
    document.getElementById('goal-panel')?.setAttribute('hidden', '');
    document.getElementById('merchant-panel')?.setAttribute('hidden', '');

    // Set grid to ingredient-selection mode
    IngredientGrid.setMode('ingredient');

    // Sync grid selection from builder's current state
    _currentIngredients = RecipeBuilder.getIngredients();
    IngredientGrid.setSelectedIds(_currentIngredients.map(i => i.id));

    // Real-time result as builder changes (via app.js bridge)
  }

  function onIngredientSelected(ingredient) {
    if (RecipeBuilder.isFull()) {
      Results.showToast('Recipe is full (5 max). Remove an ingredient first.', 'error');
      return;
    }
    const added = RecipeBuilder.addIngredient(ingredient);
    if (added) {
      _currentIngredients = RecipeBuilder.getIngredients();
      IngredientGrid.setSelectedIds(_currentIngredients.map(i => i.id));
      // Auto-cook / live preview
      _cook();
    }
  }

  function onRecipeChanged(ingredients) {
    _currentIngredients = ingredients;
    IngredientGrid.setSelectedIds(ingredients.map(i => i.id));
    if (ingredients.length > 0) {
      _cook();
    } else {
      Results.renderResult(null, []);
    }
  }

  function _cook() {
    const result = RecipeEngine.computeRecipe(_currentIngredients, _effects);
    Results.renderResult(result, _currentIngredients);
  }

  function cookNow() {
    _cook();
  }

  return { activate, onIngredientSelected, onRecipeChanged, cookNow };
})();
