import type { DrawSkin } from '../generate-skins';

// Skin 102: Honey Milk Ranger
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Honey Milk Ranger; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin102(draw: DrawSkin) {
  draw({
  id: "m-pastel-honey-milk-ranger",
  name: "Honey Milk Ranger",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    224,
    181,
    145,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    210,
    235,
    255,
    255
  ],
  accent: [
    255,
    145,
    205,
    255
  ],
  second: [
    175,
    210,
    255,
    255
  ],
  outfit: 0,
  hairStyle: 4,
  accessory: 2,
  motif: 4,
  face: 0,
  seed: 15827
});
}
