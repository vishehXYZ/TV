import type { AppState } from '../core/AppState';
import type { FillMode } from './FillMode';
import type { DanceMode } from './DanceMode';
import type { CodeMode } from './CodeMode';
import type { NatureMode } from './NatureMode';
import type { LightningMode } from './LightningMode';
import type { AbstractFillMode } from './AbstractFillMode';
import type { AbstractGrowMode } from './AbstractGrowMode';
import type { DissolveMode } from './DissolveMode';
import type { DissolveLinesMode } from './DissolveLinesMode';
import type { MandalaMode } from './MandalaMode';
import type { PixelMeltMode } from './PixelMeltMode';
import type { GlitchMode } from './GlitchMode';
import type { GlitchMonoMode } from './GlitchMonoMode';
import type { GlitchLinesMode } from './GlitchLinesMode';
import type { DistortGlitchMode } from './DistortGlitchMode';
import type { ChromaMode } from './ChromaMode';
import type { ChromaGeoMode } from './ChromaGeoMode';
import type { SketchMode } from './SketchMode';
import type { RippleMode } from './RippleMode';
import type { RevealMode } from './RevealMode';

interface Visible {
  setVisible(visible: boolean): void;
}

/** Switches visibility across the visual modes based on AppState.mode. */
export class ModeController {
  private appState: AppState;
  private modes: Record<AppState['mode'], Visible>;
  private lastApplied: string | null = null;

  constructor(
    appState: AppState,
    fillMode: FillMode,
    danceMode: DanceMode,
    codeMode: CodeMode,
    codeInsideMode: CodeMode,
    scriptMode: CodeMode,
    scriptInsideMode: CodeMode,
    natureMode: NatureMode,
    lightningMode: LightningMode,
    abstractFillMode: AbstractFillMode,
    abstractGrowMode: AbstractGrowMode,
    dissolveMode: DissolveMode,
    dissolveLinesMode: DissolveLinesMode,
    mandalaMode: MandalaMode,
    pixelMeltMode: PixelMeltMode,
    glitchMode: GlitchMode,
    glitchMonoMode: GlitchMonoMode,
    glitchLinesMode: GlitchLinesMode,
    distortGlitchMode: DistortGlitchMode,
    chromaMode: ChromaMode,
    chromaGeoMode: ChromaGeoMode,
    sketchMode: SketchMode,
    rippleMode: RippleMode,
    revealMode: RevealMode,
    extraModes: Pick<Record<AppState['mode'], Visible>, 'verticalLines' | 'scribbleGlitch' | 'numberGlitch' | 'chaosMix' | 'bodyFlames' | 'bodyRibbons' | 'bodyPrism' | 'geoPortal' | 'geoOrbits' | 'geoFracture' | 'dualTexture' | 'dualTextureReverse'>,
  ) {
    this.appState = appState;
    this.modes = {
      fill: fillMode,
      dance: danceMode,
      code: codeMode,
      codeInside: codeInsideMode,
      script: scriptMode,
      scriptInside: scriptInsideMode,
      nature: natureMode,
      lightning: lightningMode,
      abstractFill: abstractFillMode,
      abstractGrow: abstractGrowMode,
      dissolve: dissolveMode,
      dissolveLines: dissolveLinesMode,
      mandala: mandalaMode,
      pixelMelt: pixelMeltMode,
      glitch: glitchMode,
      glitchMono: glitchMonoMode,
      glitchLines: glitchLinesMode,
      distortGlitch: distortGlitchMode,
      chroma: chromaMode,
      chromaGeo: chromaGeoMode,
      sketch: sketchMode,
      ripple: rippleMode,
      reveal: revealMode,
      ...extraModes,
    };
  }

  /** Applies the current mode's visibility if it changed since the last call. */
  syncVisibility(): void {
    if (this.appState.mode === this.lastApplied) return;
    this.lastApplied = this.appState.mode;
    for (const [id, mode] of Object.entries(this.modes)) {
      mode.setVisible(id === this.appState.mode);
    }
  }
}
