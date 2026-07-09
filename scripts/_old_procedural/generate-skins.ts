import * as fs from 'node:fs';import * as path from 'node:path';type RGBA = [number, number, number, number];
type Category = 'male' | 'female' | 'neutral';
type Style = 'cyber' | 'fantasy' | 'pastel';
type Model = 'classic' | 'slim';

export interface SkinSpec {
  id: string;
  name: string;
  category: Category;
  style: Style;
  model: Model;
  comboTitle?: string;
  vibe?: string;
  skin: RGBA;
  hair: RGBA;
  base: RGBA;
  accent: RGBA;
  second: RGBA;
  eye?: RGBA;
  outfit: number;
  hairStyle: number;
  accessory: number;
  motif: number;
  face: number;
  seed: number;
}

export type DrawSkin = (spec: SkinSpec) => void;

const PNG: any = require('pngjs').PNG;
const ALL: Array<(d: DrawSkin) => void> = require('./skin-scripts/_index').ALL;

// ---------- colour helpers ----------
function cl(v: number): number { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
function shade(c: RGBA, f: number): RGBA { return [cl(c[0] * f), cl(c[1] * f), cl(c[2] * f), c[3]]; }
function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [cl(a[0] + (b[0] - a[0]) * t), cl(a[1] + (b[1] - a[1]) * t), cl(a[2] + (b[2] - a[2]) * t), cl(a[3] + (b[3] - a[3]) * t)];
}
function lum(c: RGBA): number { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}


function hsl(h: number, s: number, l: number, a = 255): RGBA {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [cl((r + m) * 255), cl((g + m) * 255), cl((b + m) * 255), a];
}

// Each style owns a DISTINCT hue band so themes never share colours.
// idx = position of this skin within its style group (0..44)
function themePalette(style: Style, category: Category, idx: number) {
  const n = 45;
  const t = idx / n; // 0..1 spread across the group
  let baseHue = 0, paletteSkin: RGBA, hair: RGBA, base: RGBA, accent: RGBA, second: RGBA, eye: RGBA;
  if (style === 'cyber') {
    // cold neon band, WIDE spread: 160 -> 330 (cyan, blue, violet, magenta, pink)
    baseHue = 160 + t * 175;
    base = hsl(baseHue, 0.30, 0.16);                 // dark techwear
    accent = hsl(baseHue + 8, 1.0, 0.58);            // bright neon
    second = hsl(baseHue + 70, 0.95, 0.62);          // contrasting neon
    hair = hsl(baseHue + 40, 0.65, 0.50);
    paletteSkin = hsl(28, 0.32, 0.62 - (idx % 5) * 0.05);
    eye = hsl(baseHue + 100, 1.0, 0.60);
  } else if (style === 'fantasy') {
    // warm jewel band, WIDE + SATURATED: 10 -> 155 (red, amber, gold, lime, teal)
    baseHue = 10 + t * 145;
    base = hsl(baseHue, 0.78, 0.36);                 // rich saturated cloth
    accent = hsl(baseHue + 22, 1.0, 0.52);           // vivid gold/jewel trim
    second = hsl((baseHue + 175) % 360, 0.95, 0.55); // vivid complementary gem
    hair = hsl((baseHue + 200) % 360, 0.45, 0.32 + (idx % 4) * 0.06);
    paletteSkin = hsl(26, 0.40, 0.58 - (idx % 5) * 0.05);
    eye = hsl((baseHue + 150) % 360, 0.85, 0.45);
  } else {
    // pastel band: full circle but high lightness + low saturation, unique per skin
    baseHue = (idx * (360 / n)) % 360;
    base = hsl(baseHue, 0.70, 0.78);                 // vivid-but-soft pastel
    accent = hsl(baseHue + 40, 0.85, 0.66);
    second = hsl(baseHue + 200, 0.80, 0.70);
    hair = hsl(baseHue + 160, 0.80, 0.64);
    paletteSkin = hsl(30, 0.45, 0.80 - (idx % 4) * 0.04);
    eye = hsl(baseHue + 180, 0.70, 0.55);
  }
  return { skin: paletteSkin, hair, base, accent, second, eye };
}

const W = 64, H = 64;

// face regions [x,y,w,h]
type Box = { top: number[]; bottom: number[]; right: number[]; front: number[]; left: number[]; back: number[] };
const HEAD: Box = { top:[8,0,8,8], bottom:[16,0,8,8], right:[0,8,8,8], front:[8,8,8,8], left:[16,8,8,8], back:[24,8,8,8] };
const HAT:  Box = { top:[40,0,8,8], bottom:[48,0,8,8], right:[32,8,8,8], front:[40,8,8,8], left:[48,8,8,8], back:[56,8,8,8] };
const BODY: Box = { top:[20,16,8,4], bottom:[28,16,8,4], right:[16,20,4,12], front:[20,20,8,12], left:[28,20,4,12], back:[32,20,8,12] };
const RARM: Box = { top:[44,16,4,4], bottom:[48,16,4,4], right:[40,20,4,12], front:[44,20,4,12], left:[48,20,4,12], back:[52,20,4,12] };
const LARM: Box = { top:[36,48,4,4], bottom:[40,48,4,4], right:[32,52,4,12], front:[36,52,4,12], left:[40,52,4,12], back:[44,52,4,12] };
const RLEG: Box = { top:[4,16,4,4], bottom:[8,16,4,4], right:[0,20,4,12], front:[4,20,4,12], left:[8,20,4,12], back:[12,20,4,12] };
const LLEG: Box = { top:[20,48,4,4], bottom:[24,48,4,4], right:[16,52,4,12], front:[20,52,4,12], left:[24,52,4,12], back:[28,52,4,12] };

const FACE_SHADE: Record<string, number> = { top: 1.14, bottom: 0.66, right: 0.80, front: 1.0, left: 0.90, back: 0.74 };

class Canvas {
  png: any;
  constructor() { this.png = new PNG({ width: W, height: H }); this.png.data.fill(0); }
  set(x: number, y: number, c: RGBA) {
    if (x < 0 || y < 0 || x >= W || y >= H || c[3] === 0) return;
    const i = (y * W + x) * 4;
    const d = this.png.data;
    const a = c[3] / 255;
    d[i] = cl(d[i] * (1 - a) + c[0] * a);
    d[i+1] = cl(d[i+1] * (1 - a) + c[1] * a);
    d[i+2] = cl(d[i+2] * (1 - a) + c[2] * a);
    d[i+3] = cl(Math.max(d[i+3], c[3]));
  }
  rect(r: number[], c: RGBA) { for (let y=0;y<r[3];y++) for (let x=0;x<r[2];x++) this.set(r[0]+x, r[1]+y, c); }
  // local pixel within a face: lx,ly from face origin
  loc(r: number[], lx: number, ly: number, c: RGBA) { this.set(r[0]+lx, r[1]+ly, c); }
  buffer(): Buffer { return PNG.sync.write(this.png); }
}

// fill a whole cuboid with directional shading + subtle texture noise
function cuboid(cv: Canvas, box: Box, base: RGBA, rnd: () => number, tex = 10) {
  (Object.keys(box) as Array<keyof Box>).forEach((k) => {
    const r = box[k];
    const f = FACE_SHADE[k as string];
    for (let y=0;y<r[3];y++) for (let x=0;x<r[2];x++) {
      const n = (rnd() - 0.5) * tex;
      const c = shade(base, f) as RGBA;
      cv.loc(r, x, y, [cl(c[0]+n), cl(c[1]+n), cl(c[2]+n), 255]);
    }
  });
}

// ---------- feature drawing ----------
function drawFace(cv: Canvas, spec: SkinSpec) {
  const F = HEAD.front;
  const skin = spec.skin;
  const v = spec.face % 6;
  const eyePalette: RGBA[] = [[60,200,255,255],[80,255,160,255],[255,95,140,255],[180,120,255,255],[255,200,70,255],[120,160,255,255],[90,230,210,255],[255,140,95,255]];
  const iris: RGBA = spec.eye ? spec.eye : (spec.style === 'cyber' ? spec.accent : eyePalette[(spec.seed + v) % eyePalette.length]);
  const white: RGBA = [240,243,249,255];
  const pupil: RGBA = [18,16,26,255];
  const dark = shade(skin, 0.5) as RGBA;
  const brow = shade(spec.hair, 0.8) as RGBA;
  // eyebrows
  if (v !== 2) {
    for (let x=1;x<3;x++) cv.loc(F,x,2,brow);
    for (let x=5;x<7;x++) cv.loc(F,x,2,brow);
    if (v === 1) { cv.loc(F,2,2,brow); cv.loc(F,2,3,brow); cv.loc(F,5,3,brow); cv.loc(F,5,2,brow); } // determined slant
  }
  // 2x2 expressive eyes with a GUARANTEED dark pupil + glint
  const irisDark = shade(iris, 0.7) as RGBA;
  const eye = (ex: number, mirror: boolean) => {
    // sclera background (both rows) so the eye always has a white shell
    cv.loc(F, ex, 3, white);     cv.loc(F, ex+1, 3, white);
    cv.loc(F, ex, 4, white);     cv.loc(F, ex+1, 4, white);
    // iris fills, pupil dot on the inner side, glint on the outer-top
    const pCol = ex; const oCol = ex + 1;        // inner vs outer cell
    const pupilCell = mirror ? pCol : oCol;
    const irisCell  = mirror ? oCol : pCol;
    cv.loc(F, irisCell, 4, iris);                // iris (lower)
    cv.loc(F, irisCell, 3, irisDark);            // iris (upper, darker)
    cv.loc(F, pupilCell, 4, pupil);              // <-- the pupil DOT, always present
    cv.loc(F, pupilCell, 3, [255,255,255,255]);  // glint highlight above pupil
  };
  if (v === 2) { // visor / cyber band
    const band: RGBA = spec.style === 'cyber' ? spec.accent : shade(spec.base, 0.4) as RGBA;
    for (let x=1;x<7;x++) { cv.loc(F,x,4,band); cv.loc(F,x,3,shade(band,0.65) as RGBA); }
    cv.loc(F,2,4,mix(band,[255,255,255,255],0.75) as RGBA);
    cv.loc(F,5,3,mix(band,[255,255,255,255],0.45) as RGBA);
  } else {
    eye(1, true); eye(5, false);
    if (spec.category === 'female') { cv.loc(F,0,3,dark); cv.loc(F,7,3,dark); cv.loc(F,0,4,mix(dark,skin,0.2) as RGBA); cv.loc(F,7,4,mix(dark,skin,0.2) as RGBA); } // lashes
    if (v === 5) { cv.loc(F,1,3,dark); cv.loc(F,2,3,dark); cv.loc(F,5,3,dark); cv.loc(F,6,3,dark); } // cool half-lid (over sclera-top, keeps pupil)
  }
  // mouth variants
  if (v === 3) { cv.loc(F,3,6,dark); cv.loc(F,4,6,dark); cv.loc(F,2,6,mix(dark,skin,0.45) as RGBA); cv.loc(F,5,6,mix(dark,skin,0.45) as RGBA); }
  else if (v === 4) { cv.loc(F,3,6,dark); cv.loc(F,4,6,dark); cv.loc(F,3,7,mix(dark,skin,0.3) as RGBA); cv.loc(F,4,7,mix(dark,skin,0.3) as RGBA); }
  else { cv.loc(F,3,6,dark); cv.loc(F,4,6,dark); }
  // cheeks & paint
  if (spec.style === 'pastel' || v === 3) { const blush = mix(skin,[255,120,150,255],0.5) as RGBA; cv.loc(F,1,5,blush); cv.loc(F,6,5,blush); }
  if (spec.style === 'fantasy' && (v === 4 || v === 1)) { cv.loc(F,0,4,spec.accent); cv.loc(F,7,4,spec.accent); }
  cv.loc(F, 4, 5, shade(skin, 0.82) as RGBA); // nose shadow
}

function drawHair(cv: Canvas, spec: SkinSpec) {
  const hc = spec.hair;
  const hi = mix(hc, [255,255,255,255], 0.22) as RGBA;
  const hd = shade(hc, 0.7) as RGBA;
  const st = spec.hairStyle % 12;
  const longHair = st >= 8 || spec.category === 'female' && st >= 4;
  const medium = st >= 4;
  const rnd = rng(spec.seed + 7);
  // top of head
  for (let y=0;y<8;y++) for (let x=0;x<8;x++) {
    const c = y < 2 ? hi : (rnd() < 0.25 ? hd : hc);
    cv.loc(HEAD.top, x, y, c);
  }
  // back of head
  for (let y=0;y<8;y++) for (let x=0;x<8;x++) cv.loc(HEAD.back, x, y, y<5||medium ? (rnd()<0.2?hd:hc) : hc);
  // side framing
  const sideRows = longHair ? 8 : (medium ? 5 : 3);
  for (let y=0;y<sideRows;y++) for (let x=0;x<8;x++) { cv.loc(HEAD.right, x, y, hc); cv.loc(HEAD.left, x, y, hc); }
  // front fringe
  const F = HEAD.front;
  let fringe = 2;
  if (st % 4 === 1) fringe = 1; // high forehead
  if (st % 4 === 2) fringe = 3; // heavy bangs
  for (let y=0;y<fringe;y++) for (let x=0;x<8;x++) cv.loc(F, x, y, y===0?hi:hc);
  // side bangs framing the face
  for (let y=fringe;y<(longHair?8:5);y++) { cv.loc(F,0,y,hc); cv.loc(F,7,y,hc); }
  if (st % 4 === 3) { // spiky / center part
    for (let x=1;x<7;x+=2) cv.loc(F, x, fringe, hd);
  }
  if (longHair) { // hair flows onto shoulders/back
    for (let y=0;y<4;y++) { cv.loc(BODY.back, 0, y, hc); cv.loc(BODY.back, 7, y, hc); cv.loc(BODY.back,1,y,hd); cv.loc(BODY.back,6,y,hd); }
  }
}

function drawAccessory(cv: Canvas, spec: SkinSpec) {
  const a = spec.accessory % 12;
  const ac = spec.accent;
  const gl = spec.second;
  const F = HEAD.front;
  if (a === 1) { // headphones / side pods
    for (let y=2;y<5;y++) { cv.loc(HEAD.right,1,y,ac); cv.loc(HEAD.left,6,y,ac); }
    for (let x=0;x<8;x++) cv.loc(HAT.top, x, 0, shade(ac,0.8) as RGBA);
  } else if (a === 2) { // visor band on forehead
    for (let x=0;x<8;x++) cv.loc(F, x, 1, ac);
  } else if (a === 3) { // halo (hat ring)
    for (let x=1;x<7;x++) { cv.loc(HAT.top,x,0,mix(ac,[255,255,255,255],0.5) as RGBA); }
  } else if (a === 4) { // horns
    cv.loc(HAT.top,1,0,shade(ac,0.7) as RGBA); cv.loc(HAT.top,6,0,shade(ac,0.7) as RGBA);
    cv.loc(HEAD.top,0,0,shade(ac,0.6) as RGBA); cv.loc(HEAD.top,7,0,shade(ac,0.6) as RGBA);
  } else if (a === 5) { // glasses
    for (let x=1;x<7;x++) cv.loc(F,x,4,shade([20,20,28,255] as RGBA,1) as RGBA);
    cv.loc(F,3,4,mix(gl,[255,255,255,255],0.4) as RGBA);
  } else if (a === 6) { // mask over mouth
    for (let x=2;x<6;x++) { cv.loc(F,x,6,shade(spec.base,0.8) as RGBA); cv.loc(F,x,5,shade(spec.base,0.9) as RGBA); }
  } else if (a === 7) { // crown
    for (let x=0;x<8;x++) cv.loc(HAT.front,x,0,ac);
    cv.loc(HAT.front,1,0,gl); cv.loc(HAT.front,4,0,gl); cv.loc(HAT.front,6,0,gl);
  } else if (a === 8) { // ear studs / earrings
    cv.loc(HEAD.right,0,5,gl); cv.loc(HEAD.left,7,5,gl);
  } else if (a === 9) { // cat ears (pastel)
    cv.loc(HAT.top,1,0,spec.hair); cv.loc(HAT.top,2,0,mix(spec.hair,ac,0.5) as RGBA);
    cv.loc(HAT.top,5,0,mix(spec.hair,ac,0.5) as RGBA); cv.loc(HAT.top,6,0,spec.hair);
  } else if (a === 10) { // cheek tech tattoo
    cv.loc(F,6,5,gl); cv.loc(F,6,6,gl); cv.loc(F,5,6,gl);
  } else if (a === 11) { // forehead gem
    cv.loc(F,3,2,gl); cv.loc(F,4,2,mix(gl,[255,255,255,255],0.5) as RGBA);
  }
}

function drawTorso(cv: Canvas, spec: SkinSpec) {
  const base = spec.base;
  const ac = spec.accent;
  const gl = spec.second;
  const dark = shade(base, 0.62) as RGBA;
  const F = BODY.front;
  const o = spec.outfit % 9;
  const m = spec.motif % 16;
  const fill = (x0:number,y0:number,w:number,hh:number,c:RGBA)=>{ for(let y=y0;y<y0+hh;y++) for(let x=x0;x<x0+w;x++) cv.loc(F,x,y,c); };
  // ---- bold outfit silhouettes (clearly distinct) ----
  if (o === 1) { fill(0,0,8,6, shade(ac,0.95) as RGBA); }                                  // accent top half
  else if (o === 2) { fill(4,0,4,12, mix(base,ac,0.85) as RGBA); }                          // right-half two-tone
  else if (o === 3) { fill(2,0,4,12, shade(ac,0.9) as RGBA); }                              // central vest panel
  else if (o === 4) { fill(0,0,8,2, ac); fill(0,0,2,5, ac); fill(6,0,2,5, ac); }            // big shoulder pads
  else if (o === 5) { for(let y=0;y<12;y++) for(let x=0;x<8;x++){ if(x+y<8) cv.loc(F,x,y,mix(base,gl,0.8) as RGBA);} } // diagonal robe
  else if (o === 6) { fill(0,0,8,2, ac); fill(0,2,8,1, shade(ac,0.7) as RGBA); }            // heavy collar
  else if (o === 7) { fill(0,3,8,2, ac); fill(0,7,8,2, shade(ac,0.8) as RGBA); }            // utility harness bands
  else if (o === 8) { cv.rect([F[0]+1,F[1]+1,3,6], shade(base,1.18) as RGBA); cv.rect([F[0]+4,F[1]+1,3,6], shade(base,0.82) as RGBA); } // armour plates
  // neckline accent
  if (o % 3 === 0) for (let x=3;x<5;x++) cv.loc(F,x,0,mix(ac,[255,255,255,255],0.3) as RGBA);
  // ---- motif (contrasting) ----
  const stripe = lum(ac) > lum(base) ? ac : gl;
  if (m === 1) { fill(4,0,1,12, stripe); cv.loc(F,3,2,shade(stripe,0.7) as RGBA); cv.loc(F,3,6,shade(stripe,0.7) as RGBA); } // zipper + pulls
  else if (m === 2) { fill(1,0,1,12, stripe); fill(6,0,1,12, stripe); }
  else if (m === 3) { fill(0,5,8,2, stripe); }                                              // chest band
  else if (m === 4) { for (let i=0;i<8;i++){ cv.loc(F,i,i+2,stripe); cv.loc(F,i,i+1,shade(stripe,0.7) as RGBA);} } // sash
  else if (m === 5) { cv.loc(F,4,2,gl);cv.loc(F,3,3,gl);cv.loc(F,5,3,gl);cv.loc(F,2,4,gl);cv.loc(F,6,4,gl);cv.loc(F,3,5,gl);cv.loc(F,5,5,gl);cv.loc(F,4,6,gl);cv.loc(F,4,4,mix(gl,[255,255,255,255],0.6) as RGBA);} // big diamond
  else if (m === 6) { fill(2,4,4,1,stripe); fill(3,2,1,5,stripe); }                          // cross
  else if (m === 7) { for (let i=0;i<5;i++){cv.loc(F,3-i+1,i+1,stripe);cv.loc(F,4+i-1,i+1,stripe);} } // chevrons
  else if (m === 8) { for (let y=1;y<11;y+=2) for (let x=1;x<7;x+=2) cv.loc(F,x,y,mix(base,stripe,0.6) as RGBA); } // grid
  else if (m === 9) { for (let y=0;y<12;y++) for (let x=0;x<8;x++) cv.loc(F,x,y, mix(base, ac, y/13) as RGBA); } // gradient
  else if (m === 10) { cv.loc(F,2,4,gl);cv.loc(F,3,3,gl);cv.loc(F,4,4,gl);cv.loc(F,5,3,gl);cv.loc(F,6,4,gl);fill(2,5,5,1,gl);fill(3,6,3,1,gl);cv.loc(F,4,7,gl);} // heart
  else if (m === 11) { cv.loc(F,4,2,gl);fill(2,4,5,1,gl);cv.loc(F,3,5,gl);cv.loc(F,5,5,gl);cv.loc(F,3,3,gl);cv.loc(F,5,3,gl);cv.loc(F,4,4,mix(gl,[255,255,255,255],0.6) as RGBA);} // star
  else if (m === 12) { fill(1,3,6,1,gl); for(let y=3;y<8;y++) cv.loc(F,6,y,gl); cv.loc(F,1,3,ac);cv.loc(F,6,7,ac);cv.loc(F,3,3,mix(gl,[255,255,255,255],0.6) as RGBA);cv.loc(F,2,6,gl);cv.loc(F,5,5,gl);} // circuit
  else if (m === 13) { for (let y=2;y<9;y++) cv.loc(F,4,y, y%2?ac:gl); cv.loc(F,3,3,ac);cv.loc(F,5,5,ac);cv.loc(F,3,7,ac);cv.loc(F,5,3,gl);} // runes
  else if (m === 14) { fill(0,2,8,1,stripe); fill(0,5,8,1,stripe); fill(0,8,8,1,stripe); }   // stripes
  else if (m === 15) { for(let y=1;y<9;y+=2) for(let x=0;x<8;x++) cv.loc(F,x,y, (x+y)%2?mix(base,stripe,0.4) as RGBA:base); } // weave
  // belt
  fill(0,10,8,1, dark);
  cv.loc(F,3,10,ac); cv.loc(F,4,10,mix(ac,[255,255,255,255],0.4) as RGBA);
}

function drawArm(cv: Canvas, box: Box, spec: SkinSpec, sleeveCol: RGBA) {
  const skin = spec.skin;
  const ac = spec.accent;
  // hand (lower 4 rows) skin
  for (const k of ['front','back','left','right'] as Array<keyof Box>) {
    const r = box[k]; for (let y=8;y<12;y++) for (let x=0;x<r[2];x++) cv.loc(r, x, y, shade(skin, FACE_SHADE[k as string]) as RGBA);
  }
  // cuff
  for (const k of ['front','back','left','right'] as Array<keyof Box>) { const r = box[k]; for (let x=0;x<r[2];x++) cv.loc(r, x, 7, ac); }
  // shoulder accent
  for (let x=0;x<box.front[2];x++) cv.loc(box.front, x, 0, mix(sleeveCol, ac, 0.5) as RGBA);
}

function drawLeg(cv: Canvas, box: Box, spec: SkinSpec, pants: RGBA) {
  const shoe = shade(mix(spec.base, [30,30,38,255], 0.6) as RGBA, 1) as RGBA;
  const ac = spec.accent;
  for (const k of ['front','back','left','right'] as Array<keyof Box>) {
    const r = box[k]; for (let y=9;y<12;y++) for (let x=0;x<r[2];x++) cv.loc(r, x, y, shade(shoe, FACE_SHADE[k as string]) as RGBA);
  }
  // knee accent line + side stripe
  for (let x=0;x<box.front[2];x++) cv.loc(box.front, x, 8, mix(pants, ac, 0.4) as RGBA);
  for (let y=0;y<9;y++) cv.loc(box.front, 0, y, mix(pants, ac, 0.3) as RGBA);
}

function flourish(cv: Canvas, spec: SkinSpec) {
  const gl = spec.second; const ac = spec.accent;
  if (spec.style === 'cyber') {
    // neon edge glow on torso & arms
    for (let y=2;y<10;y++) { cv.loc(BODY.front,0,y,mix(BODY===BODY?spec.base:spec.base,gl,0.4) as RGBA); cv.loc(BODY.front,7,y,mix(spec.base,gl,0.4) as RGBA); }
    for (let y=0;y<8;y++){ cv.loc(RARM.front,0,y,mix(spec.base,gl,0.45) as RGBA); cv.loc(LARM.front,2,y,mix(spec.base,gl,0.45) as RGBA); }
  } else if (spec.style === 'fantasy') {
    // gold trim on collar, belt, boots
    const gold: RGBA = mix(ac,[255,210,90,255],0.5) as RGBA;
    for (let x=0;x<8;x++){ cv.loc(BODY.front,x,1,gold); }
    for (let x=0;x<RLEG.front[2];x++){ cv.loc(RLEG.front,x,11,gold); cv.loc(LLEG.front,x,11,gold); }
  } else { // pastel: soft highlight + sparkle
    for (let x=0;x<8;x++) cv.loc(BODY.front,x,0,mix(spec.base,[255,255,255,255],0.3) as RGBA);
    cv.loc(HEAD.front,2,1,mix(spec.hair,[255,255,255,255],0.6) as RGBA);
  }
}

function render(spec: SkinSpec): Buffer {
  const cv = new Canvas();
  const rnd = rng(spec.seed || 1);
  const o = spec.outfit % 9;
  const B = spec.base, A = spec.accent, S = spec.second;
  const sleeveTbl: RGBA[] = [shade(B,0.92) as RGBA, mix(B,A,0.6) as RGBA, shade(B,0.92) as RGBA, A, shade(B,0.8) as RGBA, mix(B,S,0.55) as RGBA, shade(A,0.8) as RGBA, shade(B,0.92) as RGBA, mix(B,A,0.35) as RGBA];
  const pantsTbl: RGBA[] = [mix(B,[25,25,32,255],0.45) as RGBA, shade(B,0.7) as RGBA, mix(B,S,0.4) as RGBA, shade(B,0.6) as RGBA, mix(B,A,0.5) as RGBA, mix(B,[25,25,32,255],0.5) as RGBA, shade(A,0.5) as RGBA, A, shade(B,0.65) as RGBA];
  const sleeve = sleeveTbl[o];
  const pants = pantsTbl[o];
  // base cuboids
  cuboid(cv, HEAD, spec.skin, rnd, 8);
  cuboid(cv, BODY, spec.base, rnd, 8);
  cuboid(cv, RARM, sleeve, rnd, 8);
  cuboid(cv, LARM, sleeve, rnd, 8);
  cuboid(cv, RLEG, pants, rnd, 8);
  cuboid(cv, LLEG, pants, rnd, 8);
  // details
  drawHair(cv, spec);
  drawFace(cv, spec);
  drawAccessory(cv, spec);
  drawTorso(cv, spec);
  drawArm(cv, RARM, spec, sleeve);
  drawArm(cv, LARM, spec, sleeve);
  drawLeg(cv, RLEG, spec, pants);
  drawLeg(cv, LLEG, spec, pants);
  flourish(cv, spec);
  return cv.buffer();
}

// ---------- runner ----------
function slug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

const root = process.cwd();
const skinsDir = path.join(root, 'resources', 'skins');
const buildDir = path.join(root, 'build', 'skins');
const presetsPath = path.join(root, 'src', 'renderer', 'data', 'skin-presets.ts');

for (const dir of [skinsDir, buildDir]) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(dir, f));
}

const presets: any[] = [];
const seen = new Set<string>();
const styleCount: Record<string, number> = { cyber: 0, fantasy: 0, pastel: 0 };
const draw: DrawSkin = (spec) => {
  const id = slug(spec.style + '-' + spec.category + '-' + spec.name);
  if (seen.has(id)) throw new Error('Duplicate skin id: ' + id);
  seen.add(id);
  // FORCE a unique, theme-distinct palette per skin (overrides per-script colours)
  const idx = styleCount[spec.style]++;
  const pal = themePalette(spec.style, spec.category, idx);
  spec.skin = pal.skin; spec.hair = pal.hair; spec.base = pal.base;
  spec.accent = pal.accent; spec.second = pal.second; spec.eye = pal.eye;
  const buf = render(spec);
  const file = id + '.png';
  fs.writeFileSync(path.join(skinsDir, file), buf);
  fs.writeFileSync(path.join(buildDir, file), buf);
  presets.push({
    id,
    name: spec.name,
    category: spec.category,
    description: (spec.comboTitle || spec.name) + ': ' + spec.style + ' ' + spec.category + (spec.vibe ? ' - ' + spec.vibe : ''),
    model: spec.model,
    style: spec.style,
    dataUrl: 'data:image/png;base64,' + buf.toString('base64'),
  });
};

for (const fn of ALL) fn(draw);
if (presets.length !== 135) throw new Error('Expected 135 skins, got ' + presets.length);

presets.sort((a, b) => a.id.localeCompare(b.id));
const header = 'export interface SkinPreset {\n  id: string;\n  name: string;\n  category: \'male\' | \'female\' | \'neutral\';\n  description: string;\n  model: \'classic\' | \'slim\';\n  style: \'cyber\' | \'fantasy\' | \'pastel\';\n  dataUrl: string;\n}\n\nexport const SKIN_PRESETS: SkinPreset[] = ';
fs.mkdirSync(path.dirname(presetsPath), { recursive: true });
fs.writeFileSync(presetsPath, header + JSON.stringify(presets, null, 2) + ';\n', 'utf8');
console.log('Rendered ' + presets.length + ' skins -> resources/skins, build/skins, skin-presets.ts');
console.log('Distribution: 3 styles x 3 genders x 15 skins');