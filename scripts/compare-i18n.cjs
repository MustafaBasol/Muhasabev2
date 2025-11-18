const fs = require('fs');
const path = require('path');

function flatKeys(obj, prefix = '') {
  let out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatKeys(v, key));
    } else {
      out[key] = true;
    }
  }
  return out;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const base = readJson(path.join(__dirname, '..', 'src', 'locales', 'en', 'common.json'));
const fr = readJson(path.join(__dirname, '..', 'src', 'locales', 'fr', 'common.json'));
const de = readJson(path.join(__dirname, '..', 'src', 'locales', 'de', 'common.json'));
const tr = readJson(path.join(__dirname, '..', 'src', 'locales', 'tr', 'common.json'));

const baseFlat = flatKeys(base);
const frFlat = flatKeys(fr);
const deFlat = flatKeys(de);
const trFlat = flatKeys(tr);

function diff(missingFrom, name) {
  const missing = Object.keys(baseFlat).filter(k => !missingFrom[k]);
  console.log(`\nMissing in ${name}: ${missing.length}`);
  for (const k of missing) console.log(k);
}

diff(frFlat, 'fr');
diff(deFlat, 'de');
