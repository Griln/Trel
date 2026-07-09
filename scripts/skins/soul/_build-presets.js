
const fs=require('fs'),path=require('path');
const dir=__dirname;
const files=fs.readdirSync(dir).filter(f=>/^\d{3}-.*\.js$/.test(f)).sort();
const metas=[];
for(const f of files){
  const txt=fs.readFileSync(path.join(dir,f),'utf8');
  const m=txt.match(/module\.exports\s*=\s*\{\s*meta\s*:\s*(\{[\s\S]*?\})\s*\}\s*;/);
  if(!m){console.error('no meta',f);continue;}
  try{ const meta=eval('('+m[1]+')'); metas.push(meta);}catch(e){console.error('parse',f,e.message);}
}
const order={cyber:0,fantasy:1,pastel:2}, gord={male:0,female:1,neutral:2};
metas.sort((a,b)=> (order[a.style]-order[b.style]) || (gord[a.gender]-gord[b.gender]) || a.id.localeCompare(b.id));
let ts='// AUTO-GENERATED from scripts/skins/soul/*.js — '+metas.length+' hand-crafted skins\n';
ts+='export interface SkinPreset { id: string; nameRu: string; nameEn: string; role: string; style: string; gender: string; model: string; file: string; }\n\n';
ts+='export const SKIN_PRESETS: SkinPreset[] = [\n';
for(const m of metas){ ts+='  { id: '+JSON.stringify(m.id)+', nameRu: '+JSON.stringify(m.nameRu)+', nameEn: '+JSON.stringify(m.nameEn)+', role: '+JSON.stringify(m.role)+', style: '+JSON.stringify(m.style)+', gender: '+JSON.stringify(m.gender)+', model: '+JSON.stringify(m.model||'classic')+', file: '+JSON.stringify('skins/'+m.id+'.png')+' },\n'; }
ts+='];\n';
const out=path.join(dir,'..','..','..','src','data','skin-presets.ts');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,ts);
console.log('OK wrote '+metas.length+' presets');
const byTheme={};for(const m of metas){const k=m.style+'/'+m.gender;byTheme[k]=(byTheme[k]||0)+1;}
console.log(JSON.stringify(byTheme,null,0));
