/**
 * data.js — Load and cache ingredient/effect JSON data
 */

const Data = (() => {
  let _ingredients = null;
  let _effects = null;

  async function loadData() {
    const [ingrResp, effectsResp] = await Promise.all([
      fetch('data/ingredients.json'),
      fetch('data/effects.json'),
    ]);

    if (!ingrResp.ok) throw new Error('Failed to load ingredients.json');
    if (!effectsResp.ok) throw new Error('Failed to load effects.json');

    _ingredients = await ingrResp.json();
    _effects = await effectsResp.json();

    return { ingredients: _ingredients, effects: _effects };
  }

  function getIngredients() { return _ingredients || []; }
  function getEffects() { return _effects || []; }

  function getIngredientById(id) {
    return (_ingredients || []).find(i => i.id === id) || null;
  }

  function getEffectById(id) {
    return (_effects || []).find(e => e.id === id) || null;
  }

  return { loadData, getIngredients, getEffects, getIngredientById, getEffectById };
})();
