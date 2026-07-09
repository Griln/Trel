import type { DrawSkin } from '../generate-skins';

// Skin 103: Pudding Star Student
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Pudding Star Student; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin103(draw: DrawSkin) {
  draw({
  id: "m-pastel-pudding-star-student",
  name: "Pudding Star Student",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    40,
    170,
    160,
    255
  ],
  base: [
    240,
    226,
    210,
    255
  ],
  accent: [
    255,
    235,
    145,
    255
  ],
  second: [
    255,
    235,
    145,
    255
  ],
  outfit: 1,
  hairStyle: 7,
  accessory: 7,
  motif: 11,
  face: 1,
  seed: 16069
});
}
