import type { DrawSkin } from '../generate-skins';

// Skin 084: Oak Crown Observer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Oak Crown Observer; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin084(draw: DrawSkin) {
  draw({
  id: "n-fantasy-oak-crown-observer",
  name: "Oak Crown Observer",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    154,
    96,
    64,
    255
  ],
  hair: [
    112,
    52,
    140,
    255
  ],
  base: [
    120,
    94,
    44,
    255
  ],
  accent: [
    245,
    208,
    88,
    255
  ],
  second: [
    230,
    86,
    78,
    255
  ],
  outfit: 2,
  hairStyle: 0,
  accessory: 4,
  motif: 4,
  face: 3,
  seed: 13159
});
}
