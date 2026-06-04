import { describeVersion } from '../src/renderer/data/versions';
import axios from 'axios';

async function main() {
  const { data } = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
  const versions = data.versions as Array<{ id: string; type: string; releaseTime: string; url: string }>;

  const missing: string[] = [];
  const dupes = new Map<string, string[]>();
  for (const v of versions) {
    const t = describeVersion(v as any);
    if (t === `Minecraft ${v.id}.`) missing.push(`${v.type}\t${v.id}`);
    if (!dupes.has(t)) dupes.set(t, []);
    dupes.get(t)!.push(v.id);
  }

  console.log('Всего версий:', versions.length);
  console.log('Без ручного описания:', missing.length);
  console.log('Групп точных дубликатов:', [...dupes.values()].filter(a => a.length > 1).length);

  if (missing.length > 0) {
    console.log('\nID без описаний:');
    for (const m of missing) console.log('  ' + m);
  }

  const dupList = [...dupes.entries()].filter(([, a]) => a.length > 1);
  if (dupList.length > 0) {
    console.log('\nДубликаты:');
    for (const [t, ids] of dupList.slice(0, 40)) {
      console.log('  ' + t);
      console.log('    ->', ids.join(', '));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
