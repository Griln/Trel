import type { DrawSkin } from '../generate-skins';

// Skin 015: Plasma Rain Broker
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Plasma Rain Broker; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin015(draw: DrawSkin) {
  draw({
  id: "m-cyber-plasma-rain-broker",
  name: "Plasma Rain Broker",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    220,
    230,
    245,
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
    90,
    255,
    105,
    255
  ],
  outfit: 6,
  hairStyle: 7,
  accessory: 11,
  motif: 3,
  face: 3,
  seed: 2793
});
}
