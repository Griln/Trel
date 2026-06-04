import axios from 'axios';
import * as fs from 'node:fs';

async function main() {
  const { data } = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
  const versions = data.versions as Array<{ id: string; type: string; releaseTime: string }>;
  const lines = versions.map(v => `${v.type}\t${v.id}\t${v.releaseTime.slice(0,10)}`);
  fs.writeFileSync('scripts/all-versions.txt', lines.join('\n'), 'utf-8');
  console.log('Saved', versions.length, 'versions');
  // Print summary by type
  const byType: Record<string, number> = {};
  for (const v of versions) byType[v.type] = (byType[v.type] || 0) + 1;
  console.log(byType);
}
main();
