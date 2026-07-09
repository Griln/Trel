import type { DrawSkin } from '../generate-skins';

// Skin 039: Prism Null Scout
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Prism Null Scout; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin039(draw: DrawSkin) {
  draw({
  id: "n-cyber-prism-null-scout",
  name: "Prism Null Scout",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    52,
    26,
    60,
    255
  ],
  accent: [
    170,
    95,
    255,
    255
  ],
  second: [
    255,
    175,
    40,
    255
  ],
  outfit: 8,
  hairStyle: 9,
  accessory: 1,
  motif: 1,
  face: 3,
  seed: 6341
});
}
