import type { DrawSkin } from '../generate-skins';

// Skin 064: Forest Ivy Dryad
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Forest Ivy Dryad; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin064(draw: DrawSkin) {
  draw({
  id: "f-fantasy-forest-ivy-dryad",
  name: "Forest Ivy Dryad",
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
    220,
    230,
    245,
    255
  ],
  base: [
    120,
    94,
    44,
    255
  ],
  accent: [
    230,
    86,
    78,
    255
  ],
  second: [
    140,
    235,
    180,
    255
  ],
  outfit: 2,
  hairStyle: 5,
  accessory: 11,
  motif: 13,
  face: 1,
  seed: 10100
});
}
