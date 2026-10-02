# Requested additions

All existing 23 visual modes, palette controls, camera controls, media grading, music controls, PNG export and output aspect formats are retained. Four new choices: Sharp Vertical Lines; White Ink & Color; Lines / Dots inside/outside; Dots / Crosses inside/outside. Body separation requires camera tracking and a segmentation mask. Existing palette controls apply to the new motifs.

## Video
Background Video now has Back/Forward 10 seconds, Play/Pause, Stop, Start/End in seconds, Apply Trim and Reset Trim. Trim is non-destructive: it loops only the chosen source interval in the composition. It does not write a separately trimmed source video. Stop resets the source trim and playhead.

## Recording
Final preserves full selected dimensions (1920x1080, 1080x1920 or 2000x2000), 30 fps, 16 Mbps requested capture bitrate. Test uses half each dimension, 24 fps, 2 Mbps. Actual encoding/size depends on content and browser. Cancel Recording discards the take, also while preparing MP4. Final conversion has no 45-second cutoff; lengthy takes can take time and use significant RAM. No WebM fallback download. If conversion fails, an error is shown.

Prefer supported native H.264 MP4 capture, then remux with faststart; otherwise encode WebM capture into H.264/yuv420p MP4 with AAC audio. Native recording is not simply renamed. Browser/device format support is detected at runtime. This does not guarantee acceptance by every social platform or device.

## Sound
Uploaded filename is visible. Motion Sound is off by default; click to enable it. Actual body velocity controls loudness, right-hand height controls pitch. Generated sound and active music/microphone mix into recordings; generation does not feed back into the audio visualizer. Camera tracking must be active for motion sound. This is a synthesized tone, not generated music.

## Safari compatibility work
Runtime capture format selection, AudioContext resume, safe optional fullscreen handling, bundled lite pose model and GPU-to-CPU tracking initialization fallback. Use HTTPS for camera/microphone. Apple hardware has not been tested; Safari support remains pending a real device smoke test. No browser executables were available in the execution environment for an end-to-end browser run.

## Screen capture

No screenshot/screen-recording restrictions, public-viewer flag, watermark or capture-blocking header are included in this version, per the final request.

## Validation
npm ci --ignore-scripts
npm run build
npx vitest run

Build passed. Three recorder unit tests passed. No camera, actual MP4 conversion, real audio or Safari hardware end-to-end validation performed. New features should be checked in the existing deployment before relying on a live performance recording.
