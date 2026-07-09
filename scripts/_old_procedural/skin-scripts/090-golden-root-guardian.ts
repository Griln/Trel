import type { DrawSkin } from '../generate-skins';

// Skin 090: Golden Root Guardian
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Golden Root Guardian; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin090(draw: DrawSkin) {
  draw({
  id: "n-fantasy-golden-root-guardian",
  name: "Golden Root Guardian",
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
    52,
    52,
    70,
    255
  ],
  base: [
    95,
    45,
    64,
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
  outfit: 8,
  hairStyle: 6,
  accessory: 10,
  motif: 14,
  face: 3,
  seed: 14115
});
}
