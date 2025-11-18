const fs = require('fs');
const path = require('path');

function flatten(obj, prefix = '') {
  let out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

const base = read(path.join(__dirname, '..', 'src', 'locales', 'en', 'common.json'));
const fr = read(path.join(__dirname, '..', 'src', 'locales', 'fr', 'common.json'));
const de = read(path.join(__dirname, '..', 'src', 'locales', 'de', 'common.json'));

const enF = flatten(base);
const frF = flatten(fr);
const deF = flatten(de);

function identicalKeys(target, name){
  const keys = [];
  for (const k of Object.keys(enF)) {
    if (typeof target[k] !== 'undefined' && target[k] === enF[k]) keys.push(k);
  }
  console.log(`\nIdentical to EN in ${name}: ${keys.length}`);
  for (const k of keys) console.log(k);
}

identicalKeys(frF, 'fr');
identicalKeys(deF, 'de');
