import type { DrawSkin } from '../generate-skins';

// Skin 027: Neon Rain Sysop
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Neon Rain Sysop; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin027(draw: DrawSkin) {
  draw({
  id: "f-cyber-neon-rain-sysop",
  name: "Neon Rain Sysop",
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
    40,
    170,
    160,
    255
  ],
  base: [
    52,
    26,
    60,
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
  outfit: 7,
  hairStyle: 2,
  accessory: 0,
  motif: 2,
  face: 3,
  seed: 4505
});
}
