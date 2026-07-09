import type { DrawSkin } from '../generate-skins';

// Skin 098: Sky Candy Baker
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Sky Candy Baker; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin098(draw: DrawSkin) {
  draw({
  id: "m-pastel-sky-candy-baker",
  name: "Sky Candy Baker",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    154,
    96,
    64,
    255
  ],
  hair: [
    235,
    120,
    190,
    255
  ],
  base: [
    235,
    220,
    255,
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
  outfit: 5,
  hairStyle: 4,
  accessory: 6,
  motif: 8,
  face: 2,
  seed: 15169
});
}
