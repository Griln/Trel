import type { DrawSkin } from '../generate-skins';

// Skin 078: Silver Leaf Nomad
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Silver Leaf Nomad; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin078(draw: DrawSkin) {
  draw({
  id: "n-fantasy-silver-leaf-nomad",
  name: "Silver Leaf Nomad",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    246,
    219,
    190,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    54,
    112,
    62,
    255
  ],
  accent: [
    120,
    205,
    255,
    255
  ],
  second: [
    140,
    235,
    180,
    255
  ],
  outfit: 5,
  hairStyle: 6,
  accessory: 10,
  motif: 10,
  face: 3,
  seed: 12234
});
}
