import type { DrawSkin } from '../generate-skins';

// Skin 086: Star Antler Mystic
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Star Antler Mystic; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin086(draw: DrawSkin) {
  draw({
  id: "n-fantasy-star-antler-mystic",
  name: "Star Antler Mystic",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    238,
    210,
    165,
    255
  ],
  base: [
    54,
    112,
    62,
    255
  ],
  accent: [
    205,
    160,
    255,
    255
  ],
  second: [
    120,
    205,
    255,
    255
  ],
  outfit: 4,
  hairStyle: 6,
  accessory: 2,
  motif: 2,
  face: 5,
  seed: 13457
});
}
