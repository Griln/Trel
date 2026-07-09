import type { DrawSkin } from '../generate-skins';

// Skin 054: Gilded Griffin Sage
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Gilded Griffin Sage; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin054(draw: DrawSkin) {
  draw({
  id: "m-fantasy-gilded-griffin-sage",
  name: "Gilded Griffin Sage",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    214,
    220,
    238,
    255
  ],
  hair: [
    40,
    170,
    160,
    255
  ],
  base: [
    54,
    112,
    62,
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
  outfit: 3,
  hairStyle: 4,
  accessory: 8,
  motif: 12,
  face: 3,
  seed: 8686
});
}
