import type { DrawSkin } from '../generate-skins';

// Skin 030: Velvet Grid Runner
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Velvet Grid Runner; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin030(draw: DrawSkin) {
  draw({
  id: "f-cyber-velvet-grid-runner",
  name: "Velvet Grid Runner",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    220,
    230,
    245,
    255
  ],
  base: [
    30,
    24,
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
  outfit: 1,
  hairStyle: 11,
  accessory: 3,
  motif: 7,
  face: 0,
  seed: 5045
});
}
