'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[120,92,70,255],SKD=shade(SKIN,0.78);         // тёмная кожа
const MASK=[210,205,195,255],MASKD=[150,145,135,255];     // костяная маска
const ROBE=[44,52,48,255],ROBEH=[64,76,70,255];
const TEAL=[40,230,200,255],TEALD=shade([40,230,200,255],0.6);
const ORN=[255,180,70,255]; // янтарь
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// дреды-провода
s.faceFill('head','top',ROBE,4);s.faceFill('head','back',ROBE,4);
for(let x=0;x<8;x++)s.px('head','top',x,0,ROBEH);
for(let y=0;y<6;y++){s.px('head','right',1,y,ROBE);s.px('head','left',6,y,ROBE);s.px('head','right',2,y,D(ROBE,0.2));s.px('head','left',5,y,D(ROBE,0.2));}
for(const x of [1,3,5,7])s.px('head','front',x,0,ROBE);
// провод-дред с бусиной
s.px('head','right',0,3,TEAL);s.px('head','left',7,4,TEAL);
// костяная маска-полумаска (верх лица)
s.fill('head','front',0,2,8,3,MASK);
s.fill('head','front',0,2,8,1,L(MASK,0.2));
// прорези глаз с тил-свечением
s.px('head','front',1,3,[20,20,20,255]);s.px('head','front',2,3,TEAL);
s.px('head','front',5,3,TEAL);s.px('head','front',6,3,[20,20,20,255]);
s.px('head','front',2,4,MASKD);s.px('head','front',5,4,MASKD);
// узор на маске
s.px('head','front',3,2,TEALD);s.px('head','front',4,2,TEALD);s.px('head','front',0,3,ORN);s.px('head','front',7,3,ORN);
// рот + ритуальные полосы
s.px('head','front',3,6,SKD);s.px('head','front',4,6,SKD);
s.px('head','front',2,5,ORN);s.px('head','front',5,5,ORN);
// ТОРС — роба шамана с тех-тотемами
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,ROBE,5);
s.fill('body','front',0,0,8,12,ROBE);
// меховой/тканевый ворот
s.fill('body','front',1,0,6,1,ROBEH);s.px('body','front',2,0,MASK);s.px('body','front',5,0,MASK);
// ожерелье из тех-костей
for(let x=1;x<7;x++)s.px('body','front',x,1, x%2?MASK:ORN);
// центральный тотем-череп со светом
s.fill('body','front',3,3,2,3,MASK);s.px('body','front',3,4,TEAL);s.px('body','front',4,4,TEAL);s.px('body','front',3,3,MASKD);
// рунные полосы тил
s.px('body','front',1,4,TEAL);s.px('body','front',6,4,TEAL);s.px('body','front',2,7,TEALD);s.px('body','front',5,7,TEALD);
// янтарные обереги
s.px('body','front',1,6,ORN);s.px('body','front',6,6,ORN);s.px('body','front',3,8,ORN);s.px('body','front',4,8,ORN);
s.fill('body','front',0,10,8,1,D(ROBE,0.3));s.px('body','front',3,10,TEAL);s.px('body','front',4,10,ORN);
s.faceFill('body','top',ROBEH,4);s.faceFill('body','back',D(ROBE,0.2),5);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',ROBEH,4);
  s.fill(a,'front',0,0,4,3,ROBEH); // наплечник-мех
  s.px(a,'front',1,1,ORN);s.px(a,'front',2,1,ORN);
  s.fill(a,'front',0,5,4,1,TEALD); // тил-полоса
  s.px(a,'front',1,7,ORN);
  s.fill(a,'front',0,8,4,4,SKIN); // открытые предплечья (краска)
  s.px(a,'front',0,9,TEAL);s.px(a,'front',3,9,TEAL);s.px(a,'front',1,10,ORN);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,7,ROBE);s.px(l,'front',1,3,TEALD);s.px(l,'front',2,5,ORN);
  s.fill(l,'front',0,8,4,4,D([90,70,50,255],0.1)); // мокасины
  s.fill(l,'front',0,8,4,1,ORN);s.px(l,'front',1,10,TEAL);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-neutral-cyber-shaman',nameRu:'Кибер-Шаман',nameEn:'Cyber Shaman',role:'мост между мирами',style:'cyber',gender:'neutral',model:'classic'}};
