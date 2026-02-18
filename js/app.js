/**
 * app.js — Entry point and orchestrator
 *
 * Initializes all modules, wires up mode switching, filter/search → grid updates.
 */

(async () => {
  // ── Load data ──────────────────────────────────────────────────────────────
  let ingredients, effects;
  try {
    const data = await Data.loadData();
    ingredients = data.ingredients;
    effects = data.effects;
  } catch (err) {
    document.getElementById('ingredient-grid').innerHTML =
      `<div class="grid-loading" style="color:#c04040;">Failed to load data: ${err.message}<br>Make sure you're running from a local server (not file://).</div>`;
    console.error(err);
    return;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let currentMode = 'ingredient';
  let sortField = 'name';   // 'name' | 'value' | 'fuse'
  let prevSortField = null; // for smart secondary sort
  let sortAsc = true;

  // ── Init modules ───────────────────────────────────────────────────────────
  IngredientGrid.init(ingredients, {
    onSelect: (ingredient) => {
      if (currentMode === 'ingredient') {
        IngredientMode.onIngredientSelected(ingredient);
      }
    },
    onMerchantToggle: (id, owned) => {
      MerchantMode.onMerchantToggle(id, owned);
    },
  });

  RecipeBuilder.init((changedIngredients) => {
    if (currentMode === 'ingredient') {
      IngredientMode.onRecipeChanged(changedIngredients);
    }
    // Sync grid selection highlights
    IngredientGrid.setSelectedIds(changedIngredients.map(i => i.id));
    _updateGrid();
  });

  Filters.init(effects, () => _updateGrid());
  Search.init(() => _updateGrid());

  // ── Sort controls ──────────────────────────────────────────────────────────
  const sortNameBtn = document.getElementById('sort-name');
  const sortValueBtn = document.getElementById('sort-value');
  const sortFuseBtn = document.getElementById('sort-fuse');
  const sortDirBtn = document.getElementById('sort-dir');

  function _setSortField(field) {
    prevSortField = sortField !== field ? sortField : prevSortField;
    sortField = field;
    sortAsc = true; // always reset to default (descending) when switching fields
    if (sortDirBtn) sortDirBtn.textContent = '↑';
    sortNameBtn.classList.toggle('active', field === 'name');
    sortValueBtn.classList.toggle('active', field === 'value');
    sortFuseBtn.classList.toggle('active', field === 'fuse');
    _updateGrid();
  }

  sortNameBtn?.addEventListener('click', () => _setSortField('name'));
  sortValueBtn?.addEventListener('click', () => _setSortField('value'));
  sortFuseBtn?.addEventListener('click', () => _setSortField('fuse'));

  sortDirBtn?.addEventListener('click', () => {
    sortAsc = !sortAsc;
    sortDirBtn.textContent = sortAsc ? '↑' : '↓';
    _updateGrid();
  });

  // Fuse show toggle
  document.getElementById('show-fuse-toggle')?.addEventListener('change', (e) => {
    IngredientGrid.setShowFuse(e.target.checked);
  });

  Results.renderFavorites();

  // ── Mode tabs ───────────────────────────────────────────────────────────────
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      if (mode === currentMode) return;

      // Update tab active state
      document.querySelectorAll('.mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.mode === mode);
        t.setAttribute('aria-selected', t.dataset.mode === mode);
      });

      currentMode = mode;
      _activateMode(mode);
    });
  });

  // ── Initial mode ─────────────────────────────────────────────────────────────
  _activateMode('ingredient');

  // ── Grid update ───────────────────────────────────────────────────────────
  function _updateGrid() {
    let filtered = ingredients.filter(i => Filters.passes(i) && Search.matches(i));

    filtered = [...filtered].sort((a, b) => {
      let primary, secondary;

      if (sortField === 'value') {
        primary = (a.sell_price || 0) - (b.sell_price || 0);
        // secondary: fuse if it was previously selected, else name
        secondary = prevSortField === 'fuse'
          ? (a.fuse_value || 0) - (b.fuse_value || 0)
          : a.name.localeCompare(b.name);
      } else if (sortField === 'fuse') {
        primary = (a.fuse_value || 0) - (b.fuse_value || 0);
        // secondary: value if it was previously selected, else name
        secondary = prevSortField === 'value'
          ? (a.sell_price || 0) - (b.sell_price || 0)
          : a.name.localeCompare(b.name);
      } else {
        // name sort: simple, no secondary
        primary = a.name.localeCompare(b.name);
        secondary = 0;
      }

      // sortAsc=true = descending (high→low for numbers, Z→A for names)
      const cmp = primary !== 0 ? primary : secondary;
      return sortAsc ? -cmp : cmp;
    });

    IngredientGrid.renderGrid(filtered);
  }

  function _activateMode(mode) {
    currentMode = mode;

    // Clear results when switching modes
    document.getElementById('results-content').innerHTML =
      '<p class="placeholder-text">Add ingredients and cook to see results.</p>';

    switch (mode) {
      case 'ingredient':
        document.querySelector('.ingredient-section')?.classList.remove('goal-active');
        IngredientGrid.setHighlightedIds([]);
        IngredientMode.activate(effects);
        IngredientGrid.setMode('ingredient');
        IngredientGrid.setSelectedIds(RecipeBuilder.getIngredients().map(i => i.id));
        break;

      case 'goal':
        GoalMode.activate(ingredients, effects);
        IngredientGrid.setMode('ingredient'); // grid stays navigable
        break;

      case 'merchant':
        document.querySelector('.ingredient-section')?.classList.remove('goal-active');
        IngredientGrid.setHighlightedIds([]);
        MerchantMode.activate(ingredients, effects);
        IngredientGrid.setMode('merchant');
        break;
    }

    _updateGrid();
  }

  // ── Initial grid render ────────────────────────────────────────────────────
  _updateGrid();

})();
