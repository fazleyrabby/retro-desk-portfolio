# Retro Desk

Fazley Rabbi's interactive 3D portfolio. The build contains a detailed desk scene, orbit/zoom exploration, a focus camera, a FAZLEY OS interface rendered on the CRT monitor, stacked project floppies, paper notebooks, a working lamp, and optional ambient audio. Content comes from the Astro portfolio and is imported into typed local data.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the address printed by Vite.

- **Look around:** drag the desk to orbit, scroll/pinch or the `+ − ⟲` controls to zoom. Arrow keys also move the view.
- **Computer:** click the monitor (or **Computer**). The FAZLEY OS desktop opens on the CRT with Projects, Lab, About, and Contact. Project details render on the monitor itself.
- **Disks:** click the floppy stack (or **Disks**) to zoom in, then choose a disk from the tray. The disk inserts into the drive and its project loads on the monitor.
- **Notebook:** click the stacked books (or **Notebook**) to zoom in, then choose *Field Notes* (writing) or *Work Log* (career). The book opens on aged paper with page turns.
- **Lamp** toggles real scene lighting. **Sound off/on** enables quiet procedural rain, foliage, and fan ambience; it starts only after a visitor gesture.
- **Escape** or **Back to desk** always returns to the overview. **Help** lists the controls.

The header visit count uses the same homelab view-counter service as Boatride, with its own `retro-desk-portfolio` project key. Local previews and automated browsers read the count without adding visits; production visits are counted once per session.

## Content

Portfolio facts, projects, experiments, writing, and career history are imported from the local Astro portfolio at `/Users/rabbi/Desktop/Projects/Sites/astro-portfolio` into typed snapshots. The deployed site never reads that checkout.

```bash
node tools/import-content.mjs                     # default source path
ASTRO_SOURCE=/path/to/astro-portfolio node tools/import-content.mjs
```

This writes `src/data/generated/content.ts`, per-article bodies, and `src/data/generated/sources.json`, recording each record's source path and verification date. Re-run it when the reference repo changes, then review the diff. `gray-matter` is resolved from the Astro checkout's `node_modules`; `spec.md` §6 documents the selection rules.

## Assets

The editable Blender source is `tools/retro-desk-assets.blend`. `tools/build_assets.py` generates it and exports `public/models/hero-props.glb`. It contains the CRT, horizontal computer case, keyboard, floppy, notebook, lamp, fan, telephone, headphones, and ceramic mug. The scene loads this GLB and keeps a simple built-in model fallback if loading fails. `src/assetFinish.ts` adds restrained surface grain and wear, while the scene adds contact and directional shadows. The rainy exterior is `public/textures/rainy-exterior.webp`; `src/rain.ts` adds animated rain and droplets over it.

To regenerate the models with Blender installed locally:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/build_assets.py
```

The scene uses locally hosted Satoshi and IBM Plex Mono font files copied from the reference Astro portfolio at `/Users/rabbi/Desktop/Projects/Sites/astro-portfolio`. The notebook/paper reading view adds the handwritten Caveat and Patrick Hand fonts, self-hosted from `public/fonts` (both SIL Open Font License).
