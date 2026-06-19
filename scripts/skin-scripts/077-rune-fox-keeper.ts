import type { DrawSkin } from '../generate-skins';

// Skin 077: Rune Fox Keeper
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Rune Fox Keeper; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin077(draw: DrawSkin) {
  draw({
  id: "n-fantasy-rune-fox-keeper",
  name: "Rune Fox Keeper",
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
    38,
    27,
    28,
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
    230,
    86,
    78,
    255
  ],
  outfit: 4,
  hairStyle: 3,
  accessory: 5,
  motif: 3,
  face: 2,
  seed: 12023
});
}
