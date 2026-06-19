import type { DrawSkin } from '../generate-skins';

// Skin 001: Neon Rift Captain
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Neon Rift Captain; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin001(draw: DrawSkin) {
  draw({
  id: "m-cyber-neon-rift-captain",
  name: "Neon Rift Captain",
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
    52,
    52,
    70,
    255
  ],
  base: [
    18,
    34,
    62,
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
  outfit: 1,
  hairStyle: 1,
  accessory: 1,
  motif: 1,
  face: 1,
  seed: 676
});
}
