import type { DrawSkin } from '../generate-skins';

// Skin 012: Orbit Steel Scout
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Orbit Steel Scout; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin012(draw: DrawSkin) {
  draw({
  id: "m-cyber-orbit-steel-scout",
  name: "Orbit Steel Scout",
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
    52,
    52,
    70,
    255
  ],
  base: [
    45,
    45,
    52,
    255
  ],
  accent: [
    90,
    255,
    105,
    255
  ],
  second: [
    255,
    80,
    80,
    255
  ],
  outfit: 3,
  hairStyle: 10,
  accessory: 8,
  motif: 14,
  face: 0,
  seed: 2315
});
}
