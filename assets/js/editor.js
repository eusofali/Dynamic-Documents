/* Dynamic Documents – live editor (form on the left, paged preview on the right) */
(function () {
  'use strict';
  var DD = window.DD, def = DD.def, E = window.DDEngine;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS_KEY = 'dd:v1:' + def.id;

  var values = E.defaults(def);
  var seed = Math.floor(Math.random() * 1e9) + 1;
  var draftId = 0;
  var fs = (def.page && def.page.fontSize) || 16;
  var zoomManual = null;
  var lastSuggest = {};
  var LH_KEY = 'dd:lh:' + def.id;
  var useLH = true;
  try { if (localStorage.getItem(LH_KEY) === '0') useLH = false; } catch (e) { /* ignore */ }

  /* ---------- restore ---------- */
  function merge(src) {
    if (!src) return;
    (def.fields || []).forEach(function (f) {
      if (src[f.name] !== undefined) values[f.name] = src[f.name];
    });
  }
  if (DD.draft) {
    merge(DD.draft.data); seed = DD.draft.seed || seed; draftId = DD.draft.id;
  } else {
    try {
      var saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (saved) { merge(saved.values); seed = saved.seed || seed; }
    } catch (e) { /* storage unavailable */ }
  }
  var STICKY_KEY = 'dd:sticky:' + def.id;
  function loadSticky() {
    try {
      var st = JSON.parse(localStorage.getItem(STICKY_KEY) || 'null');
      if (st) (def.fields || []).forEach(function (f) { if (f.sticky && st[f.name] !== undefined) values[f.name] = st[f.name]; });
    } catch (e) { /* ignore */ }
  }
  function saveSticky() {
    try {
      var st = {};
      (def.fields || []).forEach(function (f) { if (f.sticky) st[f.name] = values[f.name]; });
      localStorage.setItem(STICKY_KEY, JSON.stringify(st));
    } catch (e) { /* ignore */ }
  }
  if (!DD.draft) loadSticky();
  E.computeCalc(def, values);

  /* ---------- form building ---------- */
  var form = $('#form');
  var inputs = {};

  function optVal(o) { return typeof o === 'object' ? o.value : o; }
  function optLabel(o) { return typeof o === 'object' ? (o.label || o.value) : o; }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }

  function buildField(f) {
    var wrap = el('div', { 'class': 'col-12 col-md-' + (f.col || 6), 'data-field': f.name });
    var label = el('label', { 'for': 'f_' + f.name }, E.esc(f.label || f.name) + (f.required && f.type !== 'checkbox' ? ' <span class="req">*</span>' : ''));
    var input;
    if (f.type === 'checkbox') {
      var fc = el('div', { 'class': 'form-check form-switch pt-3' });
      input = el('input', { 'class': 'form-check-input', type: 'checkbox', id: 'f_' + f.name });
      input.checked = !!values[f.name];
      input.addEventListener('change', function () { values[f.name] = input.checked ? '1' : ''; changed(f.name); });
      fc.appendChild(input);
      fc.appendChild(el('label', { 'class': 'form-check-label fw-bold', 'for': 'f_' + f.name }, E.esc(f.label || f.name)));
      wrap.appendChild(fc);
    } else if (f.type === 'photo') {
      wrap.appendChild(label);
      wrap.appendChild(buildPhoto(f));
      inputs[f.name] = wrap;
    } else if (f.type === 'party') {
      wrap.appendChild(label);
      wrap.appendChild(buildParty(f));
      inputs[f.name] = wrap;
    } else if (f.type === 'rows') {
      wrap.appendChild(label);
      wrap.appendChild(buildRows(f));
      inputs[f.name] = wrap;
    } else {
      wrap.appendChild(label);
      if (f.type === 'textarea') {
        input = el('textarea', { 'class': 'form-control', rows: f.rows || 3, id: 'f_' + f.name });
      } else if (f.type === 'select') {
        input = el('select', { 'class': 'form-select', id: 'f_' + f.name });
        (f.options || []).forEach(function (o) {
          var op = el('option', { value: optVal(o) }, E.esc(optLabel(o)));
          input.appendChild(op);
        });
      } else {
        input = el('input', { 'class': 'form-control', id: 'f_' + f.name, type: f.type === 'date' ? 'date' : 'text' });
        if (f.type === 'amount' || f.type === 'number') input.setAttribute('inputmode', 'numeric');
        if (f.calc) { input.readOnly = true; input.classList.add('bg-light'); }
      }
      if (f.placeholder) input.setAttribute('placeholder', f.placeholder);
      input.value = values[f.name] == null ? '' : values[f.name];
      var evt = f.type === 'select' || f.type === 'date' ? 'change' : 'input';
      input.addEventListener(evt, function () { values[f.name] = input.value; changed(f.name); });
      if (evt === 'change') input.addEventListener('input', function () { values[f.name] = input.value; changed(f.name); });
      wrap.appendChild(input);
      if (f.type === 'amount') wrap.appendChild(el('div', { 'class': 'words', 'data-words': f.name }));
    }
    if (f.help) wrap.appendChild(el('div', { 'class': 'form-text' }, E.esc(f.help)));
    inputs[f.name] = inputs[f.name] || input;
    return wrap;
  }

  /* photo: choose a file, centre-crop to passport ratio, downscale, store as a small JPEG data URL */
  function buildPhoto(f) {
    var box = el('div', { 'class': 'd-flex align-items-center gap-3' });
    var img = el('img', { 'class': 'rounded border bg-white', style: 'width:72px;height:88px;object-fit:cover;display:none', alt: '' });
    var file = el('input', { type: 'file', accept: 'image/*', 'class': 'form-control form-control-sm', id: 'f_' + f.name });
    var rm = el('button', { type: 'button', 'class': 'btn btn-sm btn-outline-danger', style: 'display:none' }, '<i class="fas fa-trash"></i>');
    var col = el('div', { 'class': 'flex-grow-1' });
    col.appendChild(file); col.appendChild(rm);
    box.appendChild(img); box.appendChild(col);
    function show() {
      var v = values[f.name];
      img.style.display = v ? '' : 'none'; rm.style.display = v ? '' : 'none';
      if (v) img.src = v;
    }
    file.addEventListener('change', function () {
      var fl = file.files && file.files[0];
      if (!fl) return;
      if (!/^image\//.test(fl.type)) { toast('Please choose an image file'); return; }
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var W = 360, H = 440, c = document.createElement('canvas');
          c.width = W; c.height = H;
          var ctx = c.getContext('2d'), r = Math.max(W / im.width, H / im.height);
          var sw = W / r, sh = H / r;
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
          ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, W, H);
          values[f.name] = c.toDataURL('image/jpeg', 0.86);
          show(); changed(f.name);
        };
        im.onerror = function () { toast('Could not read that image'); };
        im.src = fr.result;
      };
      fr.readAsDataURL(fl);
    });
    rm.addEventListener('click', function () { values[f.name] = ''; file.value = ''; show(); changed(f.name); });
    show();
    return box;
  }

  /* party: one card per person (several sellers, buyers, borrowers ...) */
  function buildParty(f) {
    var box = el('div');
    var list = el('div');
    var cols = f.columns || [];
    var who = f.personLabel || 'ব্যক্তি';

    function renumber() {
      var cards = $$('.party-card', list);
      cards.forEach(function (c, i) {
        $('.party-no', c).textContent = who + ' ' + (cards.length > 1 ? (i + 1) : '');
        $('.party-del', c).style.visibility = cards.length > 1 ? 'visible' : 'hidden';
      });
    }
    function sync() {
      values[f.name] = $$('.party-card', list).map(function (card) {
        var o = {};
        $$('[data-c]', card).forEach(function (inp) { o[inp.getAttribute('data-c')] = inp.value; });
        return o;
      });
      changed(f.name);
    }
    function addPerson(rowVals, silent) {
      var card = el('div', { 'class': 'party-card border rounded p-2 mb-2 bg-white' });
      var head = el('div', { 'class': 'd-flex align-items-center mb-1' }, '<strong class="small text-primary party-no"></strong>');
      var del = el('button', { type: 'button', 'class': 'btn btn-sm btn-outline-danger ms-auto party-del', title: 'Remove this person' }, '<i class="fas fa-user-minus"></i>');
      del.addEventListener('click', function () { card.remove(); renumber(); sync(); });
      head.appendChild(del); card.appendChild(head);
      var row = el('div', { 'class': 'row g-2' });
      cols.forEach(function (c) {
        var w = el('div', { 'class': 'col-12 col-md-' + (c.col || 6) });
        w.appendChild(el('label', { 'class': 'small fw-bold mb-0' }, E.esc(c.label || c.name)));
        var inp = el('input', { 'class': 'form-control form-control-sm', type: c.type === 'date' ? 'date' : 'text', 'data-c': c.name });
        if (c.placeholder) inp.setAttribute('placeholder', c.placeholder);
        inp.value = rowVals && rowVals[c.name] != null ? rowVals[c.name] : (c['default'] || '');
        inp.addEventListener('input', sync);
        if (c.type === 'date') inp.addEventListener('change', sync);
        w.appendChild(inp); row.appendChild(w);
      });
      card.appendChild(row); list.appendChild(card);
      renumber();
      if (!silent) sync();
    }
    var initial = (values[f.name] && values[f.name].length) ? values[f.name] : [{}];
    initial.forEach(function (r) { addPerson(r, true); });
    // store column defaults (e.g. religion) of the initial cards without re-rendering
    values[f.name] = $$('.party-card', list).map(function (card) {
      var o = {};
      $$('[data-c]', card).forEach(function (inp) { o[inp.getAttribute('data-c')] = inp.value; });
      return o;
    });
    var add = el('button', { 'class': 'btn btn-sm btn-outline-primary', type: 'button' }, '<i class="fas fa-user-plus"></i> ' + E.esc(f.addLabel || 'আরও একজন যুক্ত করুন'));
    add.addEventListener('click', function () { addPerson({}); });
    box.appendChild(list); box.appendChild(add);
    return box;
  }

  function buildRows(f) {
    var box = el('div', { 'class': 'table-responsive' });
    var table = el('table', { 'class': 'table table-sm table-bordered rows-table align-middle mb-1' });
    var thead = '<thead class="table-light"><tr>' + (f.columns || []).map(function (c) { return '<th>' + E.esc(c.label || c.name) + '</th>'; }).join('') + '<th style="width:36px"></th></tr></thead>';
    table.innerHTML = thead + '<tbody></tbody>';
    var tbody = table.querySelector('tbody');

    function addRow(rowVals, silent) {
      var tr = el('tr');
      (f.columns || []).forEach(function (c) {
        var td = el('td');
        var inp = el('input', { 'class': 'form-control form-control-sm', type: c.type === 'date' ? 'date' : 'text', placeholder: c.placeholder || '' });
        inp.value = rowVals && rowVals[c.name] != null ? rowVals[c.name] : '';
        inp.addEventListener('input', sync);
        td.appendChild(inp); tr.appendChild(td);
      });
      var td2 = el('td');
      var del = el('button', { 'class': 'btn btn-sm btn-outline-danger', type: 'button', title: 'Remove row' }, '<i class="fas fa-trash"></i>');
      del.addEventListener('click', function () { tr.remove(); sync(); });
      td2.appendChild(del); tr.appendChild(td2);
      tbody.appendChild(tr);
      if (!silent) sync();
    }
    function sync() {
      values[f.name] = $$('tr', tbody).map(function (tr) {
        var o = {};
        $$('input', tr).forEach(function (inp, i) { o[f.columns[i].name] = inp.value; });
        return o;
      });
      changed(f.name);
    }
    (values[f.name] || []).forEach(function (r) { addRow(r, true); });
    var add = el('button', { 'class': 'btn btn-sm btn-outline-primary', type: 'button' }, '<i class="fas fa-plus"></i> Add row');
    add.addEventListener('click', function () { addRow({}); });
    box.appendChild(table); box.appendChild(add);
    return box;
  }

  function buildForm() {
    form.innerHTML = '';
    if (def.notice) form.insertAdjacentHTML('afterbegin', '<div class="alert alert-warning small"><i class="fas fa-info-circle"></i> ' + E.esc(def.notice) + '</div>');
    var groups = def.groups && def.groups.length ? def.groups : [{ id: '_', title: def.title }];
    groups.forEach(function (g) {
      var card = el('div', { 'class': 'card', 'data-group': g.id });
      card.appendChild(el('div', { 'class': 'card-header' }, (g.icon ? '<i class="fas ' + E.esc(g.icon) + ' me-2"></i>' : '') + E.esc(g.title || '')));
      var body = el('div', { 'class': 'card-body row g-2' });
      (def.fields || []).forEach(function (f) {
        if ((f.group || '_') === g.id || (!f.group && groups[0].id === g.id)) body.appendChild(buildField(f));
      });
      card.appendChild(body);
      form.appendChild(card);
    });
  }

  /* ---------- reacting to changes ---------- */
  var timer = null;
  function changed(name) {
    var cf = (def.fields || []).filter(function (x) { return x.name === name; })[0];
    if (cf && cf.sticky) saveSticky();
    // suggested defaults that depend on this field (e.g. fuel type by vehicle type)
    (def.fields || []).forEach(function (f) {
      if (!f.suggest || !f.suggest[name]) return;
      var next = f.suggest[name][values[name]];
      if (next === undefined) return;
      var known = Object.keys(f.suggest[name]).map(function (k) { return f.suggest[name][k]; });
      if (values[f.name] === '' || known.indexOf(values[f.name]) > -1) {
        values[f.name] = next; lastSuggest[f.name] = next;
        if (inputs[f.name] && inputs[f.name].value !== undefined) inputs[f.name].value = next;
      }
    });
    var before = JSON.stringify(values);
    E.computeCalc(def, values);
    if (JSON.stringify(values) !== before) {
      (def.fields || []).forEach(function (f) {
        if (f.calc && inputs[f.name]) inputs[f.name].value = values[f.name];
      });
    }
    clearTimeout(timer);
    timer = setTimeout(update, 60);
    scheduleSave();
  }

  function update() {
    var r = E.render(def, values, seed, { letterhead: useLH ? DD.letterhead : null });
    var vm = r.visible;
    (def.fields || []).forEach(function (f) {
      var w = $('[data-field="' + f.name + '"]', form);
      if (w) w.style.display = vm.fields[f.name] ? '' : 'none';
      if (f.type === 'amount') {
        var wd = $('[data-words="' + f.name + '"]', form);
        if (wd) { var n = E.parseNum(values[f.name]); wd.textContent = isNaN(n) ? '' : '= ' + E.words(n) + (f.unit === '' ? '' : ' ' + (f.unit || 'টাকা')); }
      }
    });
    $$('[data-group]', form).forEach(function (c) {
      var vis = vm.groups[c.getAttribute('data-group')] !== false;
      var anyField = $$('[data-field]', c).some(function (x) { return x.style.display !== 'none'; });
      c.style.display = vis && anyField ? '' : 'none';
    });
    var prev = $('#preview');
    prev.className = 'dd-doc' + (def.page && def.page.font === 'en' ? ' font-en' : '');
    prev.setAttribute('style', r.vars.replace(/--fs:[^;]+/, '--fs:' + fs + 'px'));
    prev.innerHTML = r.html;
    $('#page-style').textContent = r.css.split('}')[0] + '}';
    $('#def-style').textContent = r.css.slice(r.css.indexOf('}') + 1);
    applyGuide();
    fit();
    $$('.is-missing', form).forEach(function (n) { n.classList.remove('is-missing'); });
  }

  /* ---------- zoom-to-fit ---------- */
  function pageWidthPx() {
    var d = document.createElement('div');
    d.style.cssText = 'position:absolute;visibility:hidden;width:' + getComputedStyle($('#preview')).getPropertyValue('--pw');
    document.body.appendChild(d); var w = d.offsetWidth; d.remove(); return w || 800;
  }
  function fit() {
    var pane = $('#preview-pane'), z = zoomManual;
    if (!z) { z = Math.min(1, (pane.clientWidth - 32) / pageWidthPx()); if (z < 0.3) z = 0.3; }
    $('#preview-zoom').style.zoom = z;
    $('#zoom-note').textContent = 'Preview ' + Math.round(z * 100) + '% · actual size when printed';
  }
  window.addEventListener('resize', function () { zoomManual = null; fit(); });

  /* ---------- storage / drafts ---------- */
  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(LS_KEY, JSON.stringify({ values: values, seed: seed })); } catch (e) { /* ignore */ }
    }, 400);
  }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  function draftTitle() {
    var first = (def.fields || []).filter(function (f) { return (f.type === 'text') && values[f.name]; })[0];
    return (first ? values[first.name] : '') || def.title;
  }
  function csrf() { return document.querySelector('meta[name=csrf-token]').content; }

  $('#btn-save').addEventListener('click', function () {
    if (!DD.user) {
      if (confirm('Login is needed to save drafts on the server. Your entries are already auto-saved in this browser.\n\nGo to login now?')) location.href = DD.login;
      return;
    }
    fetch(DD.api + '?a=draft_save', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
      body: JSON.stringify({ doc: def.id, id: draftId, title: draftTitle(), data: values, seed: seed })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) { draftId = j.id; toast('Draft saved ✔'); history.replaceState(null, '', '?d=' + encodeURIComponent(def.id) + '&draft=' + draftId); }
      else toast(j.error || 'Could not save');
    }).catch(function () { toast('Network error'); });
  });

  /* ---------- toolbar ---------- */
  $('#btn-respin').addEventListener('click', function () { seed = Math.floor(Math.random() * 1e9) + 1; update(); scheduleSave(); toast('Wording re-generated'); });
  $('#btn-fs-inc').addEventListener('click', function () { fs = Math.min(24, fs + 1); update(); });
  $('#btn-fs-dec').addEventListener('click', function () { fs = Math.max(10, fs - 1); update(); });
  $('#btn-reset').addEventListener('click', function () {
    if (!confirm('Clear all entries in this form?')) return;
    values = E.defaults(def); draftId = 0; loadSticky();
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
    buildForm(); update();
  });
  $('#btn-print').addEventListener('click', function () {
    var r = E.render(def, values, seed, { letterhead: useLH ? DD.letterhead : null });
    if (r.missing.length) {
      r.missing.forEach(function (n) {
        var i = inputs[n]; if (i && i.classList) i.classList.add('is-missing');
      });
      var first = inputs[r.missing[0]];
      if (first && first.scrollIntoView) { first.scrollIntoView({ block: 'center' }); }
      if (!confirm(r.missing.length + ' required field(s) are empty (highlighted). Print anyway? Empty fields appear as blank lines.')) return;
    }
    window.print();
  });
  $$('.dd-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.dd-tabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
      $('.dd-split').setAttribute('data-pane', b.getAttribute('data-pane'));
      setTimeout(fit, 30);
    });
  });
  $('#preview-pane').addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    var cur = parseFloat($('#preview-zoom').style.zoom) || 1;
    zoomManual = Math.max(0.3, Math.min(2, cur + (e.deltaY < 0 ? 0.05 : -0.05)));
    fit();
  }, { passive: false });

  /* guide image: scan of the pre-printed form, shown behind the text on screen only (never printed) */
  var GUIDE_KEY = 'dd:guide:' + def.id;
  function applyGuide() {
    var prev = $('#preview'), g = null;
    try { g = localStorage.getItem(GUIDE_KEY); } catch (e) { /* ignore */ }
    if (g && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(g)) {
      prev.style.setProperty('--guide', 'url("' + g + '")');
      prev.classList.add('has-guide');
    } else {
      prev.style.removeProperty('--guide');
      prev.classList.remove('has-guide');
    }
  }
  var guideBtn = $('#btn-guide'), guideFile = $('#guide-file');
  if (guideBtn && guideFile) {
    guideBtn.addEventListener('click', function () {
      var has = false;
      try { has = !!localStorage.getItem(GUIDE_KEY); } catch (e) { /* ignore */ }
      if (has && confirm('Remove the guide image?\n\nOK = remove it   |   Cancel = choose a different image')) {
        try { localStorage.removeItem(GUIDE_KEY); } catch (e) { /* ignore */ }
        applyGuide(); return;
      }
      guideFile.click();
    });
    guideFile.addEventListener('change', function () {
      var fl = guideFile.files && guideFile.files[0];
      if (!fl) return;
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var W = 1400, r = Math.min(1, W / im.width), c = document.createElement('canvas');
          c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          try { localStorage.setItem(GUIDE_KEY, c.toDataURL('image/jpeg', 0.8)); toast('Guide image set (stays on this computer, never printed)'); }
          catch (e) { toast('Image too large for browser storage'); }
          applyGuide();
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(fl);
      guideFile.value = '';
    });
  }

  /* letterhead toggle */
  var lhBtn = $('#btn-lh');
  if (lhBtn) {
    function lhState() {
      lhBtn.classList.toggle('btn-warning', useLH && !!DD.letterhead);
      lhBtn.classList.toggle('btn-outline-light', !(useLH && !!DD.letterhead));
    }
    lhBtn.addEventListener('click', function () {
      if (!DD.letterhead) { toast('Set up your business letterhead in Admin → Settings'); return; }
      useLH = !useLH;
      try { localStorage.setItem(LH_KEY, useLH ? '1' : '0'); } catch (e) { /* ignore */ }
      lhState(); update(); toast(useLH ? 'Letterhead on' : 'Letterhead off');
    });
    lhState();
  }

  /* direct PDF download */
  var pdfBtn = $('#btn-pdf');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', function () {
      var r = E.render(def, values, seed, { letterhead: useLH ? DD.letterhead : null });
      if (r.missing.length && !confirm(r.missing.length + ' required field(s) are empty. Download PDF anyway?')) return;
      var old = pdfBtn.innerHTML;
      pdfBtn.disabled = true; pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PDF…';
      var title = (draftTitle() + ' - ' + def.title).replace(/[\\/:*?"<>|]+/g, ' ').trim();
      var fileBase = def.id + '-' + E.todayIso();   // ASCII-only: some browsers drop non-Latin download names
      window.DDPdf.download($('#preview'), def, fileBase, DD.assets, title).then(function () { toast('PDF downloaded ✔'); })
        .catch(function (e) { toast('PDF failed: ' + (e && e.message ? e.message : e)); })
        .then(function () { pdfBtn.disabled = false; pdfBtn.innerHTML = old; });
    });
  }

  buildForm();
  update();
})();
