import type { DrawSkin } from '../generate-skins';

// Skin 017: Violet Neon Oracle
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Violet Neon Oracle; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin017(draw: DrawSkin) {
  draw({
  id: "f-cyber-violet-neon-oracle",
  name: "Violet Neon Oracle",
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
    86,
    55,
    35,
    255
  ],
  base: [
    22,
    22,
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
    0,
    240,
    255,
    255
  ],
  outfit: 6,
  hairStyle: 8,
  accessory: 10,
  motif: 12,
  face: 5,
  seed: 3108
});
}
