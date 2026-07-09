import type { DrawSkin } from '../generate-skins';

// Skin 004: Laser Noir Hacker
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Laser Noir Hacker; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin004(draw: DrawSkin) {
  draw({
  id: "m-cyber-laser-noir-hacker",
  name: "Laser Noir Hacker",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    45,
    45,
    52,
    255
  ],
  accent: [
    255,
    80,
    80,
    255
  ],
  second: [
    255,
    175,
    40,
    255
  ],
  outfit: 4,
  hairStyle: 10,
  accessory: 4,
  motif: 6,
  face: 4,
  seed: 1123
});
}
