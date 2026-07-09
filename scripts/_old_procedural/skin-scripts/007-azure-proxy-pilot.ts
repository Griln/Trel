import type { DrawSkin } from '../generate-skins';

// Skin 007: Azure Proxy Pilot
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Azure Proxy Pilot; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin007(draw: DrawSkin) {
  draw({
  id: "m-cyber-azure-proxy-pilot",
  name: "Azure Proxy Pilot",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    238,
    210,
    165,
    255
  ],
  base: [
    52,
    26,
    60,
    255
  ],
  accent: [
    80,
    160,
    255,
    255
  ],
  second: [
    80,
    160,
    255,
    255
  ],
  outfit: 7,
  hairStyle: 7,
  accessory: 7,
  motif: 11,
  face: 1,
  seed: 1570
});
}
