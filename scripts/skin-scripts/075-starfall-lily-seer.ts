import type { DrawSkin } from '../generate-skins';

// Skin 075: Starfall Lily Seer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Starfall Lily Seer; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin075(draw: DrawSkin) {
  draw({
  id: "f-fantasy-starfall-lily-seer",
  name: "Starfall Lily Seer",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    40,
    170,
    160,
    255
  ],
  base: [
    76,
    66,
    142,
    255
  ],
  accent: [
    205,
    160,
    255,
    255
  ],
  second: [
    205,
    160,
    255,
    255
  ],
  outfit: 4,
  hairStyle: 2,
  accessory: 6,
  motif: 10,
  face: 0,
  seed: 11801
});
}
