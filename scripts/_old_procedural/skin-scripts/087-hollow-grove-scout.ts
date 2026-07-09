import type { DrawSkin } from '../generate-skins';

// Skin 087: Hollow Grove Scout
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Hollow Grove Scout; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin087(draw: DrawSkin) {
  draw({
  id: "n-fantasy-hollow-grove-scout",
  name: "Hollow Grove Scout",
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
    86,
    55,
    35,
    255
  ],
  base: [
    76,
    66,
    142,
    255
  ],
  accent: [
    140,
    235,
    180,
    255
  ],
  second: [
    255,
    170,
    90,
    255
  ],
  outfit: 5,
  hairStyle: 9,
  accessory: 7,
  motif: 9,
  face: 0,
  seed: 13606
});
}
