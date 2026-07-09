import type { DrawSkin } from '../generate-skins';

// Skin 052: Moonlit Tide Bard
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Moonlit Tide Bard; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin052(draw: DrawSkin) {
  draw({
  id: "m-fantasy-moonlit-tide-bard",
  name: "Moonlit Tide Bard",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    86,
    55,
    35,
    255
  ],
  base: [
    120,
    94,
    44,
    255
  ],
  accent: [
    80,
    220,
    120,
    255
  ],
  second: [
    255,
    170,
    90,
    255
  ],
  outfit: 1,
  hairStyle: 10,
  accessory: 10,
  motif: 14,
  face: 1,
  seed: 8326
});
}
