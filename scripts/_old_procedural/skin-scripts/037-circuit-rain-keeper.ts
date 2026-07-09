import type { DrawSkin } from '../generate-skins';

// Skin 037: Circuit Rain Keeper
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Circuit Rain Keeper; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin037(draw: DrawSkin) {
  draw({
  id: "n-cyber-circuit-rain-keeper",
  name: "Circuit Rain Keeper",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    224,
    181,
    145,
    255
  ],
  hair: [
    86,
    55,
    35,
    255
  ],
  base: [
    22,
    22,
    38,
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
  outfit: 6,
  hairStyle: 3,
  accessory: 3,
  motif: 3,
  face: 1,
  seed: 6136
});
}
