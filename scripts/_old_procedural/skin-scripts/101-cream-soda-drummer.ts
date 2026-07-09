import type { DrawSkin } from '../generate-skins';

// Skin 101: Cream Soda Drummer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Cream Soda Drummer; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin101(draw: DrawSkin) {
  draw({
  id: "m-pastel-cream-soda-drummer",
  name: "Cream Soda Drummer",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    246,
    219,
    190,
    255
  ],
  hair: [
    86,
    55,
    35,
    255
  ],
  base: [
    250,
    235,
    195,
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
  outfit: 8,
  hairStyle: 1,
  accessory: 9,
  motif: 13,
  face: 5,
  seed: 15709
});
}
