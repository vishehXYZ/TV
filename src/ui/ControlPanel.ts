import { Pane } from 'tweakpane';
import type { FolderApi } from 'tweakpane';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AppState, VisualMode } from '../core/AppState';
import { PALETTE_PRESETS } from '../core/AppState';

/** Tweakpane-based control panel: palette presets/custom colors + girih pattern parameters. Most
 * folders only affect specific modes (e.g. "Pattern (Abstract)" does nothing outside Abstract) — those
 * are hidden unless the matching mode is active, via syncVisibility(), so a slider that currently does
 * nothing isn't sitting on screen looking broken. */
export class ControlPanel {
  private pane: Pane;
  private paletteHex: Record<string, string>;
  private appState: AppState;
  /** Folders paired with the modes they actually affect — always-relevant folders (Palette, Glow) are
   * omitted here and simply never hidden. */
  private modeFolders: { folder: FolderApi; modes: VisualMode[] }[] = [];
  private lastMode: VisualMode | null = null;

  constructor(container: HTMLElement, appState: AppState, bloomPass: UnrealBloomPass) {
    this.appState = appState;
    this.pane = new Pane({ container, title: 'Instrument' });

    const paletteFolder = this.pane.addFolder({ title: 'Palette' });

    paletteFolder
      .addBinding({ preset: appState.paletteName }, 'preset', {
        options: Object.fromEntries(PALETTE_PRESETS.map((p) => [p.name, p.name])),
      })
      .on('change', (ev) => {
        appState.setPreset(ev.value);
        this.syncPaletteHex();
        this.pane.refresh();
      });

    this.paletteHex = {
      c0: `#${appState.palette[0]!.getHexString()}`,
      c1: `#${appState.palette[1]!.getHexString()}`,
      c2: `#${appState.palette[2]!.getHexString()}`,
      c3: `#${appState.palette[3]!.getHexString()}`,
      c4: `#${appState.palette[4]!.getHexString()}`,
    };

    ['c0', 'c1', 'c2', 'c3', 'c4'].forEach((key, i) => {
      paletteFolder.addBinding(this.paletteHex, key as keyof typeof this.paletteHex, { label: `stop ${i + 1}` }).on(
        'change',
        (ev) => {
          this.appState.setCustomColor(i, ev.value as string);
        },
      );
    });

    // Only Flurix actually reads these — Luns/Code never did, despite the old folder title implying otherwise.
    const patternFolder = this.pane.addFolder({ title: 'Pattern (Flurix)' });
    patternFolder.addBinding(appState.girih, 'density', { min: 2, max: 16, step: 0.5 });
    patternFolder.addBinding(appState.girih, 'symmetry', { min: 5, max: 14, step: 1 });
    patternFolder.addBinding(appState.girih, 'sharpness', { min: 0.5, max: 6, step: 0.1 });
    patternFolder.addBinding(appState.girih, 'innerRatio', { min: 0.1, max: 0.8, step: 0.01 });
    patternFolder.addBinding(appState.girih, 'warpStrength', { min: 0, max: 10, step: 0.1 });
    patternFolder.addBinding(appState.girih, 'maskFeather', { min: 0.01, max: 0.3, step: 0.01 });
    this.modeFolders.push({ folder: patternFolder, modes: ['fill'] });

    // strokeWidth is the one girih param Luns' star motif also reads (see DanceMode) — split out
    // into its own honestly-labeled folder rather than living in a "Fill/Dance/Code" folder where
    // it was the only slider out of seven that actually did anything for a second mode.
    const lineWidthFolder = this.pane.addFolder({ title: 'Line Width (Flurix + Luns)' });
    lineWidthFolder.addBinding(appState.girih, 'strokeWidth', { min: 0.01, max: 0.2, step: 0.005 });
    this.modeFolders.push({ folder: lineWidthFolder, modes: ['fill', 'dance'] });

    const sketchFolder = this.pane.addFolder({ title: 'Line Thickness (Sketch)' });
    sketchFolder.addBinding(appState.sketch, 'lineThickness', { min: 0.3, max: 3, step: 0.05 });
    this.modeFolders.push({ folder: sketchFolder, modes: ['sketch'] });

    const scriptFolder = this.pane.addFolder({ title: 'Script Style' });
    scriptFolder.addBinding(appState, 'scriptLanguage', {
      label: 'language',
      options: { Arabic: 'arabic', Hebrew: 'hebrew', Russian: 'russian', Japanese: 'japanese' },
    });
    scriptFolder.addBinding(appState, 'script3D', { label: '3D' });
    this.modeFolders.push({ folder: scriptFolder, modes: ['script', 'scriptInside'] });

    const abstractFolder = this.pane.addFolder({ title: 'Pattern (Abstract)' });
    abstractFolder.addBinding(appState.abstract, 'scale', { min: 0.3, max: 4, step: 0.05 });
    abstractFolder.addBinding(appState.abstract, 'warpStrength', { min: 0, max: 5, step: 0.05 });
    abstractFolder.addBinding(appState.abstract, 'flowSpeed', { min: 0, max: 4, step: 0.05 });
    abstractFolder.addBinding(appState.abstract, 'bandCount', { min: 2, max: 16, step: 1 });
    abstractFolder.addBinding(appState.abstract, 'edgeSoftness', { min: 0.01, max: 0.5, step: 0.01 });
    this.modeFolders.push({ folder: abstractFolder, modes: ['abstractFill', 'abstractGrow'] });

    // A single post-process pass applied after every mode is composited, so this one control
    // tames "too much" glow/bloom everywhere at once instead of needing a knob per mode.
    const chaosFolder = this.pane.addFolder({ title: 'Chaos' });
    chaosFolder.addBinding(appState.chaos, 'usePalette', { label: 'Use selected palette' });
    chaosFolder.addBinding(appState.chaos, 'density', { min: 0.3, max: 2, step: 0.1 });
    chaosFolder.addBinding(appState.chaos, 'speed', { min: 0.2, max: 3, step: 0.1 });
    chaosFolder.addBinding(appState.chaos, 'glitch', { min: 0, max: 1, step: 0.05 });
    this.modeFolders.push({ folder: chaosFolder, modes: ['scribbleGlitch', 'numberGlitch', 'chaosMix'] });

    const glowFolder = this.pane.addFolder({ title: 'Glow (all modes)' });
    glowFolder.addBinding(bloomPass, 'strength', { min: 0, max: 3, step: 0.05, label: 'intensity' });
    glowFolder.addBinding(bloomPass, 'radius', { min: 0, max: 1, step: 0.01, label: 'spread' });
    glowFolder.addBinding(bloomPass, 'threshold', { min: 0, max: 1, step: 0.01, label: 'threshold' });

    this.syncVisibility();
  }

  /** Hides folders whose sliders don't affect the currently active mode, so nothing sits on screen
   * looking like a "broken" control when it simply doesn't apply right now. Cheap no-op most frames
   * since it only touches anything when the mode has actually changed. */
  syncVisibility(): void {
    if (this.appState.mode === this.lastMode) return;
    this.lastMode = this.appState.mode;
    for (const { folder, modes } of this.modeFolders) {
      folder.hidden = !modes.includes(this.appState.mode);
    }
  }

  private syncPaletteHex(): void {
    ['c0', 'c1', 'c2', 'c3', 'c4'].forEach((key, i) => {
      this.paletteHex[key] = `#${this.appState.palette[i]!.getHexString()}`;
    });
  }
}
