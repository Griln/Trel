import type { DrawSkin } from '../generate-skins';

// Skin 006: Graphite Circuit Guard
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Graphite Circuit Guard; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin006(draw: DrawSkin) {
  draw({
  id: "m-cyber-graphite-circuit-guard",
  name: "Graphite Circuit Guard",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    8,
    28,
    38,
    255
  ],
  accent: [
    255,
    175,
    40,
    255
  ],
  second: [
    255,
    55,
    190,
    255
  ],
  outfit: 6,
  hairStyle: 4,
  accessory: 2,
  motif: 4,
  face: 0,
  seed: 1576
});
}
