# Add dinosaurs and roar sounds

The app starts with a procedural dinosaur and synthesized voice. Additional animals are selected from the dropdown on the start screen or in the HUD. Imported models use A-Frame's built-in glTF loader, so add a `.glb` file; convert `.obj` or `.fbx` to `.glb` in Blender before using it. The imported model remains movable, scalable and rotatable, but does not use the procedural dinosaur's walk-cycle animation.

## Add a model

1. Download the model and check its license and attribution requirements. Keep a note of the source and license in your project.
2. In Blender, import the model, orient it with **+Y up** and its front facing **+Z**, put its feet at ground level, and scale it to about **0.5 m tall**. Apply transforms, then export as **glTF Binary (`.glb`)**.
3. Keep the file reasonably small for phone downloads. If it is more than 50 MB, optimize it or host it elsewhere; GitHub warns on files over 50 MB and rejects regular Git files over 100 MB.
4. Copy it to `assets/models/`, for example `assets/models/raptor.glb`.
5. Add an entry to the `animals` list in `js/config.js`:

```js
Object.freeze({
  id: 'raptor',
  label: 'Raptor',
  model: './assets/models/raptor.glb',
  roar: './assets/audio/raptor-roar.mp3'
})
```

Use a unique lowercase `id`. A model-only entry can use `roar: null` to keep the synthesized voice. Add the entry beside `classic-dino`, not outside the `animals` array. The model path is relative to the project root and is case-sensitive after deployment.

## Add a roar

1. Download or record an audio file you are licensed to use. Check the source's terms and add attribution when required; do not assume a sound labeled "free" is public domain.
2. Prefer a short MP3 or OGG file and keep its volume comfortable. Put it under `assets/audio/`, for example `assets/audio/raptor-roar.mp3`.
3. Set the profile's `roar` value to that path. The file is selected with its dinosaur, starts only after a user action, follows the mute button, and falls back to the synthesized roar if playback fails.

## Verify it

1. Run `npm test` and `npm run check`.
2. Run `npm run serve`, then open `http://localhost:5500` on desktop and select the new animal. Confirm it loads, appears on placement, and responds to the buttons and gestures.
3. For Android AR, use HTTPS (GitHub Pages or a tunnel), open the page in Chrome, then verify model selection, place, drag, pinch, twist, roar and mute on the phone. Desktop preview does not replace a real AR test.
4. Check the browser console and Network panel for missing files, model decode errors, or audio errors. Paths on GitHub Pages are case-sensitive.

## GitHub Pages capacity

GitHub documents one user or organization site per account and one project site per repository; it does not publish a fixed account-wide count of project sites. Published sites are limited to 1 GB. Source repositories have a recommended 1 GB limit, and Pages has soft limits of 100 GB monthly bandwidth and 10 builds per hour. GitHub does not specify a maximum file count for a Pages site. These limits can change; see the [official Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).