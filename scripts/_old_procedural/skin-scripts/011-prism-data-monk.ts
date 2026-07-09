import type { DrawSkin } from '../generate-skins';

// Skin 011: Prism Data Monk
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Prism Data Monk; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin011(draw: DrawSkin) {
  draw({
  id: "m-cyber-prism-data-monk",
  name: "Prism Data Monk",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    220,
    230,
    245,
    255
  ],
  base: [
    18,
    48,
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
    255,
    175,
    40,
    255
  ],
  outfit: 2,
  hairStyle: 7,
  accessory: 3,
  motif: 7,
  face: 5,
  seed: 2104
});
}
