// Filtrering, sortering og visning af rejser på forsiden.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmtKr = (n) => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(n) + ' kr.';
  const fmtDate = (iso) => new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso + 'T12:00:00'));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const els = {
    q: $('#q'), onlyNoSup: $('#onlyNoSup'), onlyPrice: $('#onlyPrice'), dFrom: $('#dFrom'), dTo: $('#dTo'),
    pmax: $('#pmax'), pmaxVal: $('#pmaxVal'), sort: $('#sort'), grid: $('#grid'), count: $('#count'),
    empty: $('#empty'), filters: $('#filters'), toggle: $('#filterToggle'), active: $('#activeCount'),
  };
  const PMAX = +els.pmax.max;
  const state = { months: new Set(), dur: new Set() };

  const checked = (name) => $$(`input[name="${name}"]:checked`).map((i) => i.value);

  function matches(t) {
    const q = norm(els.q.value.trim());
    if (q && !norm([t.title, t.country, t.destination, t.operator, t.type].join(' ')).includes(q)) return false;
    if (els.onlyNoSup.checked && !['ingen-tillaeg', 'solo-gruppe', 'reduceret-tillaeg'].includes(t.solo)) return false;
    if (els.onlyPrice.checked && t.price == null) return false;
    if (els.dFrom.value && (!t.date || t.date < els.dFrom.value)) return false;
    if (els.dTo.value && (!t.date || t.date > els.dTo.value)) return false;
    if (state.months.size && (!t.date || !state.months.has(t.date.slice(0, 7)))) return false;
    if (+els.pmax.value < PMAX && (t.price == null || t.price > +els.pmax.value)) return false;
    if (state.dur.size) {
      const n = t.nights ?? (t.days ? t.days - 1 : null);
      if (n == null) return false;
      if (![...state.dur].some((r) => { const [a, b] = r.split('-').map(Number); return n >= a && n <= b; })) return false;
    }
    for (const [name, key] of [['type', 'type'], ['country', 'country'], ['board', 'board'], ['operator', 'operator']]) {
      const sel = checked(name);
      if (sel.length && !sel.includes(t[key])) return false;
    }
    return true;
  }

  const sorters = {
    date: (a, b) => (a.date || '9999').localeCompare(b.date || '9999'),
    price: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
    pct: (a, b) => (a.pct ?? Infinity) - (b.pct ?? Infinity),
    nights: (a, b) => (b.nights ?? 0) - (a.nights ?? 0),
  };

  function card(t) {
    const solo = SOLO[t.solo] || SOLO.ukendt;
    const meta = [t.date ? fmtDate(t.date) : null, t.nights ? `${t.nights} nætter` : (t.days ? `${t.days} dage` : null), t.board].filter(Boolean).join(' · ');
    const price = t.price != null ? `<span class="p-from">${t.from ? 'fra' : 'solopris'}</span><span class="p-val">${fmtKr(t.price)}</span>` : '<span class="p-na">Pris hos udbyder</span>';
    const delta = t.pct != null ? `<span class="p-delta ${t.pct <= 0 ? 'good' : ''}">${t.pct > 0 ? '+' : ''}${t.pct} % ift. 2 rejsende</span>` : '';
    return `<a class="card" href="rejse/${esc(t.id)}.html">
      <div class="thumb${t.img ? ' has-img' : ''}" style="--g1:${t.grad[0]};--g2:${t.grad[1]}">${t.img ? `<img src="${esc(t.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentNode.classList.remove('has-img')">` : ''}<span aria-hidden="true">${t.icon}</span><em>${esc(t.type)}</em></div>
      <div class="body">
        <p class="op">${esc(t.operator)} · ${esc(t.country)}</p>
        <h3>${esc(t.title)}</h3>
        <p class="meta">${esc(meta)}</p>
        <span class="solo ${solo.cls}">${solo.label}</span>
        <div class="price">${price}${delta}</div>
      </div>
    </a>`;
  }

  function activeFilters() {
    let n = 0;
    if (els.q.value.trim()) n++;
    if (els.onlyNoSup.checked) n++;
    if (els.onlyPrice.checked) n++;
    if (els.dFrom.value || els.dTo.value) n++;
    if (+els.pmax.value < PMAX) n++;
    n += state.months.size ? 1 : 0;
    n += state.dur.size ? 1 : 0;
    n += $$('.filters input[type=checkbox][name]:checked').length;
    return n;
  }

  function render() {
    els.pmaxVal.textContent = +els.pmax.value >= PMAX ? 'Alle priser' : fmtKr(+els.pmax.value);
    const res = TRIPS.filter(matches).sort(sorters[els.sort.value]);
    els.grid.innerHTML = res.map(card).join('');
    els.count.innerHTML = `<strong>${res.length}</strong> ${res.length === 1 ? 'rejse' : 'rejser'} fundet`;
    els.empty.hidden = res.length > 0;
    const n = activeFilters();
    els.active.textContent = n ? `(${n})` : '';
  }

  function reset() {
    els.q.value = ''; els.dFrom.value = ''; els.dTo.value = '';
    els.onlyNoSup.checked = false; els.onlyPrice.checked = false;
    els.pmax.value = PMAX; els.sort.value = 'date';
    $$('.filters input[type=checkbox]').forEach((c) => (c.checked = false));
    state.months.clear(); state.dur.clear();
    $$('.chip.on').forEach((c) => c.classList.remove('on'));
    render();
  }

  function chipGroup(sel, attr, set) {
    $$(`${sel} .chip`).forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset[attr];
      set.has(v) ? set.delete(v) : set.add(v);
      b.classList.toggle('on');
      render();
    }));
  }
  chipGroup('#months', 'm', state.months);
  chipGroup('#dur', 'd', state.dur);

  $$('.filters input, #sort').forEach((e) => e.addEventListener('input', render));
  $('#reset').addEventListener('click', reset);
  $('#reset2').addEventListener('click', reset);
  els.toggle.addEventListener('click', () => {
    const open = els.filters.classList.toggle('open');
    els.toggle.setAttribute('aria-expanded', open);
  });

  render();
})();
