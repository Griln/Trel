'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const R=[255,200,205,255],O=[255,225,195,255],Y=[255,248,200,255],G=[205,245,210,255],B=[200,228,250,255],P=[225,205,248,255]; // пастельная радуга
const SHINE=[255,255,255,255];
const FACE=[120,110,130,255];
// ГОЛОВА — желеобразный купол радужный
s.cuboid('head',B,2);
// радужные горизонтальные слои
s.fill('head','front',0,0,8,2,R);s.fill('head','front',0,2,8,1,O);s.fill('head','front',0,3,8,2,Y);s.fill('head','front',0,5,8,1,G);s.fill('head','front',0,6,8,1,B);s.fill('head','front',0,7,8,1,P);
s.faceFill('head','top',L(R,0.3),2);s.faceFill('head','back',P,2);
// блик желе
s.px('head','front',5,1,SHINE);s.px('head','front',6,1,SHINE);s.px('head','front',1,2,L(Y,0.4));
// ЛИЦО — простые милые глаза
s.fill('head','front',1,3,2,2,FACE);s.fill('head','front',5,3,2,2,FACE);
s.px('head','front',1,3,SHINE);s.px('head','front',5,3,SHINE);
s.px('head','front',3,6,FACE);s.px('head','front',4,6,FACE); // ротик-точка
// ТОРС — радужное желе
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,B,2);
// радуга по торсу
s.fill('body','front',0,0,8,2,R);s.fill('body','front',0,2,8,2,O);s.fill('body','front',0,4,8,2,Y);s.fill('body','front',0,6,8,2,G);s.fill('body','front',0,8,8,2,B);s.fill('body','front',0,10,8,2,P);
// пузырьки внутри слайма
for(const [x,y] of [[2,3],[5,5],[3,7],[6,9],[1,6]]){s.px('body','front',x,y,SHINE);}
s.px('body','front',1,1,SHINE);s.px('body','front',2,1,L(R,0.4)); // главный блик
s.faceFill('body','back',P,2);s.faceFill('body','top',L(R,0.3),2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,2,R);s.fill(a,'front',0,2,4,2,O);s.fill(a,'front',0,4,4,2,Y);s.fill(a,'front',0,6,4,2,G);s.fill(a,'front',0,8,4,2,B);s.fill(a,'front',0,10,4,2,P);
  s.px(a,'front',1,2,SHINE);s.px(a,'front',2,7,SHINE);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,2,Y);s.fill(l,'front',0,2,4,2,G);s.fill(l,'front',0,4,4,2,B);s.fill(l,'front',0,6,4,3,P);s.fill(l,'front',0,9,4,3,R);
  s.px(l,'front',1,3,SHINE);s.px(l,'front',2,8,SHINE);
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-neutral-rainbow-slime',nameRu:'Радужный Слайм',nameEn:'Rainbow Slime',role:'весёлое желейное создание',style:'pastel',gender:'neutral',model:'classic'}};
