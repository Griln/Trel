import type { DrawSkin } from '../generate-skins';

// Skin 099: Orchid Dream Poet
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Orchid Dream Poet; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin099(draw: DrawSkin) {
  draw({
  id: "m-pastel-orchid-dream-poet",
  name: "Orchid Dream Poet",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    40,
    170,
    160,
    255
  ],
  base: [
    210,
    250,
    232,
    255
  ],
  accent: [
    150,
    230,
    255,
    255
  ],
  second: [
    210,
    175,
    255,
    255
  ],
  outfit: 6,
  hairStyle: 7,
  accessory: 11,
  motif: 15,
  face: 3,
  seed: 15380
});
}
