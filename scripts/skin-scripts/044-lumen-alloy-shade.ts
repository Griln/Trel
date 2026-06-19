import type { DrawSkin } from '../generate-skins';

// Skin 044: Lumen Alloy Shade
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Lumen Alloy Shade; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin044(draw: DrawSkin) {
  draw({
  id: "n-cyber-lumen-alloy-shade",
  name: "Lumen Alloy Shade",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    45,
    45,
    52,
    255
  ],
  accent: [
    0,
    240,
    255,
    255
  ],
  second: [
    170,
    95,
    255,
    255
  ],
  outfit: 4,
  hairStyle: 0,
  accessory: 2,
  motif: 4,
  face: 2,
  seed: 7117
});
}
