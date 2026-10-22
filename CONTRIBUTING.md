# Contributing to Trel

Thanks for wanting to help. Trel is a Minecraft launcher, and every contribution
matters: a bug report, a new translation, support for a new mod loader, a UI improvement.

## Quick start

```bash
git clone https://github.com/Griln/Trel.git
cd Trel
npm ci
npm run dev        # Vite and Electron in development mode
```

## What to run before submitting

```bash
npm test           # tests (vitest)
npx tsc --noEmit   # type checking
npm run build      # build the UI and the main process
```

If something fails to build — paste the output into the pull request description, this
speeds up the review a lot.

## Structure

| Path | What's inside |
|------|---------------|
| `src/main/` | Electron main process: file system, game launch, auto-update, TrelEmu |
| `src/preload/` | Bridge between processes via `contextBridge` |
| `src/renderer/` | React UI: pages, components, styles, translations |
| `src/shared/` | Shared types and constants for both processes |
| `resources/` | Static assets: skins, legacy version data, Android tooling |
| `scripts/` | Build: icon, rpm package, emulator package, publishing |
| `previews/` | HTML mockups of the UI (design concepts) |

## Code style

- Commits — in English, in Conventional Commits style: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- One commit — one logical change
- Variable, function, and file names — in English
- Code comments are written in English; keep file names, field names, and commands as they are
- User interface — in Russian and English at the same time
  (see `src/renderer/i18n/`)

## Interface translations

Added a new string to the UI? Add it to both files:

```
src/renderer/i18n/ru.ts
src/renderer/i18n/en.ts
```

The key sets must match one to one — this is checked by the test
`src/renderer/i18n.test.ts`. The English file must not contain Russian words: if there is
no translation, leave the key with an empty value instead of Russian text.

## Security

Any download from an external server must go over `https` and be verified against a hash,
if the hash is known. Don't disable integrity checks and don't add `eval`-like
constructs. See [SECURITY.md](SECURITY.md) for details.

## Pull request

1. Create a branch off `main`: `git checkout -b feat/my-thing`
2. Make your changes and push
3. Open a pull request, describe **what** changed and **why**
4. Wait for the green CI build

Don't pull generated artifacts into the request: `dist/`, `release/`, `node_modules/`,
`build-trel-emu-cache/` — they are listed in `.gitignore` and must not end up
in the repository.

## Releases

Releases are published automatically from CI when you push a tag:

```bash
# the version number in the tag must match the version field in package.json
git tag vX.Y.Z
git push origin vX.Y.Z
```

The build will produce files for Windows and Linux and attach them to the release.
See [RELEASING.md](RELEASING.md) for details.

## Code of conduct

Taking part in the project implies agreement with the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
