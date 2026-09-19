// Находит классы, используемые в TSX рендерера, но не определённые в styles.css
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync('src/renderer/styles.css', 'utf8')
  + '\n' + fs.readFileSync('src/renderer/styles-pages.css', 'utf8');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p);
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) files.push(p);
  }
})('src/renderer');

const used = new Map(); // class -> file
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const mm of src.matchAll(/className=["'{`+]([^>}]*?)["'`}]/g)) {
    for (const tok of mm[1].matchAll(/[a-zA-Z][a-zA-Z0-9_-]*/g)) {
      const c = tok[0];
      if (!used.has(c)) used.set(c, f);
    }
  }
}

const skip = new Set(['className', 'class', 'true', 'false', 'undefined', 'null', 'e', 'target']);
const missing = [];
for (const [c, f] of used) {
  if (skip.has(c)) continue;
  const re = new RegExp('\\.' + c.replace(/-/g, '\\-') + '(?![a-zA-Z0-9_-])');
  if (!re.test(css)) missing.push(`${c}  (${f})`);
}
console.log(missing.sort().join('\n'));
console.log('---total:', missing.length);
