const fs = require('fs');

const lockPath = 'package-lock.json';
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));

// Keep only these esbuild platforms (windows + linux for CI)
const keepPlatforms = ['win32-x64', 'linux-x64', 'linux-arm64'];

let removed = 0;

// Clean all optionalDependencies inside any esbuild package entry
for (const key of Object.keys(lock.packages || {})) {
  if (key.includes('/esbuild') && !key.includes('@esbuild/')) {
    const pkg = lock.packages[key];
    if (pkg.optionalDependencies) {
      for (const depKey of Object.keys(pkg.optionalDependencies)) {
        if (depKey.startsWith('@esbuild/')) {
          const platform = depKey.slice('@esbuild/'.length);
          if (!keepPlatforms.includes(platform)) {
            delete pkg.optionalDependencies[depKey];
            removed++;
          }
        }
      }
    }
  }
  // Remove platform packages themselves
  if (key.includes('/@esbuild/')) {
    const parts = key.split('/');
    const platform = parts[parts.length - 1];
    if (!keepPlatforms.includes(platform)) {
      delete lock.packages[key];
      removed++;
    }
  }
}

// Clean dependencies section
for (const key of Object.keys(lock.dependencies || {})) {
  if (key.startsWith('@esbuild/')) {
    const platform = key.slice('@esbuild/'.length);
    if (!keepPlatforms.includes(platform)) {
      delete lock.dependencies[key];
      removed++;
    }
  }
  if (key.includes('esbuild') && !key.includes('@esbuild/') && lock.dependencies[key]?.optionalDependencies) {
    const optDeps = lock.dependencies[key].optionalDependencies;
    for (const depKey of Object.keys(optDeps)) {
      if (depKey.startsWith('@esbuild/')) {
        const platform = depKey.slice('@esbuild/'.length);
        if (!keepPlatforms.includes(platform)) {
          delete optDeps[depKey];
          removed++;
        }
      }
    }
  }
}

fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));
console.log(`Cleaned ${removed} esbuild platform packages from lock file`);
