# Diablo IV Build Planner

Static React + Vite workspace for rendering Diablo IV build-guide JSON.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm validate:schema
pnpm verify:schema path/to/build-guide.json
pnpm build
pnpm preview
```

## Notes

- Package manager is pinned with Corepack in `package.json`.
- Vite uses `base: './'` so the production build can be hosted as static files on GitHub Pages.
- The current UI reads `src/sample-build.json`; later builds can swap that for generated or uploaded JSON.
- The canonical build-guide schema lives at `public/schema/build-guide.schema.json`.
- The static schema viewer is available at `schema/` when the app is served.
- A fuller loader demo is available at `public/demo-build-guide.json`.
- `pnpm verify:schema` validates one or more JSON files against the schema. Use `pnpm verify:schema -` to validate JSON from stdin.
