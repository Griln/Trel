import type { DrawSkin } from '../generate-skins';

// Skin 093: Peach Cocoa Pilot
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Peach Cocoa Pilot; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin093(draw: DrawSkin) {
  draw({
  id: "m-pastel-peach-cocoa-pilot",
  name: "Peach Cocoa Pilot",
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
    112,
    52,
    140,
    255
  ],
  base: [
    250,
    235,
    195,
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
  outfit: 0,
  hairStyle: 1,
  accessory: 5,
  motif: 5,
  face: 3,
  seed: 14486
});
}
