'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[238,200,170,255],SKD=shade(SKIN,0.84);       // warm caramel
const HAIR=[190,140,90,255],HAIRH=[222,176,120,255],HAIRD=[150,104,62,255]; // caramel
const COAT=[255,215,200,255],COATH=[255,236,228,255],COATD=[235,178,160,255]; // peach doublet
const TEAL=[150,220,215,255]; // mint trim
const GOLD=[248,222,150,255];
const RED=[245,165,160,255];
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// caramel waves
s.faceFill('head','top',HAIR,3);s.faceFill('head','back',HAIR,3);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let y=1;y<6;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
for(let y=0;y<8;y++){s.px('body','back',0,y,HAIR);s.px('body','back',7,y,HAIR);s.px('body','back',1,y,HAIRD);s.px('body','back',6,y,HAIRD);}
// pastel pirate tricorn
s.fill('head','front',0,0,8,1,COATD);for(let x=0;x<8;x++)if(x%2)s.px('head','front',x,0,COATH);
s.px('hat','top',0,0,COATD);s.px('hat','top',7,0,COATD);s.faceFill('hat','top',COAT,2);
// skull on the hat (cute)
s.px('head','front',3,0,COATH);s.px('head','front',4,0,COATH);
for(let x=1;x<7;x++)s.px('head','front',x,1, x%2?HAIRH:HAIRD); // fringe from under the hat
// FACE — playful + headband
const Wt=[250,250,252,255];
s.px('head','front',1,3,RED);s.px('head','front',2,3,RED);s.px('head','front',2,2,RED); // headband over the left eye
s.px('head','front',5,3,Wt);s.px('head','front',6,3,Wt);s.px('head','front',5,4,Wt);s.px('head','front',6,4,Wt);
s.px('head','front',5,4,[90,140,135,255]);s.px('head','front',6,4,[140,200,195,255]);
s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[225,140,140,255]);s.px('head','front',4,6,[225,140,140,255]);
const bl=mix(SKIN,[255,170,150,255],0.4);s.px('head','front',6,5,bl);
// gold earring
s.px('head','left',6,5,GOLD);
// TORSO — peach doublet with mint trim
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,COAT,3);
s.fill('body','front',0,0,8,12,COAT);
// mint lapels
for(let y=1;y<9;y++){s.px('body','front',1,y,TEAL);s.px('body','front',6,y,TEAL);}
// white jabot blouse
s.fill('body','front',3,0,2,4,COATH);s.px('body','front',3,1,COATD);s.px('body','front',4,2,COATD);
// gold buttons
for(let y=2;y<9;y+=2){s.px('body','front',2,y,GOLD);s.px('body','front',5,y,GOLD);}
// red sash belt
s.fill('body','front',0,8,8,2,RED);s.fill('body','front',0,8,8,1,L(RED,0.2));
s.px('body','front',3,9,GOLD);s.px('body','front',4,9,GOLD); // buckle
// mint pleated hem
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?TEAL:COATD);
s.faceFill('body','back',COATD,3);s.faceFill('body','top',COATH,2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,COAT);s.fill(a,'front',0,0,4,1,COATH);
  s.px(a,'front',0,3,GOLD);s.px(a,'front',3,3,GOLD); // sleeve buttons
  s.fill(a,'front',0,8,4,2,TEAL);s.fill(a,'front',0,8,4,1,COATH); // mint cuff
  s.px(a,'front',0,8,GOLD);s.px(a,'front',3,8,GOLD);
  s.fill(a,'front',0,10,4,2,SKIN); // hand
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,5,D(COAT,0.05)); // breeches
  s.px(l,'front',1,3,TEAL);
  s.fill(l,'front',0,5,4,7,D([120,86,56,255],0.05));s.fill(l,'front',0,5,4,1,GOLD); // tall boots
  s.px(l,'front',0,11,HAIRD);s.px(l,'front',3,11,HAIRD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-female-caramel-pirate',nameRu:'Карамельная Пиратка',nameEn:'Caramel Pirate',role:'капитан сладких морей',style:'pastel',gender:'female',model:'slim'}};
