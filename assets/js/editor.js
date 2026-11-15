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
        var inp = el('input', { 'class': 'form-control form-control-sm', type: 'text', placeholder: c.placeholder || '' });
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
    var r = E.render(def, values, seed);
    var vm = r.visible;
    (def.fields || []).forEach(function (f) {
      var w = $('[data-field="' + f.name + '"]', form);
      if (w) w.style.display = vm.fields[f.name] ? '' : 'none';
      if (f.type === 'amount') {
        var wd = $('[data-words="' + f.name + '"]', form);
        if (wd) { var n = E.parseNum(values[f.name]); wd.textContent = isNaN(n) ? '' : '= ' + E.words(n) + ' টাকা'; }
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
    values = E.defaults(def); draftId = 0;
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
    buildForm(); update();
  });
  $('#btn-print').addEventListener('click', function () {
    var r = E.render(def, values, seed);
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

  buildForm();
  update();
})();
