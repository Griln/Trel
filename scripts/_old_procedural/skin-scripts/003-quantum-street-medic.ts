import type { DrawSkin } from '../generate-skins';

// Skin 003: Quantum Street Medic
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Quantum Street Medic; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin003(draw: DrawSkin) {
  draw({
  id: "m-cyber-quantum-street-medic",
  name: "Quantum Street Medic",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    214,
    220,
    238,
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
  outfit: 3,
  hairStyle: 7,
  accessory: 11,
  motif: 15,
  face: 3,
  seed: 1067
});
}
