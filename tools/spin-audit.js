#!/usr/bin/env node
/**
 * Spintax audit – every {a|b} group must offer options with the SAME meaning.
 *   node tools/spin-audit.js            # report (exit 1 on errors)
 *   node tools/spin-audit.js --list     # also print every group for human review
 *   node tools/spin-audit.js path.json  # audit specific files
 */
const fs = require('fs'), path = require('path');
const E = require('../assets/js/engine.js');
const args = process.argv.slice(2);
const list = args.includes('--list');
let files = args.filter(a => a.endsWith('.json'));
if (!files.length) {
  const dir = path.join(__dirname, '..', 'definitions');
  files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f));
}
let errors = 0, warns = 0, groups = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const texts = (d.pages || []).map(p => p.html).concat((d.computed || []).flatMap(c => (c.items || []).map(i => i.text)));
  const seen = new Set();
  for (const t of texts) {
    const s = t.replace(/\{\{[^{}]*\}\}/g, '§');
    (s.match(/\{[^{}]*\|[^{}]*\}/g) || []).forEach(g => { if (!seen.has(g)) { seen.add(g); groups++; if (list) console.log('  ' + path.basename(f) + ': ' + g.slice(1, -1).split('|').join('  ||  ')); } });
    for (const i of E.spinAudit(t)) {
      const k = i.level === 'error' ? 'ERROR' : 'warn ';
      if (i.level === 'error') errors++; else warns++;
      console.log(`${k} ${path.basename(f)}: ${i.msg}\n        {${i.group}}`);
    }
  }
}
console.log(`\n${groups} spin groups checked in ${files.length} file(s): ${errors} error(s), ${warns} warning(s)`);
process.exit(errors ? 1 : 0);
