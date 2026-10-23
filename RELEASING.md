<p align="center">
  <strong>English</strong> | <a href="RELEASING.ru.md">Русский</a>
</p>

# Releasing

Releases are published automatically: push a tag and the CI build produces the
Windows and Linux files and attaches them to the release.

## How to release a version

1. Update the version in `package.json` (the `version` field).
2. Write the changes in `RELEASE_NOTES.md` — a separate section titled
   `# Trel vX.Y.Z`.
3. Commit and push to `main`.
4. Create and push a tag with the same version number:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

5. Wait for `.github/workflows/release.yml` to finish — it creates the release
   with the files and the text from `RELEASE_NOTES.md`.

## What the release CI does

`.github/workflows/release.yml` on pushing a `v*` tag:

- builds Windows: the NSIS installer and the portable build;
- builds Linux: AppImage, deb and rpm;
- takes the release description from the `RELEASE_NOTES.md` section matching
  the version;
- creates the release and attaches the files together with `latest.yml`,
  `latest-linux.yml` and the blockmap files.

You can also trigger the build manually: **Actions → Release → Run workflow**,
specifying the tag.

## What the regular CI builds

`.github/workflows/ci.yml` on every push to `main` and every pull request:

```bash
npm ci
npm run build:renderer
```

Plus type checking, tests, and a Windows and a Linux build.

## Version preparation

The version comes from `package.json`. Before releasing, make sure the number
matches in these places:

- `package.json` — the `version` field;
- `package-lock.json` — the root `version` entry;
- `src/main/modpacks.ts` — the `TrelLauncher/X.Y.Z` string.

Artifact names are generated from `${version}` automatically.

## Build notes

`@xmcl/core` is pinned to the exact version `2.15.1`: newer `@xmcl` packages
are published with dependencies such as `workspace:^*` and break `npm install`
without a lockfile.

Building the rpm requires `rpmbuild`; the version number is taken from
`package.json` as well.

## If you need to publish manually

Manual publishing is still needed sometimes — for example, for a mirror on
archive.org or when the CI build failed.

1. Check that `package.json` has the right repository in the `build.publish`
   field and that the remote repository matches it.
2. Build the artifacts locally:

```bash
npm run dist         # Windows: NSIS installer + portable build
npm run dist:linux   # Linux: AppImage + deb + rpm
```

3. Create the release manually and upload the files from `release/`.

Do not commit tokens to the repository.
