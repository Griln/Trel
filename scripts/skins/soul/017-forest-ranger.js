'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[206,168,138,255],SKD=shade(SKIN,0.78);
const HOOD=[46,68,42,255],HOODH=[66,92,58,255];          // forest green
const LEATH=[92,64,40,255],LEATHH=[120,88,56,255];        // leather
const HAIR=[70,50,32,255];
const GOLD=[210,180,90,255];
s.cuboid('head',SKIN,5);s.fill('head','front',0,7,8,1,SKD);
// ranger hood
s.faceFill('head','top',HOOD,5);s.faceFill('head','back',HOOD,5);
for(let x=0;x<8;x++)s.px('head','top',x,0,HOODH);
for(let y=0;y<7;y++){for(let x=0;x<8;x++){if(x<2||x>5)s.px('head','right',x,y,HOOD);}}
for(let y=0;y<7;y++){s.px('head','right',0,y,HOOD);s.px('head','right',1,y,HOOD);s.px('head','left',7,y,HOOD);s.px('head','left',6,y,HOOD);}
for(let x=0;x<8;x++)s.px('head','front',x,0,HOOD);
s.px('head','front',0,1,HOOD);s.px('head','front',7,1,HOOD);
// hood point
for(let x=1;x<7;x++)s.px('head','front',x,1,D(HOOD,0.2));
// fringe
s.px('head','front',2,2,HAIR);s.px('head','front',3,2,HAIR);s.px('head','front',4,2,HAIR);s.px('head','front',5,2,HAIR);
const Wt=[238,242,248,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[70,140,60,255]);s.px('head','front',2,4,[30,30,30,255]);s.px('head','front',5,4,[30,30,30,255]);s.px('head','front',6,4,[70,140,60,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,shade(SKIN,0.55));s.px('head','front',4,6,shade(SKIN,0.55));
// war paint under the eye
s.px('head','front',1,5,HOODH);s.px('head','front',6,5,HOODH);
for(const x of [3,4])s.px('head','front',x,7,D(HAIR,0.1)); // stubble
// TORSO — leather chest piece + cloak + quiver
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,HOOD,5);
s.fill('body','front',1,1,6,8,LEATH);
s.fill('body','front',1,1,6,1,LEATHH);
// chest piece lacing
for(let y=2;y<8;y+=2){s.px('body','front',3,y,GOLD);s.px('body','front',4,y,GOLD);}
s.px('body','front',3,3,D(LEATH,0.2));s.px('body','front',4,5,D(LEATH,0.2));
// green cloak at the edges
for(let y=0;y<10;y++){s.px('body','front',0,y,HOOD);s.px('body','front',7,y,HOOD);}
// quiver strap across the chest
s.px('body','front',1,2,LEATHH);s.px('body','front',2,3,LEATHH);s.px('body','front',3,4,LEATHH);s.px('body','front',4,5,LEATHH);s.px('body','front',5,6,LEATHH);
// quiver with arrows (shoulder)
s.px('body','front',6,1,GOLD);s.px('body','front',6,2,GOLD);
// belt
s.fill('body','front',1,9,6,1,D(LEATH,0.25));s.px('body','front',3,9,GOLD);s.px('body','front',4,9,GOLD);
s.faceFill('body','back',HOOD,5);s.faceFill('body','top',LEATHH,4);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',HOODH,4);
  s.fill(a,'front',0,0,4,3,HOOD); // cloak shoulder
  s.fill(a,'front',0,3,4,4,SKIN); // bare forearm
  s.fill(a,'front',0,5,4,1,LEATH); // leather bracer
  s.fill(a,'front',0,8,4,4,LEATH);s.px(a,'front',1,8,LEATHH); // glove
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,6,D(LEATH,0.1)); // pants
  s.px(l,'front',1,3,HOODH);
  s.fill(l,'front',0,6,4,6,LEATH);s.fill(l,'front',0,6,4,1,LEATHH); // tall boots
  s.px(l,'front',0,11,D(LEATH,0.3));s.px(l,'front',3,11,D(LEATH,0.3));
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-male-forest-ranger',nameRu:'Лесной Следопыт',nameEn:'Forest Ranger',role:'страж чащи, лучник',style:'fantasy',gender:'male',model:'classic'}};
