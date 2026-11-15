/* Dynamic Documents – visual document builder (admin) */
(function () {
  'use strict';
  var BD = window.BD, E = window.DDEngine;
  var def = BD.def, docId = BD.id, isNew = BD.isNew;
  var seed = 4242;
  var lastTA = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = E.esc;
  var TYPES = ['text', 'textarea', 'number', 'amount', 'date', 'select', 'checkbox', 'rows', 'photo', 'party'];
  var panes = $('#panes'), tab = 'info';
  def.groups = def.groups || []; def.fields = def.fields || []; def.pages = def.pages || []; def.page = def.page || {};

  function msg(t, kind) {
    $('#msg').innerHTML = t ? '<div class="alert alert-' + (kind || 'info') + ' py-2">' + esc(t) + '</div>' : '';
    if (t && kind === 'success') setTimeout(function () { $('#msg').innerHTML = ''; }, 3000);
  }
  function csrf() { return document.querySelector('meta[name=csrf-token]').content; }

  /* ---------- preview ---------- */
  var pt = null;
  function preview() {
    clearTimeout(pt);
    pt = setTimeout(function () {
      try {
        var r = E.render(def, E.sampleData(def), seed, { letterhead: BD.letterhead });
        var p = $('#preview');
        p.className = 'dd-doc' + (def.page.font === 'en' ? ' font-en' : '');
        p.setAttribute('style', r.vars);
        p.innerHTML = r.html;
        $('#page-style').textContent = '';
        $('#def-style').textContent = (def.css || '');
        var pane = $('.builder-preview');
        var d = document.createElement('div');
        d.style.cssText = 'position:absolute;visibility:hidden;width:' + (def.page.size === 'legal' ? '8.5in' : '8.27in');
        document.body.appendChild(d); var w = d.offsetWidth; d.remove();
        $('#preview-zoom').style.zoom = Math.max(0.3, Math.min(1, (pane.clientWidth - 24) / w));
      } catch (e) { $('#preview').innerHTML = '<div class="alert alert-danger">Preview error: ' + esc(e.message) + '</div>'; }
    }, 150);
  }
  $('#respin').addEventListener('click', function () { seed = Math.floor(Math.random() * 1e9); preview(); });

  /* ---------- tabs ---------- */
  $$('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#tabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
      tab = b.getAttribute('data-t'); draw();
    });
  });

  function inp(label, key, obj, opts) {
    opts = opts || {};
    return '<div class="' + (opts.col || 'col-md-6') + '"><label class="form-label small fw-bold">' + label + '</label>' +
      '<input class="form-control form-control-sm' + (opts.mono ? ' mono' : '') + '" data-o="' + opts.o + '" data-k="' + key + '" value="' + esc(obj[key] == null ? '' : obj[key]) + '"' + (opts.ro ? ' readonly' : '') + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '></div>';
  }

  /* ---------- draw ---------- */
  function draw() {
    var h = '';
    if (tab === 'info') {
      h = '<div class="row g-2">' +
        '<div class="col-md-4"><label class="form-label small fw-bold">ID (URL name)</label><input class="form-control form-control-sm mono" id="docid" value="' + esc(docId) + '" ' + (isNew ? '' : 'readonly') + ' placeholder="e.g. rent_receipt"></div>' +
        inp('Title (বাংলা)', 'title', def, { o: 'def', col: 'col-md-8' }) +
        inp('Title (English)', 'title_en', def, { o: 'def' }) +
        inp('Category', 'category', def, { o: 'def', ph: 'e.g. হলফনামা / Affidavit' }) +
        inp('Icon (Font Awesome)', 'icon', def, { o: 'def', ph: 'fa-file-alt' }) +
        inp('Description', 'description', def, { o: 'def', col: 'col-12' }) +
        '<div class="col-md-4"><label class="form-label small fw-bold">Paper size</label><select class="form-select form-select-sm" data-o="page" data-k="size">' +
        ['a4', 'legal', 'letter'].map(function (s) { return '<option ' + (def.page.size === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
        inp('Top margin', 'marginTop', def.page, { o: 'page', col: 'col-md-4', ph: '4.5in for stamp paper' }) +
        inp('Side/bottom margin', 'margin', def.page, { o: 'page', col: 'col-md-4', ph: '1in' }) +
        inp('Font size (px)', 'fontSize', def.page, { o: 'page', col: 'col-md-4' }) +
        inp('Line height', 'lineHeight', def.page, { o: 'page', col: 'col-md-4' }) +
        '<div class="col-md-4"><label class="form-label small fw-bold">Font</label><select class="form-select form-select-sm" data-o="page" data-k="font"><option value="bn" ' + (def.page.font !== 'en' ? 'selected' : '') + '>Bangla serif</option><option value="en" ' + (def.page.font === 'en' ? 'selected' : '') + '>English / sans</option></select></div>' +
        '<div class="col-md-4"><label class="form-label small fw-bold">Digits</label><select class="form-select form-select-sm" data-o="def" data-k="digits">' +
        [['bn', 'Bangla (০১২৩) for amounts/dates'], ['keep', 'As typed / English']].map(function (o) { return '<option value="' + o[0] + '" ' + ((def.digits || 'keep') === o[0] ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="col-12"><div class="form-check form-switch"><input type="checkbox" class="form-check-input" data-o="def" data-k="letterhead" data-bool="1" ' + (def.letterhead ? 'checked' : '') + '><label class="form-check-label small fw-bold">Print my business letterhead at the top of page 1 <span class="text-muted fw-normal">(set it up in Admin → Settings)</span></label></div></div>' +
        '<div class="col-12"><label class="form-label small fw-bold">Custom CSS <span class="text-muted fw-normal">(prefix selectors with <code>.doc-page</code>)</span></label><textarea class="form-control form-control-sm mono" rows="5" data-o="def" data-k="css">' + esc(def.css || '') + '</textarea></div>' +
        '</div>';
    } else if (tab === 'groups') {
      h = def.groups.map(function (g, i) {
        return '<div class="row g-2 mb-2 align-items-end border-bottom pb-2">' +
          inp('ID', 'id', g, { o: 'groups', col: 'col-md-2' }).replace('data-o="groups"', 'data-o="groups" data-i="' + i + '"') +
          inp('Title', 'title', g, { o: 'groups', col: 'col-md-4' }).replace('data-o="groups"', 'data-o="groups" data-i="' + i + '"') +
          inp('Icon', 'icon', g, { o: 'groups', col: 'col-md-2' }).replace('data-o="groups"', 'data-o="groups" data-i="' + i + '"') +
          inp('Show only if', 'show_if', g, { o: 'groups', col: 'col-md-3', ph: 'field==value' }).replace('data-o="groups"', 'data-o="groups" data-i="' + i + '"') +
          '<div class="col-md-1 text-end"><button class="btn btn-sm btn-outline-danger" data-act="del-group" data-i="' + i + '"><i class="fas fa-trash"></i></button></div></div>';
      }).join('') + '<button class="btn btn-sm btn-outline-primary" data-act="add-group"><i class="fas fa-plus"></i> Add section</button>';
    } else if (tab === 'fields') {
      h = '<div class="small text-muted mb-2">Use a field in the template as <code>{{name}}</code>. <b>amount</b> fields also give <code>{{name_words}}</code>; <b>date</b> fields also give <code>{{name_long}}</code>.</div>' +
        def.fields.map(fieldCard).join('') +
        '<button class="btn btn-sm btn-outline-primary" data-act="add-field"><i class="fas fa-plus"></i> Add field</button>';
    } else if (tab === 'pages') {
      h = '<div class="mb-2 d-flex flex-wrap gap-1 align-items-center"><span class="small fw-bold me-1">Insert:</span>' + chips() + '</div>' +
        def.pages.map(function (p, i) {
          return '<div class="border rounded p-2 mb-3 bg-light"><div class="d-flex gap-2 align-items-center mb-2"><strong class="small">Page ' + (i + 1) + '</strong>' +
            '<input class="form-control form-control-sm mono" style="max-width:240px" data-o="pages" data-i="' + i + '" data-k="if" value="' + esc(p['if'] || '') + '" placeholder="show only if… e.g. layout==3">' +
            '<div class="ms-auto btn-group btn-group-sm"><button class="btn btn-outline-secondary" data-act="up-page" data-i="' + i + '">↑</button><button class="btn btn-outline-secondary" data-act="down-page" data-i="' + i + '">↓</button><button class="btn btn-outline-danger" data-act="del-page" data-i="' + i + '"><i class="fas fa-trash"></i></button></div></div>' +
            '<textarea class="form-control mono ta-page" rows="14" data-o="pages" data-i="' + i + '" data-k="html">' + esc(p.html || '') + '</textarea></div>';
        }).join('') + '<button class="btn btn-sm btn-outline-primary" data-act="add-page"><i class="fas fa-plus"></i> Add page</button>' +
        '<div id="spin-report" class="mt-3"></div>' +
        '<details class="mt-3 small"><summary class="fw-bold">Template syntax</summary><pre class="mono bg-light p-2 mt-2">{{field}}                    value (escaped)\n{{#if field}}…{{else}}…{{/if}}   conditions: field | !field | field==x | field!=x | a&amp;&amp;b\n{{#each rows}}{{col}} {{@n}}{{/each}}   repeat for a "rows" field\n{option A|option B}           wording variation (spintax) - options MUST mean exactly the same\nBootstrap classes work: text-center, mt-4, table, text-justify …</pre></details>';
    } else if (tab === 'json') {
      h = '<textarea class="form-control mono" rows="28" id="json">' + esc(JSON.stringify(def, null, 2)) + '</textarea><div class="mt-2"><button class="btn btn-sm btn-primary" data-act="apply-json">Apply JSON</button></div>';
    }
    panes.innerHTML = h;
    var ta = $$('.ta-page', panes); if (ta.length) lastTA = ta[0];
    spinReport();
    preview();
  }

  function chips() {
    var c = [];
    def.fields.forEach(function (f) {
      if (f.type === 'party') {
        ['_list', '_names', '_i', '_my', '_you', '_sig'].forEach(function (x) { c.push('{{' + f.name + x + '}}'); });
        c.push('{{#if ' + f.name + '_multi}}…{{else}}…{{/if}}');
        return;
      }
      if (f.type === 'rows') { c.push('{{#each ' + f.name + '}}' + (f.columns || []).map(function (x) { return '{{' + x.name + '}}'; }).join(' ') + '{{/each}}'); return; }
      c.push('{{' + f.name + '}}');
      if (f.type === 'amount') c.push('{{' + f.name + '_words}}');
      if (f.type === 'date') c.push('{{' + f.name + '_long}}');
    });
    c.push('{{#if field}}…{{/if}}', '{A|B}');
    return c.map(function (t) { return '<span class="badge text-bg-light border chip" data-ins="' + esc(t) + '">' + esc(t.length > 38 ? t.slice(0, 36) + '…' : t) + '</span>'; }).join('');
  }

  function fieldCard(f, i) {
    var gopts = '<option value="">—</option>' + def.groups.map(function (g) { return '<option value="' + esc(g.id) + '" ' + (f.group === g.id ? 'selected' : '') + '>' + esc(g.title || g.id) + '</option>'; }).join('');
    var topts = TYPES.map(function (t) { return '<option ' + (f.type === t ? 'selected' : '') + '>' + t + '</option>'; }).join('');
    var opts = (f.options || []).map(function (o) { return typeof o === 'object' ? o.value + '|' + (o.label || '') : o; }).join('\n');
    var cols = (f.columns || []).map(function (c) { return [c.name, c.label || '', c.col || '', c.type || '', c.bn ? 'bn' : ''].join('|').replace(/\|+$/, ''); }).join('\n');
    var d = 'data-o="fields" data-i="' + i + '"';
    return '<div class="card fld-card mb-2"><div class="card-body p-2"><div class="row g-2">' +
      '<div class="col-md-3"><label class="small fw-bold">Name</label><input class="form-control form-control-sm mono" ' + d + ' data-k="name" value="' + esc(f.name) + '"></div>' +
      '<div class="col-md-5"><label class="small fw-bold">Label</label><input class="form-control form-control-sm" ' + d + ' data-k="label" value="' + esc(f.label || '') + '"></div>' +
      '<div class="col-md-2"><label class="small fw-bold">Type</label><select class="form-select form-select-sm" ' + d + ' data-k="type" data-struct="1">' + topts + '</select></div>' +
      '<div class="col-md-2 text-end pt-3"><div class="btn-group btn-group-sm"><button class="btn btn-outline-secondary" data-act="up-field" data-i="' + i + '">↑</button><button class="btn btn-outline-secondary" data-act="down-field" data-i="' + i + '">↓</button><button class="btn btn-outline-danger" data-act="del-field" data-i="' + i + '"><i class="fas fa-trash"></i></button></div></div>' +
      '<div class="col-md-3"><label class="small">Section</label><select class="form-select form-select-sm" ' + d + ' data-k="group">' + gopts + '</select></div>' +
      '<div class="col-md-2"><label class="small">Width (1–12)</label><input type="number" min="1" max="12" class="form-control form-control-sm" ' + d + ' data-k="col" data-num="1" value="' + esc(f.col || 6) + '"></div>' +
      '<div class="col-md-3"><label class="small">Default</label><input class="form-control form-control-sm" ' + d + ' data-k="default" value="' + esc(f['default'] == null ? '' : f['default']) + '"></div>' +
      '<div class="col-md-4"><label class="small">Show only if</label><input class="form-control form-control-sm mono" ' + d + ' data-k="show_if" value="' + esc(f.show_if || '') + '" placeholder="field==value"></div>' +
      '<div class="col-md-4"><label class="small">Placeholder</label><input class="form-control form-control-sm" ' + d + ' data-k="placeholder" value="' + esc(f.placeholder || '') + '"></div>' +
      '<div class="col-md-4"><label class="small">Help text</label><input class="form-control form-control-sm" ' + d + ' data-k="help" value="' + esc(f.help || '') + '"></div>' +
      '<div class="col-md-4 pt-4"><div class="form-check d-inline-block me-3"><input type="checkbox" class="form-check-input" ' + d + ' data-k="required" data-bool="1" ' + (f.required ? 'checked' : '') + '><label class="form-check-label small">Required</label></div>' +
      (f.type === 'text' || f.type === 'textarea' ? '<div class="form-check d-inline-block"><input type="checkbox" class="form-check-input" ' + d + ' data-k="bn" data-bool="1" ' + (f.bn ? 'checked' : '') + '><label class="form-check-label small">Bangla digits</label></div>' : '') + '</div>' +
      (f.type === 'amount' ? '<div class="col-md-4"><label class="small">Auto-calc (a-b, a+b, a*b)</label><input class="form-control form-control-sm mono" ' + d + ' data-k="calc" value="' + esc(f.calc || '') + '" placeholder="total-paid"></div>' : '') +
      (f.type === 'select' ? '<div class="col-12"><label class="small">Options – one per line, <code>value|Label</code> or just text</label><textarea class="form-control form-control-sm mono" rows="3" ' + d + ' data-k="options" data-list="options">' + esc(opts) + '</textarea></div>' : '') +
      ((f.type === 'rows' || f.type === 'party') ? '<div class="col-md-8"><label class="small">Columns – one per line: <code>name|Label|width 1-12|date|bn</code> (last three optional)</label><textarea class="form-control form-control-sm mono" rows="3" ' + d + ' data-k="columns" data-list="columns">' + esc(cols) + '</textarea></div><div class="col-md-4"><label class="small">Initial rows</label><input type="number" min="0" class="form-control form-control-sm" ' + d + ' data-k="minRows" data-num="1" value="' + esc(f.minRows == null ? 1 : f.minRows) + '"></div>' : '') +
      (f.type === 'party' ? '<div class="col-md-8"><label class="small">How each person is written (template; blank = automatic). Use the column names, e.g. <code>&lt;strong&gt;{{name}}&lt;/strong&gt;, পিতা- {{father}}</code></label><textarea class="form-control form-control-sm mono" rows="2" ' + d + ' data-k="format">' + esc(f.format || '') + '</textarea></div>' +
        '<div class="col-md-4"><label class="small">Signature label</label><input class="form-control form-control-sm" ' + d + ' data-k="signLabel" value="' + esc(f.signLabel || '') + '" placeholder="১ম পক্ষের (দাতার) স্বাক্ষর"></div>' +
        '<div class="col-md-12 small text-muted">Gives <code>{{' + esc(f.name) + '_list}}</code> (all persons), <code>_names</code> ("A, B ও C"), <code>_i</code>/<code>_my</code>/<code>_you</code> (আমি/আমরা …), <code>_sig</code> (signature lines) and <code>{{#if ' + esc(f.name) + '_multi}}</code>.</div>' : '') +
      '</div></div></div>';
  }

  /* spintax must only swap synonyms - flag options whose meaning may differ */
  function spinReport() {
    var box = $('#spin-report');
    if (!box) return;
    var issues = [];
    def.pages.forEach(function (p, i) {
      E.spinAudit(p.html || '').forEach(function (x) { x.page = i + 1; issues.push(x); });
    });
    if (!issues.length) {
      box.innerHTML = '<div class="alert alert-success py-2 small mb-0"><i class="fas fa-check-circle"></i> Spin check: every {a|b} group looks like a pure synonym set.</div>';
      return;
    }
    box.innerHTML = '<div class="alert alert-warning py-2 small mb-0"><strong><i class="fas fa-exclamation-triangle"></i> Spin check - options must have the SAME meaning:</strong><ul class="mb-0 mt-1">' +
      issues.map(function (x) {
        return '<li class="' + (x.level === 'error' ? 'text-danger' : '') + '">Page ' + x.page + ': ' + esc(x.msg) + ' - <code>{' + esc(x.group) + '}</code></li>';
      }).join('') + '</ul></div>';
  }
  panes.addEventListener('input', function (e) {
    if (e.target.classList.contains('ta-page')) {
      clearTimeout(spinReport._t);
      spinReport._t = setTimeout(spinReport, 400);
    }
  });

  /* ---------- editing ---------- */
  function targetFor(el) {
    var o = el.getAttribute('data-o'), i = el.getAttribute('data-i');
    if (o === 'def') return def;
    if (o === 'page') return def.page;
    if (o === 'groups') return def.groups[+i];
    if (o === 'fields') return def.fields[+i];
    if (o === 'pages') return def.pages[+i];
    return null;
  }
  function onEdit(ev) {
    var el = ev.target, k = el.getAttribute('data-k'), t = targetFor(el);
    if (!k || !t) return;
    var v;
    if (el.hasAttribute('data-bool')) v = el.checked;
    else if (el.hasAttribute('data-list')) {
      var lines = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (k === 'options') v = lines.map(function (l) { var p = l.split('|'); return p.length > 1 ? { value: p[0].trim(), label: p.slice(1).join('|').trim() } : l; });
      else v = lines.map(function (l) {
        var p = l.split('|').map(function (x) { return x.trim(); });
        var c = { name: p[0], label: p[1] || p[0] };
        if (p[2] && !isNaN(+p[2])) c.col = +p[2];
        if (p[3] === 'date') c.type = 'date';
        if (p[3] === 'bn' || p[4] === 'bn') c.bn = true;
        return c;
      });
    } else if (el.hasAttribute('data-num')) v = el.value === '' ? '' : Number(el.value);
    else v = el.value;
    if (k === 'fontSize' || k === 'lineHeight') v = v === '' ? '' : Number(v);
    if (v === '' || v === false) { delete t[k]; } else { t[k] = v; }
    if (el.hasAttribute('data-struct') && ev.type === 'change') {
      if (t.type === 'select' && !t.options) t.options = ['Option 1', 'Option 2'];
      if (t.type === 'rows' && !t.columns) t.columns = [{ name: 'col1', label: 'Column 1' }];
      if (t.type === 'party' && !t.columns) { t.columns = [{ name: 'name', label: 'নাম', col: 6 }, { name: 'father', label: 'পিতা/স্বামীর নাম', col: 6 }, { name: 'mother', label: 'মাতার নাম', col: 6 }, { name: 'nid', label: 'এনআইডি', col: 6, bn: true }, { name: 'address', label: 'ঠিকানা', col: 12 }]; t.minRows = 1; }
      draw(); return;
    }
    preview();
  }
  panes.addEventListener('input', onEdit);
  panes.addEventListener('change', onEdit);
  panes.addEventListener('focusin', function (e) { if (e.target.classList.contains('ta-page')) lastTA = e.target; });

  function move(arr, i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  panes.addEventListener('click', function (ev) {
    var chip = ev.target.closest('[data-ins]');
    if (chip && lastTA) {
      var s = lastTA.selectionStart, e = lastTA.selectionEnd, txt = chip.getAttribute('data-ins');
      lastTA.value = lastTA.value.slice(0, s) + txt + lastTA.value.slice(e);
      lastTA.selectionStart = lastTA.selectionEnd = s + txt.length; lastTA.focus();
      lastTA.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act'), i = +b.getAttribute('data-i');
    if (a === 'add-group') def.groups.push({ id: 'g' + (def.groups.length + 1), title: 'New section', icon: 'fa-folder' });
    else if (a === 'del-group') { var gid = def.groups[i].id; def.groups.splice(i, 1); def.fields.forEach(function (f) { if (f.group === gid) delete f.group; }); }
    else if (a === 'add-field') {
      var n = 1; while (def.fields.some(function (f) { return f.name === 'field' + n; })) n++;
      def.fields.push({ name: 'field' + n, label: 'New field', type: 'text', col: 6, group: (def.groups[0] || {}).id });
    }
    else if (a === 'del-field') def.fields.splice(i, 1);
    else if (a === 'up-field') move(def.fields, i, -1);
    else if (a === 'down-field') move(def.fields, i, 1);
    else if (a === 'add-page') def.pages.push({ html: '<p></p>' });
    else if (a === 'del-page') { if (def.pages.length > 1) def.pages.splice(i, 1); }
    else if (a === 'up-page') move(def.pages, i, -1);
    else if (a === 'down-page') move(def.pages, i, 1);
    else if (a === 'apply-json') {
      try { var nd = JSON.parse($('#json').value); delete nd.id; def = nd; def.groups = def.groups || []; def.fields = def.fields || []; def.pages = def.pages || []; def.page = def.page || {}; msg('JSON applied.', 'success'); }
      catch (e) { msg('Invalid JSON: ' + e.message, 'danger'); return; }
    }
    draw();
  });

  /* ---------- save ---------- */
  $('#btn-save').addEventListener('click', function () {
    var idEl = $('#docid');
    var id = idEl ? idEl.value.trim() : docId;
    if (isNew) {
      if (!/^[a-z0-9][a-z0-9_-]{1,59}$/.test(id)) { tab = 'info'; $$('#tabs button').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-t') === 'info'); }); draw(); msg('Set an ID first: 2–60 chars, a–z 0–9 _ - (e.g. rent_receipt).', 'danger'); return; }
    } else { id = docId; }
    def.version = (def.version || 1) + (isNew ? 0 : 1);
    fetch(BD.api + '?a=def_save', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() }, body: JSON.stringify({ id: id, def: def })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) {
        msg('Saved ✔', 'success');
        if (isNew) { location.href = 'builder.php?id=' + encodeURIComponent(id); }
      } else msg(j.error || 'Could not save', 'danger');
    }).catch(function () { msg('Network error', 'danger'); });
  });

  draw();
})();
