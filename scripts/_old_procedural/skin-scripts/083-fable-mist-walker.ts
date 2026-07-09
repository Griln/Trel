import type { DrawSkin } from '../generate-skins';

// Skin 083: Fable Mist Walker
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Fable Mist Walker; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin083(draw: DrawSkin) {
  draw({
  id: "n-fantasy-fable-mist-walker",
  name: "Fable Mist Walker",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    235,
    120,
    190,
    255
  ],
  base: [
    38,
    58,
    92,
    255
  ],
  accent: [
    255,
    170,
    90,
    255
  ],
  second: [
    245,
    208,
    88,
    255
  ],
  outfit: 1,
  hairStyle: 9,
  accessory: 11,
  motif: 13,
  face: 2,
  seed: 12979
});
}
