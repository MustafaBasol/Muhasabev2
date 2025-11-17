const fs=require('fs');
const s=fs.readFileSync('/workspaces/Muhasabev2/src/locales/fr/common.json','utf8');
let depth=0;let inStr=false;let esc=false;let firstClose=-1;for(let i=0;i<s.length;i++){
  const c=s[i];
  if(inStr){
    if(esc){esc=false;}
    else if(c==='\\'){esc=true;}
    else if(c==='"'){inStr=false;}
  }else{
    if(c==='"') inStr=true;
    else if(c==='{') depth++;
    else if(c==='}'){
      depth--; if(depth===0){ firstClose=i; break; }
    }
  }
}
console.log('first root close at index', firstClose);
const start = Math.max(0, firstClose-120);
const end = Math.min(s.length, firstClose+120);
console.log('context:\n'+s.slice(start,end));
