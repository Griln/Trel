'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const BODY=[200,232,238,255],BODYH=[228,246,250,255],BODYD=[166,206,215,255]; // mint-blue metal
const PINK=[255,200,222,255],PINKH=[255,224,236,255];
const SCREEN=[255,250,225,255]; // screen face
const YEL=[255,238,170,255];
const PURP=[218,200,245,255];
// HEAD — a cube robot with a screen
s.cuboid('head',BODY,2);
s.faceFill('head','top',BODYH,2);s.faceFill('head','back',BODYD,2);
// lollipop antennae
s.px('hat','top',2,0,PINK);s.px('hat','top',5,0,YEL);s.px('head','front',2,0,PINKH);s.px('head','front',5,0,YEL);
// panel seams
s.fill('head','front',0,1,8,1,BODYD);s.px('head','front',0,4,BODYD);s.px('head','front',7,4,BODYD);
// SCREEN FACE
s.fill('head','front',1,2,6,5,SCREEN);
s.fill('head','front',1,2,6,1,D(SCREEN,0.1));
// pixel eyes (^ ^ happy)
s.px('head','front',2,3,PINK);s.px('head','front',2,4,PINK);s.px('head','front',5,3,PINK);s.px('head','front',5,4,PINK);
s.px('head','front',1,4,PINK);s.px('head','front',6,4,PINK);
// pixel smile
s.px('head','front',2,6,YEL);s.px('head','front',3,6,YEL);s.px('head','front',4,6,YEL);s.px('head','front',5,6,YEL);
// rosy diode cheeks
s.px('head','front',1,5,PINK);s.px('head','front',6,5,PINK);
// TORSO — body with candy buttons
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,BODY,2);
s.fill('body','front',1,1,6,8,BODYH);
s.fill('body','front',1,1,6,1,D(BODY,0.05));
// round heart display
s.fill('body','front',3,3,2,2,SCREEN);s.px('body','front',3,3,PINK);s.px('body','front',4,4,PINK);
// candy buttons
s.px('body','front',2,2,PINK);s.px('body','front',5,2,YEL);s.px('body','front',2,6,PURP);s.px('body','front',5,6,PINK);
s.px('body','front',2,7,YEL);s.px('body','front',5,7,PURP);
// indicator strip
s.fill('body','front',1,8,6,1,PURP);for(const x of [2,4,6])s.px('body','front',x,8,YEL);
// segment seams
s.fill('body','front',1,5,6,1,BODYD);
s.fill('body','front',0,10,8,1,BODYD);s.px('body','front',3,10,PINK);s.px('body','front',4,10,YEL);
s.faceFill('body','back',BODYD,2);s.faceFill('body','top',BODYH,2);
for(const a of ['rarm','larm']){
  s.cuboid(a,BODY,2);
  s.fill(a,'front',0,3,4,1,BODYD);s.fill(a,'front',0,7,4,1,BODYD); // joints
  s.px(a,'front',1,2,PINK);s.px(a,'front',2,5,YEL); // buttons
  s.fill(a,'front',0,10,4,2,PURP);s.px(a,'front',1,11,PINKH); // claw mitten
}
for(const l of ['rleg','lleg']){
  s.cuboid(l,BODY,2);
  s.fill(l,'front',0,4,4,1,BODYD);
  s.px(l,'front',1,3,PINK);s.px(l,'front',2,7,YEL);
  s.fill(l,'front',0,10,4,2,PURP);s.fill(l,'front',0,11,4,1,PINKH); // boots
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-neutral-candy-bot',nameRu:'Леденцовый Робот',nameEn:'Candy Bot',role:'дружелюбный робот-сладкоежка',style:'pastel',gender:'neutral',model:'classic'}};
