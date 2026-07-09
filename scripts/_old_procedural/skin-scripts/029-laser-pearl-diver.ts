import type { DrawSkin } from '../generate-skins';

// Skin 029: Laser Pearl Diver
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Laser Pearl Diver; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin029(draw: DrawSkin) {
  draw({
  id: "f-cyber-laser-pearl-diver",
  name: "Laser Pearl Diver",
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
    218,
    175,
    95,
    255
  ],
  base: [
    18,
    34,
    62,
    255
  ],
  accent: [
    255,
    80,
    80,
    255
  ],
  second: [
    90,
    255,
    105,
    255
  ],
  outfit: 0,
  hairStyle: 8,
  accessory: 10,
  motif: 0,
  face: 5,
  seed: 4865
});
}
