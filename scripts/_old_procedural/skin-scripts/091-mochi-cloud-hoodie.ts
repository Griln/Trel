import type { DrawSkin } from '../generate-skins';

// Skin 091: Mochi Cloud Hoodie
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Mochi Cloud Hoodie; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin091(draw: DrawSkin) {
  draw({
  id: "m-pastel-mochi-cloud-hoodie",
  name: "Mochi Cloud Hoodie",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    235,
    120,
    190,
    255
  ],
  base: [
    210,
    250,
    232,
    255
  ],
  accent: [
    175,
    210,
    255,
    255
  ],
  second: [
    150,
    230,
    255,
    255
  ],
  outfit: 7,
  hairStyle: 7,
  accessory: 7,
  motif: 7,
  face: 1,
  seed: 14219
});
}
