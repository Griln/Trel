import type { DrawSkin } from '../generate-skins';

// Skin 024: Ghost Pulse Medic
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ghost Pulse Medic; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin024(draw: DrawSkin) {
  draw({
  id: "f-cyber-ghost-pulse-medic",
  name: "Ghost Pulse Medic",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    235,
    120,
    190,
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
    175,
    40,
    255
  ],
  second: [
    0,
    240,
    255,
    255
  ],
  outfit: 4,
  hairStyle: 5,
  accessory: 9,
  motif: 13,
  face: 0,
  seed: 4120
});
}
