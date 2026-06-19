import type { DrawSkin } from '../generate-skins';

// Skin 080: Cedar Moon Herald
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Cedar Moon Herald; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin080(draw: DrawSkin) {
  draw({
  id: "n-fantasy-cedar-moon-herald",
  name: "Cedar Moon Herald",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    190,
    70,
    85,
    255
  ],
  base: [
    132,
    76,
    48,
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
  outfit: 7,
  hairStyle: 0,
  accessory: 8,
  motif: 8,
  face: 5,
  seed: 12532
});
}
