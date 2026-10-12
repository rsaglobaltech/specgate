# @specgate/pack-registry

Static-site generator for the Spec-Driven domain pack registry. Reads packs
from a directory, runs schema + lint checks via `specgate pack lint`,
and emits a single-page HTML index plus a JSON manifest.

## Usage

```bash
node packages/pack-registry/src/build.js
# Defaults:
#   --packs ./packs
#   --out   ./packages/pack-registry/dist
```

The build:

1. Discovers every `<domain>/<type>/pack.yaml` under `--packs`
2. Loads each pack and runs `pack lint`
3. Emits `dist/index.html` (one card per pack)
4. Emits `dist/manifest.json` (machine-readable summary)
5. Exits 1 if any pack fails lint (so CI catches regressions)

## Deployment

The generated `dist/` is plain static HTML with no JavaScript or external
dependencies. Deploy it to any static host:

- **Cloudflare Pages**: connect the repo, set build command to
  `node packages/pack-registry/src/build.js`, output directory to
  `packages/pack-registry/dist`.
- **GitHub Pages**: use a workflow that builds `dist/` and deploys it with
  `actions/upload-pages-artifact` and `actions/deploy-pages`.
- **S3 / Netlify / Vercel**: same pattern.

## Architecture

```
src/
├── scan.js     # Pure: scans packs/ → metadata array (uses CLI for lint)
├── render.js   # Pure: metadata → HTML strings (no fs)
└── build.js    # I/O: writes dist/index.html and dist/manifest.json
test/unit/
└── registry.test.js  # 10 tests (no browser needed)
```

`scan.js` and `render.js` are decoupled — `render.js` is fully pure and could
also produce JSON, RSS, sitemap, etc. without changes.

## Adding a new pack

1. Create `packs/<your-domain>/<type>/pack.yaml` (use
   `specgate pack init` to scaffold).
2. Run `node bin/specgate.js pack lint --pack-root packs --pack <your-domain>/<type>`
   until it passes.
3. Open a PR. CI will run the registry build to verify nothing else broke.

The pack will appear in the next deploy with a "verified" badge.
