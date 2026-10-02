# Traceverse

**by NIRVANA **

A real-time browser app that turns your body movement and music into generative motifs. It tracks your pose through the webcam (or runs on sound alone with the camera paused) and drives a set of live WebGL visual systems — 16 modes so far, with more being added over time — that you can palette-swap, layer over your own background, and record straight to MP4.

No install, no plugins: it's a single Vite + TypeScript web app that runs entirely in the browser.

## What it does

- **Tracks your body** via on-device pose estimation (33 landmarks + a body segmentation mask), smoothed and converted into a stable "stage space" so patterns don't distort as you move toward or away from the camera.
- **Reacts to movement** — per-joint velocity feeds flow-field particle systems, silhouette masks, growth/decay systems, and shader uniforms across every mode.
- **Reacts to sound** — enable your microphone or upload a music file, and the same "energy" signal that movement drives gets fed by the live audio level plus a beat/kick detector. You can pause camera tracking entirely and let music alone drive every mode.
- **Palette-driven color** — a single 5-stop color palette (with curated presets, fully customizable) is injected into every mode's rendering, including the ones that sample raw video.
- **Records what you see** — canvas + audio capture straight to a downloadable MP4 (direct H.264 where the browser supports it, otherwise WebM transcoded client-side via ffmpeg.wasm), plus high-res PNG stills.
- **Flexible background** — perform against nothing, your own live camera feed, an uploaded image, or an uploaded video.

## Visual modes

16 modes today, grouped into categories in the UI (some categories have multiple style variants) — this list will keep growing, see [Roadmap](#roadmap).

| Category | Style(s) | What you see |
|---|---|---|
| **Flurix** | — | A dense, tessellating lattice of star-shaped motifs that clips to and warps along your body silhouette, with a large, slow ambient layer drifting behind it. |
| **Luns** | Star | Instanced star-shaped motifs swirl around a hollow cutout of your body, pulled by a joint-velocity flow field. |
| | Orb | The same flow-field engine as Star, rendered as soft, glowing, near-circular orbs with a continuous ambient wobble and breathing pulse — more organic and slow. |
| **Code** | — | Flickering digit/code-symbol particles, connected by thin circuit-like lines, tracking a hollow cutout of your body. |
| **Script** | — | The same particle/circuit engine as Code, rendered with a different glyph set. |
| **Astrix** | — | A dense field of small, sharp, flickering spark motifs connected by a crackling web of lines; sparks near your hands/feet ignite brighter, and the outline of your body glows at the edge. |
| **Abstract** | Fill | A painterly, domain-warped noise field clipped to your body silhouette. |
| | Grow | The same noise field, but only revealed where you've recently moved — a continuous soft "paint trail" that spreads and fades like wet paint tracking your motion. |
| **Shatter** | — | Your silhouette breaks apart into a field of small geometric star-shaped fragments, colored by sampling the live video underneath. |
| **Cellis** | — | Your silhouette breaks apart into soft, organic wave-like blobs, colored by sampling the live video, revealing what's behind them as you move. |
| **Mandala** | — | A true kaleidoscope of your own movement: each tracked hand/elbow/ankle/nose trail is mirrored about your body center and fold-rotated around the screen as glowing, fading light trails. With no body in frame, it dances from live audio (bass/mid/treble) alone. |
| **Glitch** | Color | Your background (camera, image, or video) glitches with RGB channel splitting, block displacement, and flickering static, concentrated on your silhouette and colored by the active palette. |
| | Static | The same glitch engine as Color, without palette coloring — raw noise instead. |
| | Analog | Continuous wavy line distortion, chromatic fringing, film grain, and occasional full-width tears — reads as analog signal interference (VHS/CRT) rather than digital blocking. |
| | Pixelated | Your background breaks into a mosaic of movement-sized blocks with bold grid lines and glitching rows. |
| | Lines | A fine comb of individually color-split scanlines — a delicate, more granular colorful-glitch flavor. |

Every mode reacts to the same shared "energy" signal (movement speed, mic/music level, and detected beats), so switching modes live during a performance keeps the same felt intensity.

## Architecture

### Stack

- **Vite + TypeScript** — dev server and build, no framework (React/Vue) — the render loop is hand-tuned and a full component framework would add overhead for no benefit at this UI's scale.
- **Three.js** — scene graph, orthographic camera, `InstancedMesh` for thousands of independently-animated motifs in a single draw call, `EffectComposer` for the bloom/glow post-process pass.
- **`@mediapipe/tasks-vision`** — on-device `PoseLandmarker` (33 landmarks, BlazePose) with segmentation mask output, running fully client-side.
- **Web Audio API** — microphone or uploaded-file analysis (no external services).
- **`@ffmpeg/ffmpeg`** (ffmpeg.wasm) — client-side WebM→MP4 transcode fallback for recording.
- **GLSL shaders** (via `vite-plugin-glsl`) — nearly every mode is a hand-written fragment shader; a few (Mandala) render to an offscreen `<canvas>` composited as a texture.
- **Tweakpane** — the parameter/palette control panel.

### Body tracking pipeline

1. `PoseTracker` owns the webcam stream and the MediaPipe `PoseLandmarker`. It runs its own detection loop against the `<video>` element, **decoupled from the render loop** — the renderer only ever reads the latest tracked state, so slow inference never blocks rendering.
2. Raw landmarks are smoothed with a **One Euro Filter** per landmark per axis — this adaptively tightens when you're still (kills jitter) and loosens during fast motion (kills lag). Landmarks with low confidence freeze rather than snap.
3. Per-joint velocity is derived, plus a single scalar **movement energy** value used across every mode.
4. Raw image-space coordinates (0–1) are converted into a stable, aspect-corrected, mirrored **"stage space"** so patterns stay proportionate regardless of camera aspect ratio or how close you stand.
5. A "Pause Camera Tracking" control stops pose inference (and clears detection state) without touching the camera stream itself — this is what lets uploaded music become the sole driver of every mode on demand.

### Rendering approach

- Most modes render as a fullscreen shader pass (`PlaneGeometry(2,2)` + a custom `ShaderMaterial`) or as an `InstancedMesh` of a shared star-SDF (signed-distance-field) shape, reused across modes with different per-instance shape parameters (symmetry, sharpness, roundness) so many visually distinct motifs share one shader.
- A shared **flow-field particle helper** (`FlowFieldParticles`) powers the swirling-motif modes: a jittered grid of instances, each pulled by a vortex field built from joint velocities (with body-clearance repulsion) when a pose is detected, and pulled back to a home position by a weak spring — or, with no pose detected, nudged by a slow, audio-energy-driven ambient sway, so those modes stay alive from sound alone.
- The body segmentation mask is uploaded each frame as a `DataTexture` and sampled in shaders to clip patterns to (or around) your silhouette.
- A shared `paletteColor()` GLSL function (and a JS-side mirror for non-shader particle systems) grades color from the active 5-stop palette — used even by modes that otherwise sample raw video, so palette choice affects every mode consistently.
- Glitch-family modes read live video (camera/image/video background) as a texture and distort it in the fragment shader, rather than owning their own video pipeline.

### Audio reactivity

- `AudioReactor` wraps the Web Audio API: microphone via `getUserMedia`, or an uploaded file played back through a `<audio>` element (with a small play/pause/seek transport).
- A single smoothed **level** (with a sustained decay "pulse" on detected onsets) is the general-purpose signal every mode consumes. Separate **bass / mid / treble** bands and a fast, punchy **kick** detector are exposed for modes (like Mandala) that want genuine multi-band, media-visualizer-style reactivity.
- In the main render loop, this signal is blended with real movement energy via `max()` when a body is detected (sound only ever *boosts* movement, never fights it), or assigned directly from the live audio level when no body is present (so it rises and falls with the actual music instead of latching to a historical peak).

### Recording

- `canvas.captureStream()` + `MediaRecorder`, with the active audio stream's tracks merged in so recordings include whatever's playing (mic or uploaded music).
- Prefers direct H.264 MP4 recording where the browser supports it; otherwise records WebM and transcodes to MP4 client-side in a Web Worker via ffmpeg.wasm, with a progress indicator. (Multi-threaded ffmpeg.wasm needs `crossOriginIsolated`, hence the `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers set in both `vite.config.ts` and `vercel.json`.)
- A separate on-demand hi-res PNG export renders a single supersampled frame to an offscreen render target.

### Project structure

```
src/
  main.ts                 # bootstrap, wiring, master render loop
  core/                    # scene setup, app/palette state, background layer
  tracking/                # PoseTracker, smoothing, AudioReactor, mask/video sampling
  generators/              # per-mode shaders + materials, organized by mode
  modes/                   # one class per visual mode, each owning its own mesh(es)
  ui/                      # control panel, mode switcher, background/sound/recording controls
  recording/               # canvas recorder, ffmpeg.wasm transcoder, still exporter
public/
  mediapipe/               # bundled MediaPipe WASM runtime (no CDN dependency mid-performance)
  models/                  # bundled pose landmarker model
  ffmpeg-core/              # bundled ffmpeg.wasm core
```

## Getting started

```bash
npm install
npm run dev       # local dev server at http://localhost:5173
npm run build     # production build to dist/
```

Requires a webcam (optional — the app works from music alone) and a browser with WebGL2 + Web Audio support. Camera/mic access requires HTTPS in production (or `localhost` for local dev).

## Deployment

Deployed via [Vercel](https://vercel.com), connected directly to this repo — every push to `main` redeploys automatically. `vercel.json` sets the COOP/COEP headers the app needs for full (multi-threaded) MP4 transcoding; without them the app still works, MP4 export just falls back to a slower single-threaded path.

## Roadmap

This is an actively evolving instrument — new visual modes get added over time alongside refinements to existing ones (color grading, audio-reactivity tuning, new motif behaviors). If you're picking this repo up to extend it: a new mode is typically a new class in `src/modes/` (paired with a shader/material in `src/generators/`), wired into `ModeController`, `AppState`'s mode union, and `ModeSwitcher`'s category list.

## Credits

Built with [Three.js](https://threejs.org/), [MediaPipe](https://ai.google.dev/edge/mediapipe), and [ffmpeg.wasm](https://ffmpegwasm.netlify.app/).

## License

© 2026 NIRVANA (Visheh). All rights reserved — see [LICENSE](LICENSE).
