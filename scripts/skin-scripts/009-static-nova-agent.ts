import type { DrawSkin } from '../generate-skins';

// Skin 009: Static Nova Agent
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Static Nova Agent; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin009(draw: DrawSkin) {
  draw({
  id: "m-cyber-static-nova-agent",
  name: "Static Nova Agent",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    224,
    181,
    145,
    255
  ],
  hair: [
    235,
    120,
    190,
    255
  ],
  base: [
    18,
    34,
    62,
    255
  ],
  accent: [
    255,
    55,
    190,
    255
  ],
  second: [
    170,
    95,
    255,
    255
  ],
  outfit: 0,
  hairStyle: 1,
  accessory: 5,
  motif: 9,
  face: 3,
  seed: 1868
});
}
