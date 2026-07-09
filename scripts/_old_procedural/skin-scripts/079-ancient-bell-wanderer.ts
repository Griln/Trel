import type { DrawSkin } from '../generate-skins';

// Skin 079: Ancient Bell Wanderer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ancient Bell Wanderer; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin079(draw: DrawSkin) {
  draw({
  id: "n-fantasy-ancient-bell-wanderer",
  name: "Ancient Bell Wanderer",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    224,
    181,
    145,
    255
  ],
  hair: [
    238,
    210,
    165,
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
    120,
    205,
    255,
    255
  ],
  outfit: 6,
  hairStyle: 9,
  accessory: 3,
  motif: 1,
  face: 4,
  seed: 12507
});
}
