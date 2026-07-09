import type { DrawSkin } from '../generate-skins';

// Skin 026: Cyber Moon Huntress
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Cyber Moon Huntress; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin026(draw: DrawSkin) {
  draw({
  id: "f-cyber-cyber-moon-huntress",
  name: "Cyber Moon Huntress",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
  skin: [
    214,
    220,
    238,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    8,
    28,
    38,
    255
  ],
  accent: [
    0,
    240,
    255,
    255
  ],
  second: [
    255,
    80,
    80,
    255
  ],
  outfit: 6,
  hairStyle: 11,
  accessory: 7,
  motif: 11,
  face: 2,
  seed: 4480
});
}
