import type { DrawSkin } from '../generate-skins';

// Skin 021: Silver Proxy Pilot
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Silver Proxy Pilot; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin021(draw: DrawSkin) {
  draw({
  id: "f-cyber-silver-proxy-pilot",
  name: "Silver Proxy Pilot",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    18,
    34,
    62,
    255
  ],
  accent: [
    170,
    95,
    255,
    255
  ],
  second: [
    80,
    160,
    255,
    255
  ],
  outfit: 1,
  hairStyle: 8,
  accessory: 6,
  motif: 8,
  face: 3,
  seed: 3704
});
}
