
const fs=require('fs'),path=require('path');
const dir=__dirname;
const files=fs.readdirSync(dir).filter(f=>/^\d{3}-.*\.js$/.test(f)).sort();
const metas=[];
for(const f of files){const t=fs.readFileSync(path.join(dir,f),'utf8');const m=t.match(/module\.exports\s*=\s*\{\s*meta\s*:\s*(\{[\s\S]*?\})\s*\}\s*;/);if(m){try{metas.push(eval('('+m[1]+')'))}catch(e){}}}
const order={cyber:0,fantasy:1,pastel:2},gord={male:0,female:1,neutral:2};
metas.sort((a,b)=>(order[a.style]-order[b.style])||(gord[a.gender]-gord[b.gender])||a.id.localeCompare(b.id));
console.log(metas.map(m=>m.id+'.png').join(' '));
