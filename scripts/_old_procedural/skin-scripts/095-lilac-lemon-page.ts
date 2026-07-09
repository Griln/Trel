import type { DrawSkin } from '../generate-skins';

// Skin 095: Lilac Lemon Page
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Lilac Lemon Page; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin095(draw: DrawSkin) {
  draw({
  id: "m-pastel-lilac-lemon-page",
  name: "Lilac Lemon Page",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    240,
    226,
    210,
    255
  ],
  accent: [
    255,
    145,
    205,
    255
  ],
  second: [
    175,
    210,
    255,
    255
  ],
  outfit: 2,
  hairStyle: 7,
  accessory: 3,
  motif: 3,
  face: 5,
  seed: 14753
});
}
