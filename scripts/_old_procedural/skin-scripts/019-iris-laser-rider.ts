import type { DrawSkin } from '../generate-skins';

// Skin 019: Iris Laser Rider
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Iris Laser Rider; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin019(draw: DrawSkin) {
  draw({
  id: "f-cyber-iris-laser-rider",
  name: "Iris Laser Rider",
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
    235,
    120,
    190,
    255
  ],
  base: [
    52,
    26,
    60,
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
  outfit: 8,
  hairStyle: 2,
  accessory: 8,
  motif: 10,
  face: 1,
  seed: 3344
});
}
