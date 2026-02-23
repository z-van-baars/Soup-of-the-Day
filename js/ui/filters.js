/**
 * filters.js — Category filter sidebar
 * Manages checkboxes + effect filter chips; notifies grid on change.
 */

const Filters = (() => {
  let _onChange = null;

  // Track which categories and effects are enabled
  const activeCategories = new Set([
    'fruit', 'vegetable', 'mushroom', 'meat', 'fish', 'seafood', 'herb', 'nut', 'other',
    'bug', 'lizard', 'frog',
    // dragon-part and monster-part are off by default — opt in via sidebar
    // monster-part is controlled via subcategories — don't add here
  ]);

  // Monster part subcategories (all active by default)
  const activeSubcategories = new Set([
    'eyeballs', 'wings', 'horns', 'fangs', 'tails', 'guts', 'claws', 'jellies', 'zonai', 'other',
  ]);

  const activeEffects = new Set(); // empty = all effects; populated after data load

  // Fuse filters
  let fuseHideAll = false;
  let fuseMaxEnabled = false;
  let fuseMaxValue = 30;

  // Sell value filters
  let valueMinEnabled = false;
  let valueMinValue   = 5;
  let valueMaxEnabled = false;
  let valueMaxValue   = 100;

  function init(effects, onChangeFn) {
    _onChange = onChangeFn;

    // Populate effect filter chips
    _buildEffectFilters(effects);

    // Category checkboxes (non-monster)
    document.querySelectorAll('input[name="filter"]').forEach(cb => {
      if (activeCategories.has(cb.value)) cb.checked = true;
      cb.addEventListener('change', () => {
        if (cb.checked) activeCategories.add(cb.value);
        else activeCategories.delete(cb.value);
        _syncTypeMaster(cb.dataset.type);
        _notifyChange();
      });
    });

    // Subcategory checkboxes (monster parts)
    document.querySelectorAll('input[name="subcategory-filter"]').forEach(cb => {
      if (activeSubcategories.has(cb.value)) cb.checked = true;
      cb.addEventListener('change', () => {
        if (cb.checked) activeSubcategories.add(cb.value);
        else activeSubcategories.delete(cb.value);
        _syncTypeMaster(cb.dataset.type);
        _notifyChange();
      });
    });

    // Type-level master checkboxes
    document.querySelectorAll('input[data-type-master]').forEach(master => {
      master.addEventListener('change', () => {
        const type = master.dataset.typeMaster;
        if (type === 'monster') {
          // Controls subcategory checkboxes
          document.querySelectorAll('input[name="subcategory-filter"]').forEach(cb => {
            cb.checked = master.checked;
            if (master.checked) activeSubcategories.add(cb.value);
            else activeSubcategories.delete(cb.value);
          });
        } else {
          document.querySelectorAll(`input[data-type="${type}"]`).forEach(cb => {
            cb.checked = master.checked;
            if (master.checked) activeCategories.add(cb.value);
            else activeCategories.delete(cb.value);
          });
        }
        _notifyChange();
      });
    });

    // All / None shortcuts
    document.getElementById('filter-all')?.addEventListener('click', () => {
      document.querySelectorAll('input[name="filter"]').forEach(cb => {
        cb.checked = true;
        activeCategories.add(cb.value);
      });
      document.querySelectorAll('input[name="subcategory-filter"]').forEach(cb => {
        cb.checked = true;
        activeSubcategories.add(cb.value);
      });
      document.querySelectorAll('input[data-type-master]').forEach(m => {
        m.checked = true;
        m.indeterminate = false;
      });
      activeEffects.clear();
      document.querySelectorAll('input[name="effect-filter"]').forEach(cb => cb.checked = true);
      _notifyChange();
    });

    document.getElementById('filter-none')?.addEventListener('click', () => {
      document.querySelectorAll('input[name="filter"]').forEach(cb => {
        cb.checked = false;
        activeCategories.delete(cb.value);
      });
      document.querySelectorAll('input[name="subcategory-filter"]').forEach(cb => {
        cb.checked = false;
        activeSubcategories.delete(cb.value);
      });
      document.querySelectorAll('input[data-type-master]').forEach(m => {
        m.checked = false;
        m.indeterminate = false;
      });
      _notifyChange();
    });

    // Fuse filters
    const noFuseChk = document.getElementById('filter-no-fuse');
    const fuseMaxChk = document.getElementById('filter-fuse-max-enabled');
    const fuseIncrementer = document.getElementById('fuse-incrementer');
    const fuseValEl = document.getElementById('fuse-max-val');
    const fuseDecBtn = document.getElementById('fuse-dec');
    const fuseIncBtn = document.getElementById('fuse-inc');

    noFuseChk?.addEventListener('change', () => {
      fuseHideAll = noFuseChk.checked;
      _notifyChange();
    });

    fuseMaxChk?.addEventListener('change', () => {
      fuseMaxEnabled = fuseMaxChk.checked;
      if (fuseIncrementer) {
        fuseIncrementer.style.opacity = fuseMaxEnabled ? '1' : '0.4';
        fuseIncrementer.style.pointerEvents = fuseMaxEnabled ? 'auto' : 'none';
      }
      _notifyChange();
    });

    fuseDecBtn?.addEventListener('click', () => {
      fuseMaxValue = Math.max(1, fuseMaxValue - 1);
      if (fuseValEl) fuseValEl.textContent = fuseMaxValue;
      _notifyChange();
    });

    fuseIncBtn?.addEventListener('click', () => {
      fuseMaxValue = Math.min(99, fuseMaxValue + 1);
      if (fuseValEl) fuseValEl.textContent = fuseMaxValue;
      _notifyChange();
    });

    // Sell value filters
    const valueMinChk = document.getElementById('filter-value-min-enabled');
    const valueMinInc = document.getElementById('value-min-incrementer');
    const valueMinValEl = document.getElementById('value-min-val');
    const valueMinDecBtn = document.getElementById('value-min-dec');
    const valueMinIncBtn = document.getElementById('value-min-inc');

    const valueMaxChk = document.getElementById('filter-value-max-enabled');
    const valueMaxInc = document.getElementById('value-max-incrementer');
    const valueMaxValEl = document.getElementById('value-max-val');
    const valueMaxDecBtn = document.getElementById('value-max-dec');
    const valueMaxIncBtn = document.getElementById('value-max-inc');

    valueMinChk?.addEventListener('change', () => {
      valueMinEnabled = valueMinChk.checked;
      if (valueMinInc) {
        valueMinInc.style.opacity = valueMinEnabled ? '1' : '0.4';
        valueMinInc.style.pointerEvents = valueMinEnabled ? 'auto' : 'none';
      }
      _notifyChange();
    });

    valueMinDecBtn?.addEventListener('click', () => {
      valueMinValue = Math.max(0, valueMinValue - 5);
      if (valueMinValEl) valueMinValEl.textContent = valueMinValue;
      _notifyChange();
    });

    valueMinIncBtn?.addEventListener('click', () => {
      valueMinValue = Math.min(300, valueMinValue + 5);
      if (valueMinValEl) valueMinValEl.textContent = valueMinValue;
      _notifyChange();
    });

    valueMaxChk?.addEventListener('change', () => {
      valueMaxEnabled = valueMaxChk.checked;
      if (valueMaxInc) {
        valueMaxInc.style.opacity = valueMaxEnabled ? '1' : '0.4';
        valueMaxInc.style.pointerEvents = valueMaxEnabled ? 'auto' : 'none';
      }
      _notifyChange();
    });

    valueMaxDecBtn?.addEventListener('click', () => {
      valueMaxValue = Math.max(1, valueMaxValue - 5);
      if (valueMaxValEl) valueMaxValEl.textContent = valueMaxValue;
      _notifyChange();
    });

    valueMaxIncBtn?.addEventListener('click', () => {
      valueMaxValue = Math.min(300, valueMaxValue + 5);
      if (valueMaxValEl) valueMaxValEl.textContent = valueMaxValue;
      _notifyChange();
    });

    // Collapsible section toggles
    document.querySelectorAll('.filter-section-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.closest('.filter-section');
        const collapsed = section.classList.toggle('collapsed');
        btn.textContent = collapsed ? '▶' : '▼';
        btn.setAttribute('aria-label', collapsed ? 'Expand section' : 'Collapse section');
      });
    });

    // Mobile sidebar toggle (button inside sidebar header)
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      _toggleMobileSidebar();
    });

    // Mobile filter button (outside sidebar, in search bar area)
    document.getElementById('mobile-filter-btn')?.addEventListener('click', () => {
      _toggleMobileSidebar();
    });

    // Mobile filter button in goal mode controls
    document.getElementById('goal-mobile-filter-btn')?.addEventListener('click', () => {
      _toggleMobileSidebar();
    });

    // Overlay backdrop closes sidebar
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      _closeMobileSidebar();
    });
  }

  function _toggleMobileSidebar() {
    const sidebar = document.getElementById('filters-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btn = document.getElementById('mobile-filter-btn');
    const isOpen = sidebar?.classList.toggle('open');
    overlay?.classList.toggle('visible', isOpen);
    btn?.classList.toggle('active', isOpen);
  }

  function _closeMobileSidebar() {
    document.getElementById('filters-sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
    document.getElementById('mobile-filter-btn')?.classList.remove('active');
  }

  function _buildEffectFilters(effects) {
    const container = document.getElementById('effect-filter-list');
    if (!container || !effects) return;

    container.innerHTML = '';
    for (const effect of effects) {
      const label = document.createElement('label');
      label.className = 'filter-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = 'effect-filter';
      cb.value = effect.id;
      cb.checked = true;

      cb.addEventListener('change', () => {
        if (cb.checked) activeEffects.delete(effect.id);
        else activeEffects.add(effect.id);
        _notifyChange();
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(` ${effect.name}`));
      container.appendChild(label);
    }
  }

  function _syncTypeMaster(type) {
    if (!type) return;
    const master = document.querySelector(`input[data-type-master="${type}"]`);
    if (!master) return;

    let children;
    if (type === 'monster') {
      children = Array.from(document.querySelectorAll('input[name="subcategory-filter"]'));
    } else {
      children = Array.from(document.querySelectorAll(`input[data-type="${type}"]`));
    }
    if (!children.length) return;

    const allChecked = children.every(cb => cb.checked);
    const noneChecked = children.every(cb => !cb.checked);
    master.checked = allChecked;
    master.indeterminate = !allChecked && !noneChecked;
  }

  function _notifyChange() {
    if (_onChange) _onChange({ activeCategories, activeSubcategories, activeEffects });
  }

  function getActiveCategories() { return activeCategories; }
  function getActiveEffects() { return activeEffects; }

  /**
   * Returns true if an ingredient passes current filters.
   */
  function passes(ingredient) {
    // Monster parts filtered by subcategory
    if (ingredient.category === 'monster-part') {
      if (!activeSubcategories.has(ingredient.subcategory || 'other')) return false;
    } else {
      if (!activeCategories.has(ingredient.category)) return false;
    }

    // Effect filter
    if (ingredient.effect && activeEffects.has(ingredient.effect)) return false;

    // Fuse filters
    const fuse = ingredient.fuse_value;
    if (fuseHideAll && fuse && fuse > 1) return false;
    if (fuseMaxEnabled && fuse && fuse > fuseMaxValue) return false;

    // Sell value filters
    const sellPrice = ingredient.sell_price || 0;
    if (valueMinEnabled && sellPrice < valueMinValue) return false;
    if (valueMaxEnabled && sellPrice > valueMaxValue) return false;

    return true;
  }

  return { init, passes, getActiveCategories, getActiveEffects };
})();
