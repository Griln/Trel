import type { DrawSkin } from '../generate-skins';

// Skin 092: Mint Bubble Skater
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Mint Bubble Skater; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin092(draw: DrawSkin) {
  draw({
  id: "m-pastel-mint-bubble-skater",
  name: "Mint Bubble Skater",
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
    220,
    230,
    245,
    255
  ],
  base: [
    255,
    220,
    235,
    255
  ],
  accent: [
    150,
    230,
    255,
    255
  ],
  second: [
    210,
    175,
    255,
    255
  ],
  outfit: 8,
  hairStyle: 10,
  accessory: 0,
  motif: 14,
  face: 2,
  seed: 14368
});
}
