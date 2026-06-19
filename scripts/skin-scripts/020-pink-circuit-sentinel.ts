import type { DrawSkin } from '../generate-skins';

// Skin 020: Pink Circuit Sentinel
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Pink Circuit Sentinel; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin020(draw: DrawSkin) {
  draw({
  id: "f-cyber-pink-circuit-sentinel",
  name: "Pink Circuit Sentinel",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    238,
    210,
    165,
    255
  ],
  base: [
    10,
    16,
    32,
    255
  ],
  accent: [
    255,
    55,
    190,
    255
  ],
  second: [
    255,
    55,
    190,
    255
  ],
  outfit: 0,
  hairStyle: 5,
  accessory: 1,
  motif: 1,
  face: 2,
  seed: 3648
});
}
