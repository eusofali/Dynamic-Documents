/*!
 * Dynamic Documents – template engine (runs in the browser and in Node for tests)
 *
 * Template syntax (inside page HTML):
 *   {{field}}                 escaped value (amount fields also give {{field_words}},
 *                             date fields also give {{field_long}})
 *   {{#if cond}}..{{else}}..{{/if}}   cond: field | !field | field==x | field!=x | a&&b
 *   {{#each rows}}..{{@n}}..{{/each}} loop over a "rows" field
 *   {option A|option B}       spintax – one option is picked using the draft's seed
 */
(function (root) {
  'use strict';

  var BN = '০১২৩৪৫৬৭৮৯';
  var MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SIZES = { legal: ['8.5in', '14in', 'legal'], a4: ['8.27in', '11.69in', 'A4'], letter: ['8.5in', '11in', 'letter'] };

  var W = ('শূন্য এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগার বার তের চৌদ্দ পনের ষোল সতের আঠার উনিশ ' +
    'বিশ একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আটাশ ঊনত্রিশ ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ ঊনচল্লিশ ' +
    'চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ সাতচল্লিশ আটচল্লিশ ঊনপঞ্চাশ পঞ্চাশ ' +
    'একান্ন বায়ান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন ঊনষাট ষাট ' +
    'একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি ঊনসত্তর সত্তর ' +
    'একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর ঊনআশি আশি ' +
    'একাশি বিরাশি তিরাশি চুরাশি পঁচাশি ছিয়াশি সাতাশি আটাশি ঊননব্বই নব্বই ' +
    'একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই').split(' ');

  function toBn(s) { return String(s).replace(/[0-9]/g, function (d) { return BN.charAt(+d); }); }
  function toEn(s) { return String(s).replace(/[০-৯]/g, function (d) { return BN.indexOf(d); }); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function nonBlank(x) { return x !== undefined && x !== null && String(x).trim() !== ''; }
  function isEmpty(v) {
    if (Array.isArray(v)) {
      return !v.some(function (r) {
        return r && typeof r === 'object' ? Object.keys(r).some(function (k) { return nonBlank(r[k]); }) : nonBlank(r);
      });
    }
    return v === undefined || v === null || String(v).trim() === '' || v === '0';
  }

  /* ---------- numbers ---------- */
  function words(n) {
    n = Math.floor(n);
    if (!isFinite(n) || n < 0) return '';
    if (n === 0) return W[0];
    var out = [];
    var crore = Math.floor(n / 1e7); n %= 1e7;
    var lakh = Math.floor(n / 1e5); n %= 1e5;
    var th = Math.floor(n / 1e3); n %= 1e3;
    var hun = Math.floor(n / 100), rest = n % 100;
    if (crore) out.push(words(crore) + ' কোটি');
    if (lakh) out.push(W[lakh] + ' লক্ষ');
    if (th) out.push(W[th] + ' হাজার');
    if (hun) out.push(W[hun] + ' শত');
    if (rest) out.push(W[rest]);
    return out.join(' ');
  }
  function groupIN(n) {
    var s = String(Math.floor(n));
    if (s.length <= 3) return s;
    return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
  }
  function parseNum(v) {
    var s = toEn(v === undefined || v === null ? '' : v).replace(/[^\d.]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }
  function fmtAmount(v, bn) {
    var n = parseNum(v);
    if (isNaN(n)) return '';
    var s = groupIN(n);
    if (n % 1 !== 0) s += '.' + String(n.toFixed(2)).split('.')[1];
    return bn ? toBn(s) : s;
  }
  function fmtDate(iso, bn, long) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    var d = m[3], mo = +m[2], y = m[1], s;
    if (long === 'dmy') {
      s = d + ' ' + (bn ? MONTHS_BN : MONTHS_EN)[mo - 1] + ' ' + y;
    } else if (long) {
      s = (+d) + ' ' + (bn ? MONTHS_BN : MONTHS_EN)[mo - 1] + ', ' + y;
    } else {
      s = d + '/' + m[2] + '/' + y;
    }
    return bn ? toBn(s) : s;
  }

  /* ---------- conditions ---------- */
  function cond(expr, getRaw) {
    return String(expr).split('&&').every(function (part) {
      part = part.trim();
      var m = /^(.+?)\s*(==|!=)\s*(.+)$/.exec(part);
      if (m) {
        var l = String(getRaw(m[1].trim()) == null ? '' : getRaw(m[1].trim())).trim();
        var r = m[3].trim().replace(/^['"]|['"]$/g, '');
        return m[2] === '==' ? l === r : l !== r;
      }
      var neg = false;
      if (part.charAt(0) === '!') { neg = true; part = part.slice(1).trim(); }
      var t = !isEmpty(getRaw(part));
      return neg ? !t : t;
    });
  }

  /* ---------- spintax ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function spin(text, seed) {
    var r = rng(seed), saved = [];
    // protect {{placeholders}} so they can live inside spin groups
    text = text.replace(/\{\{[^{}]*\}\}/g, function (m) { saved.push(m); return '\u0001' + (saved.length - 1) + '\u0002'; });
    var prev, guard = 0;
    do {
      prev = text;
      text = text.replace(/\{([^{}]*\|[^{}]*)\}/g, function (m, inner) {
        var p = inner.split('|');
        return p[Math.floor(r() * p.length)];
      });
    } while (text !== prev && guard++ < 25);
    return text.replace(/\u0001(\d+)\u0002/g, function (m, i) { return saved[+i]; });
  }

  /* ---------- spintax audit: options of one group must be pure synonyms ---------- */
  var SPIN_TERMS = ['মৃত্যু', 'ঋণ', 'আল্লাহ', 'ঈশ্বর', 'কিস্তি', 'বাজেয়াপ্ত', 'নগদ', 'ব্যাংক', 'মামলা', 'চেক', 'বিবাহ', 'তালাক', 'death', 'loan', 'bank', 'not '];
  function spinAudit(text) {
    var out = [], saved = [];
    text = String(text).replace(/\{\{[^{}]*\}\}/g, function (m) { saved.push(m); return '§' + (saved.length - 1) + '§'; });
    var re = /\{([^{}]*\|[^{}]*)\}/g, m;
    while ((m = re.exec(text))) {
      var opts = m[1].split('|').map(function (x) { return x.trim(); });
      var label = opts.join(' | ');
      function add(level, msg) { out.push({ level: level, msg: msg, group: label }); }
      if (opts.some(function (x) { return x === ''; })) add('error', 'empty option');
      if (new Set(opts).size !== opts.length) add('error', 'duplicate options');
      var digs = opts.map(function (x) { return (x.match(/[0-9০-৯]+/g) || []).join(','); });
      if (new Set(digs).size > 1) add('error', 'options contain different numbers');
      var NEG = { 'নাই': 1, 'নহে': 1, 'নহেন': 1, 'নয়': 1, 'না': 1, 'নি': 1, 'no': 1, 'not': 1 };
      var negs = opts.map(function (x) { return x.toLowerCase().split(/[\s,।.()\/;:-]+/).some(function (w) { return NEG[w] === 1; }); });
      if (new Set(negs).size > 1) add('error', 'one option is negative, another is not (meaning differs)');
      SPIN_TERMS.forEach(function (t) {
        var has = opts.map(function (x) { return x.toLowerCase().indexOf(t) > -1; });
        if (has.some(Boolean) && !has.every(Boolean)) add('error', 'key term "' + t.trim() + '" appears in only some options (meaning differs)');
      });
      var lens = opts.map(function (x) { return x.length; });
      if (Math.min.apply(null, lens) >= 5 && Math.max.apply(null, lens) > 3.2 * Math.min.apply(null, lens)) add('warn', 'options differ a lot in length – check they say the same thing');
      if (opts.length < 2) add('error', 'only one option');
    }
    return out;
  }

  /* ---------- template parser ---------- */
  var parseCache = {};
  function parse(src) {
    if (parseCache[src]) return parseCache[src];
    var rootNode = { t: 'root', c: [] }, stack = [rootNode], last = 0, m;
    var re = /\{\{([^{}]*)\}\}/g;
    function kids(n) { return n.inElse ? n.e : n.c; }
    function top() { return stack[stack.length - 1]; }
    function text(t) { if (t) kids(top()).push({ t: 'text', v: t }); }
    while ((m = re.exec(src))) {
      text(src.slice(last, m.index));
      last = re.lastIndex;
      var tag = m[1].trim(), n;
      if (tag.indexOf('#if ') === 0) {
        n = { t: 'if', cond: tag.slice(4).trim(), c: [], e: [], inElse: false };
        kids(top()).push(n); stack.push(n);
      } else if (tag.indexOf('#each ') === 0) {
        n = { t: 'each', name: tag.slice(6).trim(), c: [], e: [], inElse: false };
        kids(top()).push(n); stack.push(n);
      } else if (tag === 'else') {
        if (top().t === 'if') top().inElse = true;
      } else if (tag === '/if' || tag === '/each') {
        if (stack.length > 1) stack.pop();
      } else if (tag) {
        kids(top()).push({ t: 'var', name: tag });
      }
    }
    text(src.slice(last));
    parseCache[src] = rootNode.c;
    return rootNode.c;
  }

  function renderNodes(nodes, ctx) {
    var o = '';
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.t === 'text') o += n.v;
      else if (n.t === 'var') o += ctx.out(n.name);
      else if (n.t === 'if') o += renderNodes(cond(n.cond, ctx.raw) ? n.c : n.e, ctx);
      else if (n.t === 'each') {
        var rows = ctx.rows(n.name);
        for (var j = 0; j < rows.length; j++) o += renderNodes(n.c, ctx.child(rows[j], j + 1));
      }
    }
    return o;
  }

  /* ---------- values ---------- */
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function defaults(def) {
    var v = {};
    (def.fields || []).forEach(function (f) {
      if (f.type === 'rows' || f.type === 'party') {
        var rows = [], n = f.minRows == null ? 1 : f.minRows;
        for (var i = 0; i < n; i++) rows.push({});
        v[f.name] = rows;
      } else if (f.type === 'checkbox') {
        v[f.name] = f['default'] ? '1' : '';
      } else if (f.type === 'date' && f['default'] === 'today') {
        v[f.name] = todayIso();
      } else {
        v[f.name] = f['default'] == null ? '' : String(f['default']);
      }
    });
    return computeCalc(def, v);
  }

  function computeCalc(def, vals) {
    (def.fields || []).forEach(function (f) {
      if (!f.calc) return;
      var m = /^\s*([A-Za-z_]\w*)\s*([-+*])\s*([A-Za-z_]\w*)\s*(?:\+\s*(\d+))?\s*$/.exec(f.calc);
      if (!m) return;
      var iso = /^\d{4}-\d{2}-\d{2}$/, r;
      var e1 = String(vals[m[1]] == null ? '' : vals[m[1]]).trim(), e3 = String(vals[m[3]] == null ? '' : vals[m[3]]).trim();
      if ((iso.test(e1) || iso.test(e3) || m[4]) && (e1 === '' || e3 === '')) { vals[f.name] = ''; return; }
      if (iso.test(vals[m[1]] || '') && iso.test(vals[m[3]] || '') && m[2] === '-') {
        // date - date = number of days (use "+1" to count both end days)
        r = Math.round((Date.parse(vals[m[1]]) - Date.parse(vals[m[3]])) / 86400000) + (m[4] ? +m[4] : 0);
        vals[f.name] = r < 0 ? '' : String(r);
        return;
      }
      var a = parseNum(vals[m[1]]), b = parseNum(vals[m[3]]);
      if (isNaN(a)) a = 0;
      if (isNaN(b)) b = 0;
      r = (m[2] === '-' ? a - b : m[2] === '+' ? a + b : a * b) + (m[4] ? +m[4] : 0);
      vals[f.name] = (isNaN(a) && isNaN(b)) || r < 0 ? '' : String(r);
    });
    return vals;
  }

  function visibleMap(def, vals) {
    var gvis = {}, vis = {};
    (def.groups || []).forEach(function (g) {
      gvis[g.id] = !g.show_if || cond(g.show_if, function (n) { return vis[n] === false ? '' : vals[n]; });
    });
    (def.fields || []).forEach(function (f) {
      var ok = !f.group || gvis[f.group] !== false;
      if (ok && f.show_if) ok = cond(f.show_if, function (n) { return vis[n] === false ? '' : vals[n]; });
      vis[f.name] = ok;
    });
    return { fields: vis, groups: gvis };
  }

  function makeCtx(def, vals, vis) {
    var bn = def.digits === 'bn' || (!!def.digits_if && cond(def.digits_if, function (n) { return vals[n]; }));
    var raw = {}, out = {}, rowsMap = {}, ph = {}, parties = [];
    (def.fields || []).forEach(function (f) {
      if (!vis[f.name]) return;
      var v = vals[f.name];
      if (f.type === 'rows' || f.type === 'party') {
        var list = [];
        (v || []).forEach(function (row) {
          var any = false, r = { raw: {}, out: {} };
          (f.columns || []).forEach(function (c) {
            var cv = row && row[c.name] != null ? String(row[c.name]) : '';
            if (cv.trim() !== '') any = true;
            r.raw[c.name] = cv;
            if (c.type === 'date') {
              r.out[c.name] = fmtDate(cv, bn, false);
              r.out[c.name + '_long'] = fmtDate(cv, bn, true);
              r.out[c.name + '_dmy'] = fmtDate(cv, bn, 'dmy');
            } else {
              r.out[c.name] = esc(c.bn ? toBn(cv) : cv);
            }
          });
          if (any) list.push(r);
        });
        rowsMap[f.name] = list;
        raw[f.name] = list;
        if (f.type === 'party') parties.push(f);
        return;
      }
      v = v == null ? '' : String(v);
      raw[f.name] = v;
      if (f.type === 'amount') {
        out[f.name] = fmtAmount(v, bn);
        var n = parseNum(v);
        out[f.name + '_words'] = isNaN(n) ? '' : words(n);
        raw[f.name + '_words'] = out[f.name + '_words'];
      } else if (f.type === 'date') {
        out[f.name] = fmtDate(v, bn, false);
        out[f.name + '_long'] = fmtDate(v, bn, true);
        raw[f.name + '_long'] = out[f.name + '_long'];
        out[f.name + '_dmy'] = fmtDate(v, bn, 'dmy');
      } else if (f.type === 'textarea') {
        out[f.name] = esc(v).replace(/\r?\n/g, '<br>');
      } else if (f.type === 'photo') {
        out[f.name] = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/=]+$/.test(v) ? '<img class="doc-photo" alt="" src="' + v + '">' : '';
        if (!out[f.name]) raw[f.name] = '';
      } else if (f.type === 'checkbox') {
        out[f.name] = v ? '✔' : '';
      } else {
        out[f.name] = esc(f.bn ? toBn(v) : v);
      }
      if (f.required) ph[f.name] = true;
    });

    function make(rawM, outM, rowsM, phM, parent, n) {
      var c = {
        raw: function (name) {
          if (name === '@n') return n;
          if (rawM && Object.prototype.hasOwnProperty.call(rawM, name)) return rawM[name];
          return parent ? parent.raw(name) : undefined;
        },
        out: function (name) {
          if (name === '@n') return bn ? toBn(n) : String(n);
          if (outM && Object.prototype.hasOwnProperty.call(outM, name)) {
            var s = outM[name];
            if (s === '' && phM && phM[name]) return '<span class="ph">__________</span>';
            return s;
          }
          return parent ? parent.out(name) : '';
        },
        rows: function (name) { return rowsM && rowsM[name] ? rowsM[name] : (parent ? parent.rows(name) : []); },
        child: function (row, i) { return make(row.raw, row.out, null, null, c, i); }
      };
      return c;
    }
    var ctx = make(raw, out, rowsMap, ph, null, 0);

    // multi-person parties: pronouns, joined names, formatted list and signature lines
    parties.forEach(function (f) {
      var list = rowsMap[f.name] || [], multi = list.length > 1, N = f.name, cols = f.columns || [];
      var nameCol = f.nameColumn || (cols[0] && cols[0].name);
      var pr = f.pronouns || {};
      out[N + '_i'] = multi ? (pr.iMulti || 'আমরা') : (pr.i || 'আমি');
      out[N + '_my'] = multi ? (pr.myMulti || 'আমাদের') : (pr.my || 'আমার');
      out[N + '_you'] = multi ? (pr.youMulti || 'আপনারা') : (pr.you || 'আপনি');
      raw[N + '_multi'] = multi ? '1' : '';
      raw[N + '_count'] = list.length;
      out[N + '_count'] = bn ? toBn(list.length) : String(list.length);
      var names = list.map(function (r) { return r.out[nameCol] || ''; }).filter(Boolean);
      var and = f.and || ' ও ';
      out[N + '_names'] = names.length > 1 ? names.slice(0, -1).join(', ') + and + names[names.length - 1] : (names[0] || '');
      var fmt = f.format;
      if (!fmt) {
        fmt = cols.map(function (c, i) {
          if (i === 0) return '<strong>{{' + c.name + '}}</strong>';
          return '{{#if ' + c.name + '}}, ' + String(c.label || c.name).split(' / ')[0] + '- {{' + c.name + '}}{{/if}}';
        }).join('');
      }
      var nodes = parse(fmt), items = '', sigs = '';
      list.forEach(function (r, i) {
        var cc = ctx.child(r, i + 1);
        items += '<p class="party">' + (multi ? '(' + (bn ? toBn(i + 1) : (i + 1)) + ') ' : '') + renderNodes(nodes, cc) + '</p>';
        sigs += '<div class="sig-line">__________________<br><strong>' + esc(f.signLabel || '') + '</strong>' + (multi ? '<br>' + (r.out[nameCol] || '') : '') + '</div>';
      });
      if (!list.length) {
        items = f.required ? '<p class="party"><span class="ph">__________</span></p>' : '';
        sigs = '<div class="sig-line">__________________<br><strong>' + esc(f.signLabel || '') + '</strong></div>';
      }
      out[N + '_list'] = items;
      out[N + '_sig'] = sigs;
      if (!out[N + '_names'] && f.required) out[N + '_names'] = '<span class="ph">__________</span>';
    });

    (def.computed || []).forEach(function (cp) {
      var parts = [];
      (cp.items || []).forEach(function (it) {
        if (!it['if'] || cond(it['if'], ctx.raw)) parts.push(renderNodes(parse(it.text || ''), ctx));
      });
      out[cp.name] = parts.join(cp.sep == null ? ', ' : cp.sep);
      raw[cp.name] = parts.length ? out[cp.name] : '';
    });
    return ctx;
  }

  /* ---------- page / render ---------- */
  function pageCss(def) {
    var p = def.page || {}, s = SIZES[p.size || 'a4'] || SIZES.a4;
    var m = p.margin == null ? '1in' : p.margin;
    var mt = p.marginTop == null ? m : p.marginTop;
    return '@page{size:' + s[2] + ';margin:' + mt + ' ' + m + ' ' + m + ' ' + m + '}';
  }
  function pageVars(def) {
    var p = def.page || {}, s = SIZES[p.size || 'a4'] || SIZES.a4;
    var m = p.margin == null ? '1in' : p.margin;
    var mt = p.marginTop == null ? m : p.marginTop;
    return '--pw:' + s[0] + ';--ph:' + s[1] + ';--pt:' + mt + ';--pm:' + m + ';--fs:' + (p.fontSize || 16) + 'px;--lh:' + (p.lineHeight || 1.5);
  }

  /* business letterhead: lh = {name, tagline, address, phone, email, logo, color, layout} */
  function letterheadHtml(lh) {
    if (!lh || !String(lh.name || '').trim()) return '';
    var color = /^#[0-9a-fA-F]{6}$/.test(lh.color || '') ? lh.color : '#1f3a5f';
    var logo = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/=]+$/.test(lh.logo || '') ? '<div class="lh-logo"><img alt="" src="' + lh.logo + '"></div>' : '';
    var contact = [lh.address, lh.phone ? 'মোবাইল/Phone: ' + lh.phone : '', lh.email ? 'Email: ' + lh.email : ''].filter(function (x) { return x && String(x).trim(); }).map(esc).join(' &nbsp;|&nbsp; ');
    return '<div class="lh lh-' + (lh.layout === 'left' ? 'left' : 'center') + '" style="--lh-color:' + color + '">' + logo +
      '<div class="lh-text"><div class="lh-name">' + esc(lh.name) + '</div>' +
      (lh.tagline ? '<div class="lh-tag">' + esc(lh.tagline) + '</div>' : '') +
      (contact ? '<div class="lh-contact">' + contact + '</div>' : '') + '</div></div>';
  }

  function render(def, vals, seed, opts) {
    opts = opts || {};
    vals = computeCalc(def, JSON.parse(JSON.stringify(vals || {})));
    var vm = visibleMap(def, vals);
    var ctx = makeCtx(def, vals, vm.fields);
    var html = '', missing = [], first = true;
    var lhHtml = def.letterhead && opts.letterhead ? letterheadHtml(opts.letterhead) : '';
    (def.pages || []).forEach(function (pg, idx) {
      if (pg['if'] && !cond(pg['if'], ctx.raw)) return;
      var src = spin(pg.html || '', (seed || 1) + idx * 7919);
      html += '<section class="doc-page ' + (pg['class'] || '') + '">' + (first ? lhHtml : '') + renderNodes(parse(src), ctx) + '</section>';
      first = false;
    });
    (def.fields || []).forEach(function (f) {
      if (!f.required || !vm.fields[f.name]) return;
      var v = vals[f.name];
      if (f.type === 'checkbox') return;
      if (isEmpty(v) && v !== '0') missing.push(f.name);
    });
    return { html: html, css: pageCss(def) + (def.css || ''), vars: pageVars(def), missing: missing, visible: vm };
  }

  function sampleData(def) {
    var v = defaults(def), now = new Date();
    (def.fields || []).forEach(function (f) {
      if (f.calc) return;
      var cur = v[f.name];
      if (f.type === 'rows' || f.type === 'party') {
        var rows = [];
        for (var i = 1; i <= (f.type === 'party' ? 2 : 2); i++) {
          var r = {};
          (f.columns || []).forEach(function (c) { r[c.name] = '‹' + (c.label || c.name) + ' ' + i + '›'; });
          rows.push(r);
        }
        v[f.name] = rows;
      } else if (f.type === 'checkbox') {
        v[f.name] = '1';
      } else if (isEmpty(cur) || cur === '') {
        if (f.type === 'amount') v[f.name] = '150000';
        else if (f.type === 'number') v[f.name] = '10';
        else if (f.type === 'date') v[f.name] = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
        else if (f.type === 'select') {
          var o = (f.options || [])[0];
          v[f.name] = o == null ? '' : (typeof o === 'object' ? o.value : o);
        } else v[f.name] = '‹' + (f.label || f.name) + '›';
      }
    });
    return computeCalc(def, v);
  }

  var api = {
    render: render, defaults: defaults, computeCalc: computeCalc, visibleMap: visibleMap, sampleData: sampleData,
    spinAudit: spinAudit, words: words, toBn: toBn, toEn: toEn, parseNum: parseNum, fmtAmount: fmtAmount, fmtDate: fmtDate, cond: cond, spin: spin, esc: esc,
    pageCss: pageCss, pageVars: pageVars, isEmpty: isEmpty, letterheadHtml: letterheadHtml, todayIso: todayIso
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DDEngine = api;
})(typeof window !== 'undefined' ? window : this);
