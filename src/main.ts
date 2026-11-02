import { ObjectLayerControls } from './ui/ObjectLayerControls';
import { clipMediaMaterial } from './core/GlassMediaMask';
import { BodyFxMode } from './modes/BodyFxMode';
import { ChaosMode } from './modes/ChaosMode';
import { StudioLayout } from './ui/StudioLayout';
import { SurfaceMode } from './modes/SurfaceMode';
import { MotionSoundControls } from './ui/MotionSoundControls';
import { MotionSound } from './tracking/MotionSound';
import Stats from 'stats.js';
import './style.css';
import { SceneManager } from './core/SceneManager';
import { RenderLoop } from './core/RenderLoop';
import { AppState } from './core/AppState';
import { BackgroundLayer } from './core/BackgroundLayer';
import { BackgroundControls } from './ui/BackgroundControls';
import { PoseTracker } from './tracking/PoseTracker';
import { PoseState } from './tracking/PoseState';
import { syncVisualPose } from './tracking/VisualPose';
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
const visualPose=new PoseState();
const visualTracker=new Proxy(poseTracker,{get(target,key,receiver){return key==='state'?visualPose:Reflect.get(target,key,receiver);}});
const audioReactor = new AudioReactor();
const appState = new AppState();
const backgroundLayer = new BackgroundLayer(sceneManager);
const foregroundLayer = new BackgroundLayer(sceneManager, false);
// Media-based modes follow the foreground when present; source controls remain independent.
const effectMediaSource = new Proxy(backgroundLayer, { get(target, property) {
  const source = foregroundLayer.mode !== 'none' ? foregroundLayer : target;
  const value = Reflect.get(source, property);
  return typeof value === 'function' ? value.bind(source) : value;
} });

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
const dissolveMode = new DissolveMode(sceneManager, video, effectMediaSource);
const dissolveLinesMode = new DissolveLinesMode(sceneManager, video, effectMediaSource, appState);
const mandalaMode = new MandalaMode(sceneManager);
const pixelMeltMode = new PixelMeltMode(sceneManager, video, effectMediaSource);
const glitchMode = new GlitchMode(sceneManager, video, effectMediaSource);
const glitchMonoMode = new GlitchMonoMode(sceneManager, video, effectMediaSource);
const glitchLinesMode = new GlitchLinesMode(sceneManager, video, effectMediaSource);
const distortGlitchMode = new DistortGlitchMode(sceneManager, video, effectMediaSource);
const chromaMode = new ChromaMode(sceneManager, appState);
const chromaGeoMode = new ChromaGeoMode(sceneManager, appState);
const sketchMode = new SketchMode(sceneManager, appState);
const rippleMode = new RippleMode(sceneManager, video, effectMediaSource);
const revealMode = new RevealMode(sceneManager, video, effectMediaSource);
const surfaces = { geoPortal: new BodyFxMode(sceneManager, 3), geoOrbits: new BodyFxMode(sceneManager, 4), geoFracture: new BodyFxMode(sceneManager, 5), bodyFlames: new BodyFxMode(sceneManager, 0), bodyRibbons: new BodyFxMode(sceneManager, 1), bodyPrism: new BodyFxMode(sceneManager, 2), verticalLines: new SurfaceMode(sceneManager, appState, 0), scribbleGlitch: new ChaosMode(sceneManager, 0), numberGlitch: new ChaosMode(sceneManager, 1), chaosMix: new ChaosMode(sceneManager, 2), dualTexture: new SurfaceMode(sceneManager, appState, 2), dualTextureReverse: new SurfaceMode(sceneManager, appState, 3) };
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
controlPanel.onClearTrace = () => sceneManager.motionDelayPass.reset();
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
const foregroundControls = new BackgroundControls(foregroundLayer, () => (video.srcObject ? video : null), 'Foreground');
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
  if (foregroundLayer.mode === 'camera') foregroundControls.noneButton.click();
  else foregroundControls.cameraButton.click();
});
appRoot.appendChild(selfViewToggleButton);

const soundControls = new SoundControls(audioReactor);
soundControls.container.classList.add('control-bar-section');
controlBar.appendChild(soundControls.container);
const motionButton = document.createElement('button'); motionButton.className = 'background-button'; motionButton.textContent='Motion Sound Off';
motionButton.addEventListener('click', async () => { try { if(motionSound.enabled) motionSound.disable(); else await motionSound.enable(); motionButton.textContent=motionSound.enabled ? 'Motion Sound On':'Motion Sound Off'; } catch(e) { alert((e as Error).message); } });
soundControls.container.append(motionButton);
soundControls.container.append(new MotionSoundControls(motionSound).container);

let lastElapsed = 0;
let lastDt = 1 / 60;
const renderFrame = (): void => {
  const backgroundBodyEnergy = poseTracker.state.hasDetection ? poseTracker.state.energy : 0;
  motionSound.update(poseTracker.state);
  motionSound.mix(audioReactor.audioStream);
  const chaosActive = ['scribbleGlitch', 'numberGlitch', 'chaosMix'].includes(appState.mode);
  const pencilInk = chaosActive && appState.chaos.appearance === 'Graphite pencil';
  const inkOverride = chaosActive && appState.chaos.appearance !== 'Color';
  const monoPalette = ['White Paper / Black Ink', 'X-Ray Monochrome', 'Silver Static', 'Graphite Pencil'].includes(appState.paletteName);
  sceneManager.glassVolumePass.configure(appState.glassVolume, sceneManager.aspect, backgroundLayer.solidColor === 'white', appState.palette[3]!);
  sceneManager.objectLayers.setPalette(appState.palette[3]!);
  backgroundLayer.update(inkOverride ? pencilInk : monoPalette, inkOverride || appState.paletteName.startsWith('Paper /'));
  foregroundLayer.update();
  modeController.syncVisibility();
  controlPanel.syncVisibility();
  selfViewToggleButton.classList.toggle('active', foregroundLayer.mode === 'camera');

  if(audioReactor.isActive)audioReactor.update();
  syncVisualPose(visualPose,poseTracker.state,audioReactor.isActive?audioReactor.motionEnergy:0);
  soundControls.refreshSignal();
  backgroundLayer.updateGenerative(lastElapsed, poseTracker.state, backgroundBodyEnergy, audioReactor.isActive ? Math.max(audioReactor.level, audioReactor.kick) : 0);
  const audioBands = audioReactor.isActive
    ? { kick: audioReactor.kick, mid: audioReactor.mid, treble: audioReactor.treble }
    : { kick: 0, mid: 0, treble: 0 };
  switch (appState.mode) {
    case 'verticalLines': case 'scribbleGlitch': case 'numberGlitch': case 'chaosMix': case 'bodyFlames': case 'bodyRibbons': case 'bodyPrism': case 'geoPortal': case 'geoOrbits': case 'geoFracture': case 'dualTexture': case 'dualTextureReverse':
      surfaces[appState.mode].update(visualTracker, appState, lastElapsed); break;
    case 'fill':
      fillMode.update(visualTracker, appState, lastElapsed);
      break;
    case 'dance':
      danceMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'code':
      codeMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'codeInside':
      codeInsideMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'script':
      scriptMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'scriptInside':
      scriptInsideMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'nature':
      natureMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'lightning':
      lightningMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'abstractFill':
      abstractFillMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'abstractGrow':
      abstractGrowMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'dissolve':
      dissolveMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'dissolveLines':
      dissolveLinesMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'mandala':
      mandalaMode.update(visualTracker, appState, lastElapsed, audioBands);
      break;
    case 'pixelMelt':
      pixelMeltMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'glitch':
      glitchMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'glitchMono':
      glitchMonoMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'glitchLines':
      glitchLinesMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'distortGlitch':
      distortGlitchMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'chroma':
      chromaMode.update(visualTracker, appState, lastElapsed);
      break;
    case 'chromaGeo':
      chromaGeoMode.update(visualTracker, appState, lastElapsed);
      break;
    case 'sketch':
      sketchMode.update(visualTracker, appState, lastElapsed);
      break;
    case 'ripple':
      rippleMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
    case 'reveal':
      revealMode.update(visualTracker, appState, lastElapsed, lastDt);
      break;
  }
  foregroundLayer.setBodyIsolation(poseTracker.state,backgroundLayer.mode==='generative');
  sceneManager.motionDelayPass.configure(appState.motionDelay, JSON.stringify([appState.mode, appState.palette.map(c => c.getHexString()), appState.chaos.appearance, appState.chaos.coverage, backgroundLayer.mode, backgroundLayer.solidColor, backgroundLayer.placement, backgroundLayer.generator?.settings.bodyPlacement, backgroundLayer.generator?.settings.bodyDepth, foregroundLayer.mode, foregroundLayer.placement, appState.glassVolume.enabled]));
  sceneManager.glassVolumePass.configure(appState.glassVolume, sceneManager.aspect, backgroundLayer.solidColor === 'white', appState.palette[3]!);
  sceneManager.lineWeightPass.configure(appState.lineWeight);
  sceneManager.bodyVolumePass.configure(appState.bodyVolume,poseTracker.state,sceneManager.aspect);
  sceneManager.bodyContourPass.configure(appState.bodyContours,poseTracker.state,sceneManager.aspect,appState.palette[3]!,video);
  sceneManager.setMediaScopes(backgroundLayer.placement !== 'Full background', backgroundLayer.mode !== 'none' && backgroundLayer.mesh.visible, foregroundLayer.placement !== 'Full background', foregroundLayer.mode !== 'none' && foregroundLayer.mesh.visible, appState.glassVolume.enabled);
  sceneManager.render();
};

for (const mode of [pixelMeltMode, glitchMode, glitchMonoMode, glitchLinesMode, distortGlitchMode, rippleMode, revealMode]) clipMediaMaterial(mode.material, sceneManager.effectMediaUniforms);

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

const canvasColorControls=document.createElement('div');canvasColorControls.className='canvas-color-controls';
const canvasColorLabel=document.createElement('span');canvasColorLabel.textContent='Canvas';canvasColorControls.append(canvasColorLabel);
const canvasColorButtons=new Map<string,HTMLButtonElement>();
for(const color of ['white','black'] as const){
  const button=document.createElement('button');button.type='button';button.className='background-button';button.textContent=color==='white'?'White':'Black';
  button.setAttribute('aria-label',`Set canvas ${color}`);button.addEventListener('click',()=>backgroundLayer.setSolidColor(color));canvasColorControls.append(button);canvasColorButtons.set(color,button);
}
backgroundLayer.onCanvasColor(color=>{for(const [name,button] of canvasColorButtons){button.classList.toggle('active',name===color);button.setAttribute('aria-pressed',String(name===color));}});

new StudioLayout(appRoot, canvas, modeSwitcher.container, uiRoot, settingsToggleButton, presentationToggleButton,
  [video, pauseButton, selfViewToggleButton, cameraPicker.container],
  [backgroundControls.container, backgroundControls.backdropContainer, backgroundControls.editContainer],
  soundControls.container, recordingControls.container, statusEl, controlPanel, new ObjectLayerControls(sceneManager.objectLayers, () => foregroundControls.placeInsideVolumes()).container, [foregroundControls.container, foregroundControls.backdropContainer, foregroundControls.editContainer], canvasColorControls);

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
