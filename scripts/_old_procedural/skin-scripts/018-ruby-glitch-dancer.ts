import type { DrawSkin } from '../generate-skins';

// Skin 018: Ruby Glitch Dancer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ruby Glitch Dancer; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin018(draw: DrawSkin) {
  draw({
  id: "f-cyber-ruby-glitch-dancer",
  name: "Ruby Glitch Dancer",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    235,
    120,
    190,
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
    255,
    175,
    40,
    255
  ],
  outfit: 7,
  hairStyle: 11,
  accessory: 3,
  motif: 3,
  face: 0,
  seed: 3257
});
}
