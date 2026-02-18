/**
 * search.js — Text search field for ingredient grid
 */

const Search = (() => {
  let _onChange = null;
  let _query = '';

  function init(onChangeFn) {
    _onChange = onChangeFn;

    const input = document.getElementById('ingredient-search');
    const clearBtn = document.getElementById('search-clear');

    if (!input) return;

    input.addEventListener('input', () => {
      _query = input.value.trim().toLowerCase();
      clearBtn && (_query ? clearBtn.removeAttribute('hidden') : clearBtn.setAttribute('hidden', ''));
      _onChange && _onChange(_query);
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      _query = '';
      clearBtn.setAttribute('hidden', '');
      _onChange && _onChange('');
      input.focus();
    });
  }

  function getQuery() { return _query; }

  function matches(ingredient) {
    if (!_query) return true;
    return ingredient.name.toLowerCase().includes(_query);
  }

  return { init, getQuery, matches };
})();
