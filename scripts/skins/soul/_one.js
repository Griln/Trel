
const fs=require('fs');const {PNG}=require('pngjs');
const f=process.argv[2];
const src=PNG.sync.read(fs.readFileSync(f));
function part(sx,sy,w,h){const a=[];for(let y=0;y<h;y++){const r=[];for(let x=0;x<w;x++){const i=((sy+y)*64+(sx+x))*4;r.push([src.data[i],src.data[i+1],src.data[i+2],src.data[i+3]]);}a.push(r);}return a;}
const head=part(8,8,8,8),hat=part(40,8,8,8),body=part(20,20,8,12),rarm=part(44,20,4,12),larm=part(36,52,4,12),rleg=part(4,20,4,12),lleg=part(20,52,4,12);
const W=16,H=32;const g=Array.from({length:H},()=>Array.from({length:W},()=>[0,0,0,0]));
const put=(p,ox,oy)=>{for(let y=0;y<p.length;y++)for(let x=0;x<p[0].length;x++){if(p[y][x][3]>0)g[oy+y][ox+x]=p[y][x];}};
put(head,4,0);put(hat,4,0);put(rarm,0,8);put(body,4,8);put(larm,12,8);put(rleg,4,20);put(lleg,8,20);
const SC=18,pad=20;const out=new PNG({width:W*SC+pad*2,height:H*SC+pad*2});
out.data.fill(20);for(let i=3;i<out.data.length;i+=4)out.data[i]=255;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const px=g[y][x];if(px[3]===0)continue;for(let dy=0;dy<SC;dy++)for(let dx=0;dx<SC;dx++){const X=pad+x*SC+dx,Y=pad+y*SC+dy;const di=(Y*out.width+X)*4;out.data[di]=px[0];out.data[di+1]=px[1];out.data[di+2]=px[2];out.data[di+3]=255;}}
fs.writeFileSync(process.argv[3],PNG.sync.write(out));console.log('ok');
