import type { DrawSkin } from '../generate-skins';

// Skin 100: Bubble Moon Cadet
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Bubble Moon Cadet; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin100(draw: DrawSkin) {
  draw({
  id: "m-pastel-bubble-moon-cadet",
  name: "Bubble Moon Cadet",
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
    52,
    52,
    70,
    255
  ],
  base: [
    255,
    220,
    235,
    255
  ],
  accent: [
    180,
    250,
    205,
    255
  ],
  second: [
    255,
    145,
    205,
    255
  ],
  outfit: 7,
  hairStyle: 10,
  accessory: 4,
  motif: 6,
  face: 4,
  seed: 15529
});
}
