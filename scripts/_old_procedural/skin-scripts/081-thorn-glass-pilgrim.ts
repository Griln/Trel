import type { DrawSkin } from '../generate-skins';

// Skin 081: Thorn Glass Pilgrim
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Thorn Glass Pilgrim; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin081(draw: DrawSkin) {
  draw({
  id: "n-fantasy-thorn-glass-pilgrim",
  name: "Thorn Glass Pilgrim",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    86,
    55,
    35,
    255
  ],
  base: [
    42,
    78,
    58,
    255
  ],
  accent: [
    80,
    220,
    120,
    255
  ],
  second: [
    80,
    220,
    120,
    255
  ],
  outfit: 8,
  hairStyle: 3,
  accessory: 1,
  motif: 15,
  face: 0,
  seed: 12743
});
}
