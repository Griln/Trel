import type { DrawSkin } from '../generate-skins';

// Skin 005: Ion Pulse Drifter
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ion Pulse Drifter; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin005(draw: DrawSkin) {
  draw({
  id: "m-cyber-ion-pulse-drifter",
  name: "Ion Pulse Drifter",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    154,
    96,
    64,
    255
  ],
  hair: [
    112,
    52,
    140,
    255
  ],
  base: [
    22,
    22,
    38,
    255
  ],
  accent: [
    90,
    255,
    105,
    255
  ],
  second: [
    255,
    80,
    80,
    255
  ],
  outfit: 5,
  hairStyle: 1,
  accessory: 9,
  motif: 13,
  face: 5,
  seed: 1272
});
}
