const fs = require('fs');
const path = require('path');

function fillMissing(target, base) {
  if (typeof base !== 'object' || base === null) return target;
  const out = Array.isArray(base) ? [] : { ...target };
  for (const [k, v] of Object.entries(base)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = fillMissing((target && target[k]) || {}, v);
    } else {
      if (!target || typeof target[k] === 'undefined') out[k] = v;
      else out[k] = target[k];
    }
  }
  return out;
}

function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function write(p,obj){fs.writeFileSync(p, JSON.stringify(obj, null, 2)+'\n');}

const basePath = path.join(__dirname, '..', 'src', 'locales', 'en', 'common.json');
const frPath = path.join(__dirname, '..', 'src', 'locales', 'fr', 'common.json');
const dePath = path.join(__dirname, '..', 'src', 'locales', 'de', 'common.json');

const base = read(basePath);
const fr = read(frPath);
const de = read(dePath);

// Backups
fs.copyFileSync(frPath, frPath + '.bak');
fs.copyFileSync(dePath, dePath + '.bak');

const frFilled = fillMissing(fr, base);
const deFilled = fillMissing(de, base);

write(frPath, frFilled);
write(dePath, deFilled);

console.log('Filled missing keys in FR and DE from EN. Backups created with .bak.');
