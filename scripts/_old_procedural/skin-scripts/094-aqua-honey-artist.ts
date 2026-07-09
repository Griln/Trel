import type { DrawSkin } from '../generate-skins';

// Skin 094: Aqua Honey Artist
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Aqua Honey Artist; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin094(draw: DrawSkin) {
  draw({
  id: "m-pastel-aqua-honey-artist",
  name: "Aqua Honey Artist",
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
    190,
    70,
    85,
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
    185,
    150,
    255
  ],
  second: [
    180,
    250,
    205,
    255
  ],
  outfit: 1,
  hairStyle: 4,
  accessory: 10,
  motif: 12,
  face: 4,
  seed: 14635
});
}
