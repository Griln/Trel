import type { DrawSkin } from '../generate-skins';

// Skin 089: Velvet Owl Seeker
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Velvet Owl Seeker; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin089(draw: DrawSkin) {
  draw({
  id: "n-fantasy-velvet-owl-seeker",
  name: "Velvet Owl Seeker",
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
    70,
    86,
    125,
    255
  ],
  base: [
    42,
    78,
    58,
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
  outfit: 7,
  hairStyle: 3,
  accessory: 5,
  motif: 7,
  face: 2,
  seed: 13873
});
}
