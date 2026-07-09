import type { DrawSkin } from '../generate-skins';

// Skin 105: Coconut Pixel Chef
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Coconut Pixel Chef; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin105(draw: DrawSkin) {
  draw({
  id: "m-pastel-coconut-pixel-chef",
  name: "Coconut Pixel Chef",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    214,
    220,
    238,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    255,
    226,
    210,
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
  outfit: 3,
  hairStyle: 1,
  accessory: 5,
  motif: 9,
  face: 3,
  seed: 16305
});
}
