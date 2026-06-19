import type { DrawSkin } from '../generate-skins';

// Skin 036: Data Lotus Ghost
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Data Lotus Ghost; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin036(draw: DrawSkin) {
  draw({
  id: "n-cyber-data-lotus-ghost",
  name: "Data Lotus Ghost",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    246,
    219,
    190,
    255
  ],
  hair: [
    40,
    170,
    160,
    255
  ],
  base: [
    45,
    45,
    52,
    255
  ],
  accent: [
    80,
    160,
    255,
    255
  ],
  second: [
    90,
    255,
    105,
    255
  ],
  outfit: 5,
  hairStyle: 0,
  accessory: 10,
  motif: 12,
  face: 0,
  seed: 5894
});
}
