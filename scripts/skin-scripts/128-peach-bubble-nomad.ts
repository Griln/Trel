import type { DrawSkin } from '../generate-skins';

// Skin 128: Peach Bubble Nomad
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Peach Bubble Nomad; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin128(draw: DrawSkin) {
  draw({
  id: "n-pastel-peach-bubble-nomad",
  name: "Peach Bubble Nomad",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    112,
    52,
    140,
    255
  ],
  base: [
    228,
    246,
    255,
    255
  ],
  accent: [
    150,
    230,
    255,
    255
  ],
  second: [
    255,
    145,
    205,
    255
  ],
  outfit: 4,
  hairStyle: 0,
  accessory: 2,
  motif: 0,
  face: 2,
  seed: 19766
});
}
