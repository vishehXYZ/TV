import { Pane } from 'tweakpane';
import type { FolderApi } from 'tweakpane';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AppState, VisualMode } from '../core/AppState';
import { PALETTE_PRESETS } from '../core/AppState';

/** Tweakpane-based control panel: palette presets/custom colors + girih pattern parameters. Most
 * folders only affect specific modes (e.g. "Pattern (Abstract)" does nothing outside Abstract) — those
 * are hidden unless the matching mode is active, via syncVisibility(), so a slider that currently does
 * nothing isn't sitting on screen looking broken. */
export type ParameterSection = 'settings' | 'palette' | 'effects' | 'glow' | 'glass' | 'trace' | 'lines';

export class ControlPanel {
  private section: ParameterSection = 'effects';
  private sections: { folder: FolderApi; section: ParameterSection }[] = [];
  onClearTrace?: () => void;
  private emptyMessage: HTMLParagraphElement;
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
    this.emptyMessage = document.createElement('p');
    this.emptyMessage.className = 'studio-panel-hint';
    this.emptyMessage.textContent = 'This mode has no additional effect controls. Use Palette, Glow, Lines, Trace or Glass above.';
    container.append(this.emptyMessage);

    const paletteFolder = this.addSectionFolder('Palette', 'palette');

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
    const patternFolder = this.addSectionFolder('Pattern (Flurix)', 'effects');
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
    const lineWidthFolder = this.addSectionFolder('Line Width (Flurix + Luns)', 'effects');
    lineWidthFolder.addBinding(appState.girih, 'strokeWidth', { min: 0.01, max: 0.2, step: 0.005 });
    this.modeFolders.push({ folder: lineWidthFolder, modes: ['fill', 'dance'] });

    const sketchFolder = this.addSectionFolder('Line Thickness (Sketch)', 'effects');
    sketchFolder.addBinding(appState.sketch, 'lineThickness', { min: 0.3, max: 3, step: 0.05 });
    this.modeFolders.push({ folder: sketchFolder, modes: ['sketch'] });

    const scriptFolder = this.addSectionFolder('Script Style', 'effects');
    scriptFolder.addBinding(appState, 'scriptLanguage', {
      label: 'language',
      options: { Arabic: 'arabic', Hebrew: 'hebrew', Russian: 'russian', Japanese: 'japanese' },
    });
    scriptFolder.addBinding(appState, 'script3D', { label: '3D' });
    this.modeFolders.push({ folder: scriptFolder, modes: ['script', 'scriptInside'] });

    const abstractFolder = this.addSectionFolder('Pattern (Abstract)', 'effects');
    abstractFolder.addBinding(appState.abstract, 'scale', { min: 0.3, max: 4, step: 0.05 });
    abstractFolder.addBinding(appState.abstract, 'warpStrength', { min: 0, max: 5, step: 0.05 });
    abstractFolder.addBinding(appState.abstract, 'flowSpeed', { min: 0, max: 4, step: 0.05 });
    abstractFolder.addBinding(appState.abstract, 'bandCount', { min: 2, max: 16, step: 1 });
    abstractFolder.addBinding(appState.abstract, 'edgeSoftness', { min: 0.01, max: 0.5, step: 0.01 });
    this.modeFolders.push({ folder: abstractFolder, modes: ['abstractFill', 'abstractGrow'] });

    // A single post-process pass applied after every mode is composited, so this one control
    // tames "too much" glow/bloom everywhere at once instead of needing a knob per mode.
    const chaosFolder = this.addSectionFolder('Chaos', 'effects');
    chaosFolder.addBinding(appState.chaos, 'appearance', { label: 'Ink style', options: { Color: 'Color', 'Red ink': 'Red ink', 'Graphite pencil': 'Graphite pencil' } });
    chaosFolder.addBinding(appState.chaos, 'motion', { label: 'Body reaction', min: 0, max: 2, step: 0.1 });
    chaosFolder.addBinding(appState.chaos, 'showBody', { label: 'Body outline' });
    chaosFolder.addBinding(appState.chaos, 'cuts', { label: 'Glitch slices' });
    chaosFolder.addBinding(appState.chaos, 'coverage', { label: 'Coverage', options: { 'Full space': 'Full space', 'Full space + Body': 'Full space + Body', 'Inside body': 'Inside body' } });
    chaosFolder.addBinding(appState.chaos, 'usePalette', { label: 'Use selected palette' });
    chaosFolder.addBinding(appState.chaos, 'density', { min: 0.3, max: 2, step: 0.1 });
    chaosFolder.addBinding(appState.chaos, 'speed', { min: 0.2, max: 3, step: 0.1 });
    chaosFolder.addBinding(appState.chaos, 'glitch', { min: 0, max: 1, step: 0.05 });
    this.modeFolders.push({ folder: chaosFolder, modes: ['scribbleGlitch', 'numberGlitch', 'chaosMix'] });

    const bodyFolder = this.addSectionFolder('Body FX', 'effects');
    bodyFolder.addBinding(appState.bodyFx, 'usePalette', { label: 'Use selected palette' });
    bodyFolder.addBinding(appState.bodyFx, 'speed', { min: 0.2, max: 3, step: 0.1 });
    bodyFolder.addBinding(appState.bodyFx, 'intensity', { min: 0.3, max: 2, step: 0.1 });
    bodyFolder.addBinding(appState.bodyFx, 'scale', { min: 0.4, max: 2, step: 0.1 });
    this.modeFolders.push({ folder: bodyFolder, modes: ['bodyFlames', 'bodyRibbons', 'bodyPrism', 'geoPortal', 'geoOrbits', 'geoFracture'] });

    const lineFolder = this.addSectionFolder('Line weight (all modes)', 'lines');
    lineFolder.addBinding(appState, 'lineWeight', { label: 'Thickness', min: 0.3, max: 3, step: 0.05 });
    lineFolder.addButton({ title: 'Reset thickness' }).on('click', () => { appState.lineWeight = 1; this.pane.refresh(); });

    const glassFolder = this.addSectionFolder('Glass Volume (all modes)', 'glass');
    const glass = appState.glassVolume;
    glassFolder.addBinding(glass, 'enabled', { label: 'Enable glass' });
    glassFolder.addBinding(glass, 'shape', { label: 'Shape', options: { Egg: 'Egg', Sphere: 'Sphere', Box: 'Box' } });
    glassFolder.addBinding(glass, 'x', { label: 'Position X', min: -1, max: 1, step: 0.01 });
    glassFolder.addBinding(glass, 'y', { label: 'Position Y', min: -1, max: 1, step: 0.01 });
    for (const key of ['width', 'height', 'depth'] as const) glassFolder.addBinding(glass, key, { min: 0.2, max: 4, step: 0.05 });
    for (const key of ['rotateX', 'rotateY', 'rotateZ'] as const) glassFolder.addBinding(glass, key, { min: -180, max: 180, step: 1 });
    glassFolder.addBinding(glass, 'perspective', { label: '3D perspective', min: 0, max: 1, step: 0.05 });
    glassFolder.addBinding(glass, 'rearEdges', { label: 'Back edges', min: 0, max: 1, step: 0.05 });
    glassFolder.addBinding(glass, 'opacity', { label: 'Glass opacity', min: 0, max: 1, step: 0.05 });
    glassFolder.addBinding(glass, 'refraction', { label: 'Refraction', min: 0, max: 1, step: 0.05 });
    glassFolder.addBinding(glass, 'edge', { label: 'Edge strength', min: 0, max: 2, step: 0.05 });
    glassFolder.addBinding(glass, 'usePalette', { label: 'Use palette color' });
    glassFolder.addBinding(glass, 'color', { label: 'Custom glass color' }).on('change', () => { glass.usePalette = false; this.pane.refresh(); });
    glassFolder.addBinding(glass, 'clip', { label: 'Keep effects inside' });
    glassFolder.addButton({ title: 'Front view / show depth' }).on('click', () => {
      Object.assign(glass, { rotateX: 0, rotateY: 0, rotateZ: 0, perspective: 0.8, rearEdges: 0.55 });
      this.pane.refresh();
    });
    glassFolder.addButton({ title: 'Center / reset shape' }).on('click', () => {
      Object.assign(glass, { x: 0, y: 0, width: 1.3, height: 1.8, depth: 1, rotateX: 0, rotateY: 18, rotateZ: 0 });
      this.pane.refresh();
    });

    const delayFolder = this.addSectionFolder('Motion Trace / Delay (all modes)', 'trace');
    delayFolder.addBinding(appState.motionDelay, 'enabled', { label: 'Enable delay' });
    delayFolder.addBinding(appState.motionDelay, 'duration', { label: 'Trail seconds', min: 0.2, max: 5, step: 0.1 });
    delayFolder.addBinding(appState.motionDelay, 'strength', { label: 'Echo strength', min: 0, max: 1, step: 0.05 });
    delayFolder.addBinding(appState.motionDelay, 'echoes', { label: 'Echo copies', min: 2, max: 8, step: 1 });
    delayFolder.addButton({ title: 'Clear trace' }).on('click', () => this.onClearTrace?.());

    const glowFolder = this.addSectionFolder('Glow (all modes)', 'glow');
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
    for (const entry of this.sections) {
      const modeRule = this.modeFolders.find(item => item.folder === entry.folder);
      const inSection = this.section === 'settings' ? entry.section !== 'glass' : entry.section === this.section;
      entry.folder.hidden = !inSection || !!(modeRule && !modeRule.modes.includes(this.appState.mode));
    }
    this.emptyMessage.hidden = this.sections.some(entry => !entry.folder.hidden);
  }

  private addSectionFolder(title: string, section: ParameterSection): FolderApi {
    const folder = this.pane.addFolder({ title, expanded: true });
    this.sections.push({ folder, section });
    return folder;
  }

  showSection(section: ParameterSection): void {
    this.section = section;
    this.lastMode = null;
    for (const item of this.sections) if (item.section === section || (section === 'settings' && item.section !== 'glass')) item.folder.expanded = true;
    this.syncVisibility();
  }

  private syncPaletteHex(): void {
    ['c0', 'c1', 'c2', 'c3', 'c4'].forEach((key, i) => {
      this.paletteHex[key] = `#${this.appState.palette[i]!.getHexString()}`;
    });
  }
}
