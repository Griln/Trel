import type { DrawSkin } from '../generate-skins';

// Skin 010: Cyber Wolf Operator
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Cyber Wolf Operator; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin010(draw: DrawSkin) {
  draw({
  id: "m-cyber-cyber-wolf-operator",
  name: "Cyber Wolf Operator",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    40,
    170,
    160,
    255
  ],
  base: [
    30,
    24,
    58,
    255
  ],
  accent: [
    170,
    95,
    255,
    255
  ],
  second: [
    0,
    240,
    255,
    255
  ],
  outfit: 1,
  hairStyle: 4,
  accessory: 10,
  motif: 0,
  face: 4,
  seed: 2079
});
}
