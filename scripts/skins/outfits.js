'use strict';
const { shade, mix, lighten, darken } = require('./brushes');

function bodyBase(s, cloth){ for(const p of ['body','rarm','larm','rleg','lleg']) s.cuboid(p, cloth, 5); }
function hands(s, c){ for(const a of ['rarm','larm']){ s.fill(a,'front',0,8,4,4,c); s.fill(a,'left',0,8,4,4,shade(c,0.9)); s.fill(a,'right',0,8,4,4,shade(c,0.8)); } }
function boots(s, c){ for(const l of ['rleg','lleg']){ s.fill(l,'front',0,9,4,3,c); s.fill(l,'left',0,9,4,3,shade(c,0.9)); s.fill(l,'right',0,9,4,3,shade(c,0.8)); s.px(l,'front',0,11,darken(c,0.3)); s.px(l,'front',3,11,darken(c,0.3)); } }

// ---------- CYBER ----------
// p: {base, neon, neon2, panel, motif}
function cyber(s, p){
  const base=p.base, neon=p.neon, neon2=p.neon2||p.neon, panel=p.panel||shade(base,1.3);
  bodyBase(s, base);
  // chest tech panel
  s.fill('body','front',1,1,6,8, panel);
  s.fill('body','front',1,1,6,1, lighten(panel,0.2));
  // glowing core / motif
  const m=p.motif||'core';
  if(m==='core'){ s.px('body','front',3,4,neon); s.px('body','front',4,4,lighten(neon,0.5)); s.px('body','front',3,5,neon); s.px('body','front',4,5,neon); }
  else if(m==='zip'){ for(let y=1;y<9;y++) s.px('body','front',4,y,neon); }
  else if(m==='circuit'){ for(let x=1;x<7;x++) s.px('body','front',x,3,neon); for(let y=3;y<8;y++) s.px('body','front',6,y,neon); s.px('body','front',1,3,neon2); s.px('body','front',3,6,neon2); }
  else if(m==='bars'){ s.fill('body','front',1,3,6,1,neon); s.fill('body','front',1,6,6,1,neon2); }
  else if(m==='hex'){ s.px('body','front',3,3,neon); s.px('body','front',4,3,neon); s.px('body','front',2,4,neon); s.px('body','front',5,4,neon); s.px('body','front',3,5,neon); s.px('body','front',4,5,neon); }
  // belt
  s.fill('body','front',0,10,8,1, darken(base,0.3)); s.px('body','front',3,10,neon); s.px('body','front',4,10,neon);
  // arms: sleeves + neon stripe + gloves
  for(const a of ['rarm','larm']){ s.faceFill(a,'top',panel,4); s.fill(a,'front',0,0,4,2,panel); s.fill(a,'front',0,7,4,1,neon); }
  hands(s, darken(base,0.15));
  // legs: panel thighs + neon knee + boots
  for(const l of ['rleg','lleg']){ s.fill(l,'front',0,0,4,4,panel); s.fill(l,'front',0,7,4,1,neon); }
  boots(s, darken(base,0.25));
  // shoulder neon edge
  for(let y=2;y<9;y++){ s.px('body','front',0,y,mix(base,neon,0.4)); s.px('body','front',7,y,mix(base,neon,0.4)); }
}

// ---------- FANTASY ----------
// p: {cloth, trim(gold), gem, rune, motif}
function fantasy(s, p){
  const cloth=p.cloth, trim=p.trim||[225,180,90,255], gem=p.gem||[220,80,120,255], rune=p.rune||trim;
  bodyBase(s, cloth);
  // tunic/armor chest
  s.fill('body','front',1,1,6,9, cloth);
  // gold collar + hem trim
  for(let x=1;x<7;x++){ s.px('body','front',x,1,trim); }
  s.fill('body','front',0,9,8,1, trim);
  // center motif
  const m=p.motif||'gem';
  if(m==='gem'){ s.px('body','front',4,4,gem); s.px('body','front',3,5,gem); s.px('body','front',5,5,gem); s.px('body','front',4,6,gem); s.px('body','front',4,5,lighten(gem,0.5)); }
  else if(m==='cross'){ s.fill('body','front',3,3,2,5,trim); s.fill('body','front',2,4,4,2,trim); }
  else if(m==='rune'){ for(let y=2;y<9;y++) s.px('body','front',4,y, y%2?rune:gem); s.px('body','front',3,4,rune); s.px('body','front',5,6,rune); }
  else if(m==='sash'){ for(let i=0;i<8;i++){ s.px('body','front',i,i+1,gem);} }
  else if(m==='emblem'){ s.px('body','front',4,3,trim); s.px('body','front',3,4,trim); s.px('body','front',5,4,trim); s.px('body','front',2,5,trim); s.px('body','front',6,5,trim); s.px('body','front',4,5,gem); }
  // belt
  s.fill('body','front',0,10,8,1, darken(cloth,0.35)); s.px('body','front',3,10,trim); s.px('body','front',4,10,trim);
  // pauldrons + gold cuffs
  for(const a of ['rarm','larm']){ s.faceFill(a,'top',darken(cloth,0.1),4); s.fill(a,'front',0,0,4,2,trim); s.fill(a,'front',0,7,4,1,trim); }
  hands(s, darken(cloth,0.2));
  // robe legs + gold knee + boots
  for(const l of ['rleg','lleg']){ s.fill(l,'front',0,7,4,1,trim); }
  boots(s, darken(cloth,0.3));
}

// ---------- PASTEL ----------
// p: {outfit, accent, deco, motif}
function pastel(s, p){
  const o=p.outfit, ac=p.accent, deco=p.deco||lighten(ac,0.2);
  bodyBase(s, o);
  // soft top
  s.fill('body','front',0,0,8,1, lighten(o,0.25));
  // collar
  s.fill('body','front',2,0,4,1, ac);
  const m=p.motif||'heart';
  if(m==='heart'){ s.px('body','front',2,4,ac); s.px('body','front',3,3,ac); s.px('body','front',4,4,ac); s.px('body','front',5,3,ac); s.px('body','front',6,4,ac); s.fill('body','front',2,5,5,1,ac); s.fill('body','front',3,6,3,1,ac); s.px('body','front',4,7,ac); }
  else if(m==='star'){ s.px('body','front',4,3,ac); s.fill('body','front',2,4,5,1,ac); s.px('body','front',3,5,ac); s.px('body','front',5,5,ac); s.px('body','front',2,6,ac); s.px('body','front',6,6,ac); s.px('body','front',4,4,lighten(ac,0.5)); }
  else if(m==='bow'){ s.px('body','front',3,3,ac); s.px('body','front',5,3,ac); s.fill('body','front',3,4,3,1,ac); s.px('body','front',4,3,deco); }
  else if(m==='stripes'){ s.fill('body','front',0,3,8,1,ac); s.fill('body','front',0,6,8,1,deco); }
  else if(m==='dots'){ for(let y=2;y<9;y+=2) for(let x=1;x<7;x+=2) s.px('body','front',x,y,ac); }
  else if(m==='flower'){ s.px('body','front',4,3,deco); s.px('body','front',3,4,ac); s.px('body','front',5,4,ac); s.px('body','front',4,5,ac); s.px('body','front',4,4,[255,240,120,255]); }
  // sleeves cuffs
  for(const a of ['rarm','larm']){ s.fill(a,'front',0,7,4,1,ac); s.faceFill(a,'top',lighten(o,0.15),3); }
  hands(s, [245,225,220,255]);
  // skirt/pants + shoes
  for(const l of ['rleg','lleg']){ s.fill(l,'front',0,0,4,3,lighten(o,0.1)); }
  boots(s, ac);
}

// ---------- ACCESSORIES ----------
function accessory(s, kind, c){
  if(!kind||kind==='none') return;
  if(kind==='visor'){ /* handled in face */ }
  else if(kind==='headphones'){ for(let y=2;y<5;y++){ s.px('head','right',1,y,c); s.px('head','left',6,y,c);} for(let x=0;x<8;x++) s.px('hat','top',x,0,shade(c,0.8)); }
  else if(kind==='crown'){ for(let x=0;x<8;x++) s.px('hat','front',x,0,c); s.px('hat','front',1,0,lighten(c,0.5)); s.px('hat','front',4,0,lighten(c,0.5)); s.px('hat','front',6,0,lighten(c,0.5)); }
  else if(kind==='halo'){ for(let x=1;x<7;x++) s.px('hat','top',x,0,lighten(c,0.4)); }
  else if(kind==='horns'){ s.px('hat','top',1,0,shade(c,0.7)); s.px('hat','top',6,0,shade(c,0.7)); s.px('head','top',0,0,shade(c,0.6)); s.px('head','top',7,0,shade(c,0.6)); }
  else if(kind==='catears'){ s.px('hat','top',1,0,c); s.px('hat','top',2,0,lighten(c,0.4)); s.px('hat','top',5,0,lighten(c,0.4)); s.px('hat','top',6,0,c); }
  else if(kind==='earrings'){ s.px('head','right',0,5,c); s.px('head','left',7,5,c); }
  else if(kind==='gem'){ s.px('head','front',3,1,c); s.px('head','front',4,1,lighten(c,0.5)); }
  else if(kind==='hood'){ s.faceFill('hat','top',c,4); for(let y=0;y<6;y++){ s.px('head','right',0,y,c); s.px('head','left',7,y,c);} for(let x=0;x<8;x++) s.px('hat','front',x,0,c); }
}

module.exports = { cyber, fantasy, pastel, accessory, bodyBase, hands, boots };
