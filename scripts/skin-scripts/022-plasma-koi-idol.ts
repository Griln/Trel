import type { DrawSkin } from '../generate-skins';

// Skin 022: Plasma Koi Idol
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Plasma Koi Idol; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin022(draw: DrawSkin) {
  draw({
  id: "f-cyber-plasma-koi-idol",
  name: "Plasma Koi Idol",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
  skin: [
    246,
    219,
    190,
    255
  ],
  hair: [
    190,
    70,
    85,
    255
  ],
  base: [
    30,
    24,
    58,
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
  outfit: 2,
  hairStyle: 11,
  accessory: 11,
  motif: 15,
  face: 4,
  seed: 3760
});
}
