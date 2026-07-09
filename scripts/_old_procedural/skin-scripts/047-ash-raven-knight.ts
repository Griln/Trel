import type { DrawSkin } from '../generate-skins';

// Skin 047: Ash Raven Knight
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ash Raven Knight; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin047(draw: DrawSkin) {
  draw({
  id: "m-fantasy-ash-raven-knight",
  name: "Ash Raven Knight",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    154,
    96,
    64,
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
    255,
    170,
    90,
    255
  ],
  second: [
    205,
    160,
    255,
    255
  ],
  outfit: 5,
  hairStyle: 7,
  accessory: 9,
  motif: 11,
  face: 2,
  seed: 7550
});
}
