import type { DrawSkin } from '../generate-skins';

// Skin 073: Rose Paladin Muse
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Rose Paladin Muse; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin073(draw: DrawSkin) {
  draw({
  id: "f-fantasy-rose-paladin-muse",
  name: "Rose Paladin Muse",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    246,
    219,
    190,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    92,
    62,
    38,
    255
  ],
  accent: [
    245,
    208,
    88,
    255
  ],
  second: [
    255,
    170,
    90,
    255
  ],
  outfit: 2,
  hairStyle: 8,
  accessory: 8,
  motif: 12,
  face: 4,
  seed: 11472
});
}
