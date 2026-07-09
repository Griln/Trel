import type { DrawSkin } from '../generate-skins';

// Skin 008: Turbo Night Mechanic
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Turbo Night Mechanic; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin008(draw: DrawSkin) {
  draw({
  id: "m-cyber-turbo-night-mechanic",
  name: "Turbo Night Mechanic",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    246,
    219,
    190,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    10,
    16,
    32,
    255
  ],
  accent: [
    0,
    240,
    255,
    255
  ],
  second: [
    90,
    255,
    105,
    255
  ],
  outfit: 8,
  hairStyle: 10,
  accessory: 0,
  motif: 2,
  face: 2,
  seed: 1812
});
}
