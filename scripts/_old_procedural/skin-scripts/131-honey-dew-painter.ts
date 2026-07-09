import type { DrawSkin } from '../generate-skins';

// Skin 131: Honey Dew Painter
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Honey Dew Painter; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin131(draw: DrawSkin) {
  draw({
  id: "n-pastel-honey-dew-painter",
  name: "Honey Dew Painter",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    38,
    27,
    28,
    255
  ],
  base: [
    210,
    250,
    232,
    255
  ],
  accent: [
    255,
    145,
    205,
    255
  ],
  second: [
    255,
    235,
    145,
    255
  ],
  outfit: 7,
  hairStyle: 9,
  accessory: 5,
  motif: 5,
  face: 5,
  seed: 20182
});
}
