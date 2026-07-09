import type { DrawSkin } from '../generate-skins';

// Skin 053: Amber Oak Monk
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Amber Oak Monk; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin053(draw: DrawSkin) {
  draw({
  id: "m-fantasy-amber-oak-monk",
  name: "Amber Oak Monk",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    126,
    83,
    58,
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
    230,
    86,
    78,
    255
  ],
  second: [
    80,
    220,
    120,
    255
  ],
  outfit: 2,
  hairStyle: 1,
  accessory: 3,
  motif: 5,
  face: 2,
  seed: 8382
});
}
