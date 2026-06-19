import type { DrawSkin } from '../generate-skins';

// Skin 045: Cyber Comet Walker
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Cyber Comet Walker; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin045(draw: DrawSkin) {
  draw({
  id: "n-cyber-cyber-comet-walker",
  name: "Cyber Comet Walker",
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
    220,
    230,
    245,
    255
  ],
  base: [
    22,
    22,
    38,
    255
  ],
  accent: [
    255,
    55,
    190,
    255
  ],
  second: [
    0,
    240,
    255,
    255
  ],
  outfit: 5,
  hairStyle: 3,
  accessory: 7,
  motif: 11,
  face: 3,
  seed: 7297
});
}
