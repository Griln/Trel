import type { DrawSkin } from '../generate-skins';

// Skin 014: Echo Grid Ranger
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Echo Grid Ranger; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin014(draw: DrawSkin) {
  draw({
  id: "m-cyber-echo-grid-ranger",
  name: "Echo Grid Ranger",
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
    86,
    55,
    35,
    255
  ],
  base: [
    8,
    28,
    38,
    255
  ],
  accent: [
    80,
    160,
    255,
    255
  ],
  second: [
    80,
    160,
    255,
    255
  ],
  outfit: 5,
  hairStyle: 4,
  accessory: 6,
  motif: 12,
  face: 2,
  seed: 2582
});
}
