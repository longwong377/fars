const fs=require('fs');const p='tools/dev/fetch_models.mjs';const L=fs.readFileSync(p,'utf8').split('\n');
const esc=b=>b.replace(/\./g,'\.').replace(/\//g,'\/');
for(let i=36;i<42;i++){ const k=L[i].indexOf('only: /^'); const e=L[i].lastIndexOf('$/ }'); if(k<0||e<0){console.log('miss',i);continue;} const body=L[i].slice(k+8,e); L[i]=L[i].slice(0,k+8)+esc(body)+L[i].slice(e); }
fs.writeFileSync(p,L.join('\n'));
