import type { DrawSkin } from '../generate-skins';

// Skin 082: Amber Rune Scribe
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Amber Rune Scribe; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin082(draw: DrawSkin) {
  draw({
  id: "n-fantasy-amber-rune-scribe",
  name: "Amber Rune Scribe",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    214,
    220,
    238,
    255
  ],
  hair: [
    86,
    55,
    35,
    255
  ],
  base: [
    95,
    45,
    64,
    255
  ],
  accent: [
    230,
    86,
    78,
    255
  ],
  second: [
    205,
    160,
    255,
    255
  ],
  outfit: 0,
  hairStyle: 6,
  accessory: 6,
  motif: 6,
  face: 1,
  seed: 12830
});
}
