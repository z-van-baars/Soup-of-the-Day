/**
 * storage.js — localStorage management for saved/favorited recipes
 * Key: 'sotd_favorites'
 * Value: Array of { label: string, ingredients: string[] (ingredient IDs) }
 */

const Storage = (() => {
  const KEY = 'sotd_favorites';

  function getFavorites() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveFavorite(label, ingredientIds) {
    const favs = getFavorites();
    favs.push({ label: label || 'Untitled Recipe', ingredients: ingredientIds });
    localStorage.setItem(KEY, JSON.stringify(favs));
    return favs;
  }

  function deleteFavorite(index) {
    const favs = getFavorites();
    favs.splice(index, 1);
    localStorage.setItem(KEY, JSON.stringify(favs));
    return favs;
  }

  function renameFavorite(index, newLabel) {
    const favs = getFavorites();
    if (favs[index]) favs[index].label = newLabel;
    localStorage.setItem(KEY, JSON.stringify(favs));
    return favs;
  }

  return { getFavorites, saveFavorite, deleteFavorite, renameFavorite };
})();
