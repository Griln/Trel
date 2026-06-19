import type { DrawSkin } from '../generate-skins';

// Skin 023: Echo Chrome Ninja
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Echo Chrome Ninja; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin023(draw: DrawSkin) {
  draw({
  id: "f-cyber-echo-chrome-ninja",
  name: "Echo Chrome Ninja",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
  skin: [
    224,
    181,
    145,
    255
  ],
  hair: [
    86,
    55,
    35,
    255
  ],
  base: [
    18,
    48,
    58,
    255
  ],
  accent: [
    90,
    255,
    105,
    255
  ],
  second: [
    170,
    95,
    255,
    255
  ],
  outfit: 3,
  hairStyle: 2,
  accessory: 4,
  motif: 6,
  face: 5,
  seed: 3971
});
}
