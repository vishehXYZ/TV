import { ChaosMode } from './modes/ChaosMode';
import { StudioLayout } from './ui/StudioLayout';
import { SurfaceMode } from './modes/SurfaceMode';
import { MotionSound } from './tracking/MotionSound';
import Stats from 'stats.js';
import './style.css';
import { SceneManager } from './core/SceneManager';
import { RenderLoop } from './core/RenderLoop';
import { AppState } from './core/AppState';
import { BackgroundLayer } from './core/BackgroundLayer';
import { BackgroundControls } from './ui/BackgroundControls';
import { PoseTracker } from './tracking/PoseTracker';
import { AudioReactor } from './tracking/AudioReactor';
import { SoundControls } from './ui/SoundControls';
import { FillMode } from './modes/FillMode';
import { DanceMode } from './modes/DanceMode';
import { CodeMode } from './modes/CodeMode';
import { NatureMode } from './modes/NatureMode';
import { LightningMode } from './modes/LightningMode';
import { AbstractFillMode } from './modes/AbstractFillMode';
import { AbstractGrowMode } from './modes/AbstractGrowMode';
import { DissolveMode } from './modes/DissolveMode';
import { DissolveLinesMode } from './modes/DissolveLinesMode';
import { MandalaMode } from './modes/MandalaMode';
import { PixelMeltMode } from './modes/PixelMeltMode';
import { GlitchMode } from './modes/GlitchMode';
import { GlitchMonoMode } from './modes/GlitchMonoMode';
import { GlitchLinesMode } from './modes/GlitchLinesMode';
import { DistortGlitchMode } from './modes/DistortGlitchMode';
import { ModeController } from './modes/ModeController';
import { ControlPanel } from './ui/ControlPanel';
import { ModeSwitcher } from './ui/ModeSwitcher';
import { RecordingControls } from './ui/RecordingControls';
import { StillExporter } from './recording/StillExporter';
import { StartScreen } from './ui/StartScreen';
import { PresentationMode } from './ui/PresentationMode';
import { CameraPicker } from './ui/CameraPicker';
import { ChromaMode } from './modes/ChromaMode';
import { ChromaGeoMode } from './modes/ChromaGeoMode';
import { SketchMode } from './modes/SketchMode';
import { RippleMode } from './modes/RippleMode';
import { RevealMode } from './modes/RevealMode';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const video = document.querySelector<HTMLVideoElement>('#webcam')!;
const uiRoot = document.querySelector<HTMLDivElement>('#ui-root')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const appRoot = document.querySelector<HTMLDivElement>('#app')!;

const sceneManager = new SceneManager(canvas);
const poseTracker = new PoseTracker(video);
const audioReactor = new AudioReactor();
const appState = new AppState();
const backgroundLayer = new BackgroundLayer(sceneManager);

const fillMode = new FillMode(sceneManager, appState);
const danceMode = new DanceMode(sceneManager, appState);
const codeMode = new CodeMode(sceneManager, appState, 'code', 'outside');
const codeInsideMode = new CodeMode(sceneManager, appState, 'code', 'inside');
const scriptMode = new CodeMode(sceneManager, appState, 'arabic', 'outside');
const scriptInsideMode = new CodeMode(sceneManager, appState, 'arabic', 'inside');
const natureMode = new NatureMode(sceneManager, appState);
const lightningMode = new LightningMode(sceneManager, appState);
const abstractFillMode = new AbstractFillMode(sceneManager, appState);
const abstractGrowMode = new AbstractGrowMode(sceneManager, appState);
const dissolveMode = new DissolveMode(sceneManager, video, backgroundLayer);
const dissolveLinesMode = new DissolveLinesMode(sceneManager, video, backgroundLayer, appState);
const mandalaMode = new MandalaMode(sceneManager);
const pixelMeltMode = new PixelMeltMode(sceneManager, video, backgroundLayer);
const glitchMode = new GlitchMode(sceneManager, video, backgroundLayer);
const glitchMonoMode = new GlitchMonoMode(sceneManager, video, backgroundLayer);
const glitchLinesMode = new GlitchLinesMode(sceneManager, video, backgroundLayer);
const distortGlitchMode = new DistortGlitchMode(sceneManager, video, backgroundLayer);
const chromaMode = new ChromaMode(sceneManager, appState);
const chromaGeoMode = new ChromaGeoMode(sceneManager, appState);
const sketchMode = new SketchMode(sceneManager, appState);
const rippleMode = new RippleMode(sceneManager, video, backgroundLayer);
const revealMode = new RevealMode(sceneManager, video, backgroundLayer);
const surfaces = { verticalLines: new SurfaceMode(sceneManager, appState, 0), scribbleGlitch: new ChaosMode(sceneManager, 0), numberGlitch: new ChaosMode(sceneManager, 1), chaosMix: new ChaosMode(sceneManager, 2), dualTexture: new SurfaceMode(sceneManager, appState, 2), dualTextureReverse: new SurfaceMode(sceneManager, appState, 3) };
const motionSound = new MotionSound();
const modeController = new ModeController(
  appState,
  fillMode,
  danceMode,
  codeMode,
  codeInsideMode,
  scriptMode,
  scriptInsideMode,
  natureMode,
  lightningMode,
  abstractFillMode,
  abstractGrowMode,
  dissolveMode,
  dissolveLinesMode,
  mandalaMode,
  pixelMeltMode,
  glitchMode,
  glitchMonoMode,
  glitchLinesMode,
  distortGlitchMode,
  chromaMode,
  chromaGeoMode,
  sketchMode,
  rippleMode,
  revealMode,
  surfaces,
);

const controlPanel = new ControlPanel(uiRoot, appState, sceneManager.bloomPass);
const modeSwitcher = new ModeSwitcher(appState);
appRoot.appendChild(modeSwitcher.container);

// On mobile (see the media query in style.css) the parameter panel becomes a full-screen overlay
// instead of a permanent fixture, toggled by this gear button — the button itself is hidden on
// desktop via CSS, where the panel stays visible as before.
const settingsToggleButton = document.createElement('button');
settingsToggleButton.className = 'settings-toggle-button';
settingsToggleButton.textContent = '⚙';
settingsToggleButton.setAttribute('aria-label', 'Toggle settings panel');
settingsToggleButton.addEventListener('click', () => uiRoot.classList.toggle('open'));
appRoot.appendChild(settingsToggleButton);

// Fullscreen + hide-all-UI, for projector/wall performance — press F any time, or this small corner
// button (which itself hides once active; press F again or Escape to bring everything back).
const presentationToggleButton = document.createElement('button');
presentationToggleButton.className = 'presentation-toggle-button';
presentationToggleButton.textContent = '⛶';
presentationToggleButton.title = 'Fullscreen, hide all menus (F)';
presentationToggleButton.setAttribute('aria-label', 'Toggle fullscreen presentation mode');
appRoot.appendChild(presentationToggleButton);
new PresentationMode(presentationToggleButton);

// Unified bottom control bar: Background/Backdrop/Sound/Recording, each its own clearly-labeled card.
const controlBar = document.createElement('div');
controlBar.className = 'control-bar';
appRoot.appendChild(controlBar);

const backgroundControls = new BackgroundControls(backgroundLayer, () => (video.srcObject ? video : null));
backgroundControls.container.classList.add('control-bar-section');
controlBar.appendChild(backgroundControls.container);
backgroundControls.backdropContainer.classList.add('control-bar-section');
controlBar.appendChild(backgroundControls.backdropContainer);
backgroundControls.editContainer.classList.add('control-bar-section');
controlBar.appendChild(backgroundControls.editContainer);

// Shortcut for Self View, right in the webcam/pause/camera-picker cluster where it's obvious and
// easy to find, instead of only living inside the Background section of the bottom control bar (that
// full picker still exists too — this just triggers the exact same logic, kept in sync every frame).
const selfViewToggleButton = document.createElement('button');
selfViewToggleButton.className = 'self-view-toggle-button';
selfViewToggleButton.textContent = 'Self View';
selfViewToggleButton.addEventListener('click', () => {
  if (backgroundLayer.mode === 'camera') backgroundControls.noneButton.click();
  else backgroundControls.cameraButton.click();
});
appRoot.appendChild(selfViewToggleButton);

const soundControls = new SoundControls(audioReactor);
soundControls.container.classList.add('control-bar-section');
controlBar.appendChild(soundControls.container);
const motionButton = document.createElement('button'); motionButton.className = 'background-button'; motionButton.textContent='Motion Sound Off';
motionButton.addEventListener('click', async () => { try { if(motionSound.enabled) motionSound.disable(); else await motionSound.enable(); motionButton.textContent=motionSound.enabled ? 'Motion Sound On':'Motion Sound Off'; } catch(e) { alert((e as Error).message); } });
soundControls.container.append(motionButton);

let lastElapsed = 0;
let lastDt = 1 / 60;
const renderFrame = (): void => {
  motionSound.update(poseTracker.state);
  motionSound.mix(audioReactor.audioStream);
  backgroundLayer.update();
  modeController.syncVisibility();
  controlPanel.syncVisibility();
  selfViewToggleButton.classList.toggle('active', backgroundLayer.mode === 'camera');

  // Max-blend (not add) so sound only ever boosts the existing movement-energy signal instead of
  // compounding across frames — every mode reacts to this same poseTracker.state.energy value
  // (growth speed, particle spawn rate, glitch intensity, rotation speed, pulse, etc.), so sound
  // alone drives a genuinely animated "dance" through each mode's own harmonic time-based motion —
  // no fabricated body/landmarks needed. audioReactor.level already includes a sustained
  // beat-triggered pulse (see AudioReactor.update()), so a detected beat/onset stays visible for
  // about a second rather than a single invisible frame.
  if (audioReactor.isActive) {
    audioReactor.update();
    if (poseTracker.state.hasDetection) {
      // Kick blended in too (not just the general level/pulse) — a punchier, more clearly beat-synced
      // pop for every mode already reacting to poseTracker.state.energy. Max against the real movement
      // energy so sound only ever boosts it, never fights it.
      poseTracker.state.energy = Math.max(poseTracker.state.energy, audioReactor.level, audioReactor.kick * 0.8);
    } else {
      // No body (tracking paused) — audio is the ONLY signal, so replace rather than max-blend. Maxing
      // against state.energy here would just be maxing against last frame's own already-blended value,
      // a self-referential ratchet that only ever climbs to the loudest moment so far and never comes
      // back down — killing the beat-to-beat pulse entirely. Assigning it fresh each frame lets energy
      // rise and fall with the actual live music, which is what makes it read as dancing, not just "on".
      poseTracker.state.energy = Math.max(audioReactor.level, audioReactor.kick * 0.8);
    }
  }
  const audioBands = audioReactor.isActive
    ? { kick: audioReactor.kick, mid: audioReactor.mid, treble: audioReactor.treble }
    : { kick: 0, mid: 0, treble: 0 };
  switch (appState.mode) {
    case 'verticalLines': case 'scribbleGlitch': case 'numberGlitch': case 'chaosMix': case 'dualTexture': case 'dualTextureReverse':
      surfaces[appState.mode].update(poseTracker, appState, lastElapsed); break;
    case 'fill':
      fillMode.update(poseTracker, appState, lastElapsed);
      break;
    case 'dance':
      danceMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'code':
      codeMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'codeInside':
      codeInsideMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'script':
      scriptMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'scriptInside':
      scriptInsideMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'nature':
      natureMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'lightning':
      lightningMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'abstractFill':
      abstractFillMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'abstractGrow':
      abstractGrowMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'dissolve':
      dissolveMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'dissolveLines':
      dissolveLinesMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'mandala':
      mandalaMode.update(poseTracker, appState, lastElapsed, audioBands);
      break;
    case 'pixelMelt':
      pixelMeltMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'glitch':
      glitchMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'glitchMono':
      glitchMonoMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'glitchLines':
      glitchLinesMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'distortGlitch':
      distortGlitchMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'chroma':
      chromaMode.update(poseTracker, appState, lastElapsed);
      break;
    case 'chromaGeo':
      chromaGeoMode.update(poseTracker, appState, lastElapsed);
      break;
    case 'sketch':
      sketchMode.update(poseTracker, appState, lastElapsed);
      break;
    case 'ripple':
      rippleMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
    case 'reveal':
      revealMode.update(poseTracker, appState, lastElapsed, lastDt);
      break;
  }
  sceneManager.render();
};

const stillExporter = new StillExporter(sceneManager);
const recordingControls = new RecordingControls(canvas, stillExporter, renderFrame, audioReactor, sceneManager, () => { motionSound.mix(audioReactor.audioStream); return motionSound.stream ?? audioReactor.audioStream; });
recordingControls.container.classList.add('control-bar-section');
controlBar.appendChild(recordingControls.container);

const stats = new Stats();
stats.dom.classList.add('stats-panel');
stats.dom.style.position = 'absolute';
// Bottom-left, above the status text — the webcam/pause/Self View/camera-picker stack at the top-left
// now runs well past where this used to sit (top: 170px), which overlapped the newer buttons.
stats.dom.style.top = '';
stats.dom.style.bottom = '38px';
stats.dom.style.left = '12px';
stats.dom.style.zIndex = '3';
document.body.appendChild(stats.dom);

// Pause/resume camera-driven tracking without touching the camera stream itself (Self View keeps
// working) — this is what lets imported music/mic become the sole visual trigger on demand, instead
// of only working that way before the camera is ever enabled. Positioned right under the webcam
// preview so it's obvious and easy to find, not a small icon elsewhere.
let trackingPaused = false;
const pauseButton = document.createElement('button');
pauseButton.textContent = 'Pause Camera Tracking';
pauseButton.className = 'camera-toggle-button';
pauseButton.style.display = 'none';
appRoot.appendChild(pauseButton);

pauseButton.addEventListener('click', () => {
  trackingPaused = !trackingPaused;
  if (trackingPaused) {
    poseTracker.stop();
    poseTracker.state.hasDetection = false;
    poseTracker.state.energy = 0;
    poseTracker.state.segmentationMask = null;
    pauseButton.textContent = 'Resume Camera Tracking';
    pauseButton.classList.add('paused');
    statusEl.textContent = 'Camera tracking paused — sound is now the sole trigger';
  } else {
    poseTracker.start();
    pauseButton.textContent = 'Pause Camera Tracking';
    pauseButton.classList.remove('paused');
    statusEl.textContent = 'Tracking active';
  }
});

// Only appears once connected, and only if more than one camera is actually available (external
// camera, phone front/back, etc.) — see CameraPicker.ts for why it can't be populated any earlier.
const cameraPicker = new CameraPicker(poseTracker);
appRoot.appendChild(cameraPicker.container);

new StudioLayout(appRoot, canvas, modeSwitcher.container, uiRoot, settingsToggleButton, presentationToggleButton,
  [video, pauseButton, selfViewToggleButton, cameraPicker.container],
  [backgroundControls.container, backgroundControls.backdropContainer, backgroundControls.editContainer],
  soundControls.container, recordingControls.container, statusEl);

const startScreen = new StartScreen();
appRoot.appendChild(startScreen.container);

startScreen.connectButton.addEventListener('click', async () => {
  startScreen.connectButton.disabled = true;
  startScreen.connectButton.textContent = 'Connecting…';
  try {
    await poseTracker.startWebcam();
    await poseTracker.init('lite');
    poseTracker.start();
    startScreen.hide();
    pauseButton.style.display = '';
    void cameraPicker.refresh();
    statusEl.textContent = 'Tracking active';
  } catch (err) {
    startScreen.connectButton.disabled = false;
    startScreen.connectButton.textContent = 'Connect to Camera';
    statusEl.textContent = `Error: ${(err as Error).message}`;
    console.error(err);
  }
});

const loop = new RenderLoop((dt, elapsed) => {
  stats.begin();
  lastElapsed = elapsed;
  lastDt = dt;
  renderFrame();
  stats.end();
});
loop.start();
