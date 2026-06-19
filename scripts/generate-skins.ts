
import * as fs from 'node:fs';
import * as path from 'node:path';

type Category = 'male' | 'female' | 'neutral';
type Style = 'cyber' | 'fantasy' | 'pastel';

interface SkinSource {
  style: Style;
  category: Category;
  name: string;
}

const GROUPS: Array<{ style: Style; category: Category; names: string[] }> = [
  { style: 'cyber', category: 'female', names: ['Neon Hacker Girl','Chrome Samurai Woman','Cyber Angel','Neon Street Runner','Cyber Witch','Glitch Girl','Cyber Priestess','Neon Neko','Cyber Assassin','Digital Diva','Cyber Medic','Neon Biker','Cyber Queen','Pixel Punk Girl','Cyber Fairy'] },
  { style: 'cyber', category: 'male', names: ['Neon Samurai','Cyber Gladiator','Neon Street Punk','Cyber Knight','Digital Drifter','Cyber Detective','Neon Viking','Cyber Engineer','Neon Assassin','Cyber DJ','Cyber Marine','Neon Muscle Man','Cyber Pilot','Neon Thief','Cyber Overlord'] },
  { style: 'cyber', category: 'neutral', names: ['Neon Drone','Cyber Mannequin','Pixel Character','Neon Abstract','Cyber Skeleton','Neon Robot','Cyber Blob','Neon Ghost','Cyber Toy','Neon Sphere','Cyber Plant','Neon Cloud','Cyber Heart','Neon Star','Cyber Void'] },
  { style: 'fantasy', category: 'female', names: ['Elven Archer','Dragon Sorceress','Ice Queen','Forest Nymph','Vampire Countess','Fairy Princess','Pirate Captain','Shadow Priestess','Mermaid Queen','War Maiden','Sun Priestess','Moon Witch','Demon Huntress','Crystal Mage','Nature Goddess'] },
  { style: 'fantasy', category: 'male', names: ['Dragon Knight','Dark Mage','Elven Warrior','Holy Paladin','Viking Berserker','Shadow Rogue','Wizard Elder','Beast Tamer','Necromancer','Sun Knight','Frost Giant','Demon Lord','Forest Guardian','Sky Pirate','Arcane Scholar'] },
  { style: 'fantasy', category: 'neutral', names: ['Spirit Elemental','Crystal Golem','Ancient Automaton','Forest Spirit','Shadow Wraith','Crystal Fairy','Stone Guardian','Flame Elemental','Frost Spirit','Wind Djinn','Earth Titan','Shadow Cat','Light Orb','Void Walker','Nature Sprite'] },
  { style: 'pastel', category: 'female', names: ['Cotton Candy Girl','Lavender Dreamer','Mint Chocolate','Peach Blossom','Sky Blue Angel','Lemon Drop','Cotton Field','Berry Smoothie','Cherry Blossom','Vanilla Cloud','Strawberry Milk','Sea Foam','Cotton Flower','Lilac Breeze','Honey Bee'] },
  { style: 'pastel', category: 'male', names: ['Cotton Candy Boy','Lavender Gentleman','Mint Fresh','Peach Sunrise','Sky Dreamer','Lemon Zest','Cotton Gentle','Berry Boy','Cherry Blossom Boy','Vanilla Boy','Strawberry Gentle','Sea Breeze','Cotton Field Boy','Lilac Boy','Honey Boy'] },
  { style: 'pastel', category: 'neutral', names: ['Cotton Cloud','Lavender Mist','Mint Dew','Peach Glow','Sky Haze','Lemon Sorbet','Cotton Fluff','Berry Sorbet','Cherry Puff','Vanilla Swirl','Strawberry Swirl','Sea Mist','Cotton Puff','Lilac Puff','Honey Comb'] },
];

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, 'build', 'skins');
const presetsPath = path.join(projectRoot, 'src', 'renderer', 'data', 'skin-presets.ts');

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function findSkinDir(): string {
  const bundled = path.join(projectRoot, 'resources', 'skins');
  const bundledCount = fs.existsSync(bundled)
    ? fs.readdirSync(bundled).filter((f) => f.toLowerCase().endsWith('.png')).length
    : 0;
  if (bundledCount >= 135) return bundled;

  const blocked = new Set(['build', 'scripts', 'src', 'dist', 'dist-electron', 'release', 'node_modules', 'chat_history', 'resources', '.git']);
  const candidates: Array<{ dir: string; count: number; mtime: number }> = [];
  for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || blocked.has(entry.name) || entry.name.startsWith('_')) continue;
    const dir = path.join(projectRoot, entry.name);
    try {
      const pngs = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).length;
      if (pngs > 0) candidates.push({ dir, count: pngs, mtime: fs.statSync(dir).mtimeMs });
    } catch {}
  }
  const exact = candidates.filter((c) => c.count >= 135).sort((a, b) => b.count - a.count || b.mtime - a.mtime)[0];
  if (!exact) throw new Error('Skin folder with at least 135 PNG files was not found. Expected resources/skins.');
  return exact.dir;
}

function readPngSize(file: string): { width: number; height: number } {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') throw new Error('Not a PNG file');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function presetSource(presets: any[]): string {
  return `export interface SkinPreset {
  id: string;
  name: string;
  category: 'male' | 'female' | 'neutral';
  description: string;
  model: 'classic' | 'slim';
  style: 'cyber' | 'fantasy' | 'pastel';
  dataUrl: string;
}

export const SKIN_PRESETS: SkinPreset[] = ${JSON.stringify(presets, null, 2)};
`;
}

const skins: SkinSource[] = GROUPS.flatMap((g) => g.names.map((name) => ({ style: g.style, category: g.category, name })));
if (skins.length !== 135) throw new Error(`Expected 135 skin definitions, got ${skins.length}`);

const sourceDir = findSkinDir();
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const sourceFiles = fs.readdirSync(sourceDir).filter((f) => f.toLowerCase().endsWith('.png'));
const sourceBySlug = new Map<string, string>();
for (const f of sourceFiles) {
  const withoutExt = f.replace(/\.png$/i, '');
  const withoutNum = withoutExt.replace(/^\d+[_-]/, '');
  const fullSlug = slug(withoutNum);
  sourceBySlug.set(fullSlug, path.join(sourceDir, f));
  for (const style of ['cyber', 'fantasy', 'pastel'] as const) {
    for (const category of ['female', 'male', 'neutral'] as const) {
      const prefix = `${style}-${category}-`;
      if (fullSlug.startsWith(prefix)) sourceBySlug.set(fullSlug.slice(prefix.length), path.join(sourceDir, f));
    }
  }
}

const presets: any[] = [];
const missing: string[] = [];
for (const skin of skins) {
  const nameSlug = slug(skin.name);
  const src = sourceBySlug.get(nameSlug);
  if (!src) { missing.push(skin.name); continue; }
  const size = readPngSize(src);
  if (!((size.width === 64 && size.height === 64) || (size.width === 64 && size.height === 32))) {
    throw new Error(`${skin.name}: expected 64x64 or 64x32 Minecraft skin PNG, got ${size.width}x${size.height}`);
  }
  const id = `${skin.style}-${skin.category}-${nameSlug}`;
  const fileName = `${id}.png`;
  const dest = path.join(outDir, fileName);
  fs.copyFileSync(src, dest);
  const png = fs.readFileSync(dest);
  presets.push({
    id,
    name: skin.name,
    category: skin.category,
    description: `${skin.name}: ${skin.style} ${skin.category} imported from custom skin folder`,
    model: skin.category === 'female' ? 'slim' : 'classic',
    style: skin.style,
    dataUrl: 'data:image/png;base64,' + png.toString('base64'),
  });
}

if (missing.length > 0) throw new Error(`Missing ${missing.length} skin PNG files: ${missing.join(', ')}`);
if (presets.length !== 135) throw new Error(`Expected 135 presets, got ${presets.length}`);

fs.writeFileSync(presetsPath, presetSource(presets), 'utf8');
console.log(`Imported ${presets.length} custom skins from ${sourceDir}`);
console.log('Distribution: 3 styles x 3 genders x 15 skins');
