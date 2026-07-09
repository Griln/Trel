'use strict';
const { PNG } = require('pngjs');
const W = 64, H = 64;
// face boxes [x,y,w,h]
const BOX = {
  head:{top:[8,0,8,8],bottom:[16,0,8,8],right:[0,8,8,8],front:[8,8,8,8],left:[16,8,8,8],back:[24,8,8,8]},
  hat: {top:[40,0,8,8],bottom:[48,0,8,8],right:[32,8,8,8],front:[40,8,8,8],left:[48,8,8,8],back:[56,8,8,8]},
  body:{top:[20,16,8,4],bottom:[28,16,8,4],right:[16,20,4,12],front:[20,20,8,12],left:[28,20,4,12],back:[32,20,8,12]},
  rarm:{top:[44,16,4,4],bottom:[48,16,4,4],right:[40,20,4,12],front:[44,20,4,12],left:[48,20,4,12],back:[52,20,4,12]},
  larm:{top:[36,48,4,4],bottom:[40,48,4,4],right:[32,52,4,12],front:[36,52,4,12],left:[40,52,4,12],back:[44,52,4,12]},
  rleg:{top:[4,16,4,4],bottom:[8,16,4,4],right:[0,20,4,12],front:[4,20,4,12],left:[8,20,4,12],back:[12,20,4,12]},
  lleg:{top:[20,48,4,4],bottom:[24,48,4,4],right:[16,52,4,12],front:[20,52,4,12],left:[24,52,4,12],back:[28,52,4,12]},
};
const SH = {top:1.14,bottom:0.66,right:0.80,front:1.0,left:0.90,back:0.74};
const cl = v => v<0?0:v>255?255:v|0;
function shade(c,f){return [cl(c[0]*f),cl(c[1]*f),cl(c[2]*f),c[3]===undefined?255:c[3]];}
function mix(a,b,t){return [cl(a[0]+(b[0]-a[0])*t),cl(a[1]+(b[1]-a[1])*t),cl(a[2]+(b[2]-a[2])*t),255];}

class Skin {
  constructor(){this.png=new PNG({width:W,height:H});this.png.data.fill(0);}
  set(x,y,c){if(x<0||y<0||x>=W||y>=H||!c||c[3]===0)return;const i=(y*W+x)*4,d=this.png.data,a=(c[3]===undefined?255:c[3])/255;
    d[i]=cl(d[i]*(1-a)+c[0]*a);d[i+1]=cl(d[i+1]*(1-a)+c[1]*a);d[i+2]=cl(d[i+2]*(1-a)+c[2]*a);d[i+3]=cl(Math.max(d[i+3],c[3]===undefined?255:c[3]));}
  // px in a specific face of a part, local coords
  px(part,face,lx,ly,c){const r=BOX[part][face];if(lx<0||ly<0||lx>=r[2]||ly>=r[3])return;this.set(r[0]+lx,r[1]+ly,c);}
  // fill a rect within a face
  fill(part,face,x,y,w,h,c){for(let j=0;j<h;j++)for(let i=0;i<w;i++)this.px(part,face,x+i,y+j,c);}
  // fill an entire face with shaded base + optional noise
  faceFill(part,face,c,noise){const r=BOX[part][face],f=SH[face];for(let y=0;y<r[3];y++)for(let x=0;x<r[2];x++){const n=noise?(Math.random()-0.5)*noise:0;const s=shade(c,f);this.px(part,face,x,y,[cl(s[0]+n),cl(s[1]+n),cl(s[2]+n),255]);}}
  // fill all 6 faces of a part (a clothed/skin cuboid) with directional shading
  cuboid(part,c,noise){for(const face of Object.keys(BOX[part]))this.faceFill(part,face,c,noise);}
  save(p){require('fs').writeFileSync(p,PNG.sync.write(this.png));}
}
module.exports={Skin,shade,mix,BOX};
