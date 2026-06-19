import type { DrawSkin } from '../generate-skins';

// Skin 028: Quantum Rose Agent
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Quantum Rose Agent; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin028(draw: DrawSkin) {
  draw({
  id: "f-cyber-quantum-rose-agent",
  name: "Quantum Rose Agent",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
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
    10,
    16,
    32,
    255
  ],
  accent: [
    170,
    95,
    255,
    255
  ],
  second: [
    80,
    160,
    255,
    255
  ],
  outfit: 8,
  hairStyle: 5,
  accessory: 5,
  motif: 9,
  face: 4,
  seed: 4747
});
}
