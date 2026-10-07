import type { AppState, VisualMode } from '../core/AppState';

interface StyleOption {
  id: VisualMode;
  styleLabel: string;
}

interface ModeCategory {
  label: string;
  styles: StyleOption[];
}

/**
 * One button per creative category in the main row. Categories with more
 * than one visual flavor (e.g. Luns: Star/Orb, Glitch: Color/Mono/Analog/
 * Pixelated) show a second row of clearly labeled option pills right below
 * the main row — all options visible and directly clickable, not hidden
 * behind repeated clicks on the same button.
 */
const CATEGORIES: ModeCategory[] = [
  {label:'Vertical', styles:[{id:'verticalLines',styleLabel:'Sharp Lines'}]},
  {label:'Chaos', styles:[{id:'scribbleGlitch',styleLabel:'Scribbles'},{id:'numberGlitch',styleLabel:'Numbers'},{id:'chaosMix',styleLabel:'Mixed'}]},
  {label:'Textures', styles:[{id:'dualTexture',styleLabel:'Lines / Dots'},{id:'dualTextureReverse',styleLabel:'Dots / Crosses'}]},
  { label: 'Flurix', styles: [{ id: 'fill', styleLabel: 'Flurix' }] },
  {
    label: 'Luns',
    styles: [
      { id: 'dance', styleLabel: 'Star' },
      { id: 'nature', styleLabel: 'Orb' },
    ],
  },
  {
    label: 'Code',
    styles: [
      { id: 'code', styleLabel: 'Outside' },
      { id: 'codeInside', styleLabel: 'Inside' },
    ],
  },
  {
    label: 'Script',
    styles: [
      { id: 'script', styleLabel: 'Outside' },
      { id: 'scriptInside', styleLabel: 'Inside' },
    ],
  },
  { label: 'Astrix', styles: [{ id: 'lightning', styleLabel: 'Astrix' }] },
  {
    label: 'Abstract',
    styles: [
      { id: 'abstractFill', styleLabel: 'Fill' },
      { id: 'abstractGrow', styleLabel: 'Grow' },
    ],
  },
  { label: 'Shatter', styles: [{ id: 'dissolveLines', styleLabel: 'Shatter' }] },
  { label: 'Cellis', styles: [{ id: 'dissolve', styleLabel: 'Cellis' }] },
  {
    label: 'Marble',
    styles: [
      { id: 'chroma', styleLabel: 'Liquid' },
      { id: 'chromaGeo', styleLabel: 'Geometric' },
    ],
  },
  { label: 'Sketch', styles: [{ id: 'sketch', styleLabel: 'Sketch' }] },
  { label: 'Mandala', styles: [{ id: 'mandala', styleLabel: 'Mandala' }] },
  {
    label: 'Glitch',
    styles: [
      { id: 'glitch', styleLabel: 'Color' },
      { id: 'glitchMono', styleLabel: 'Static' },
      { id: 'distortGlitch', styleLabel: 'Analog' },
      { id: 'pixelMelt', styleLabel: 'Pixelated' },
      { id: 'glitchLines', styleLabel: 'Lines' },
    ],
  },
  { label: 'Ripple', styles: [{ id: 'ripple', styleLabel: 'Ripple' }] },
  { label: 'Reveal', styles: [{ id: 'reveal', styleLabel: 'Reveal' }] },
];

/** Prominent tab row for switching visual modes live, with a second
 * options row for categories that have more than one style. */
export class ModeSwitcher {
  readonly container: HTMLDivElement;

  constructor(appState: AppState) {
    this.container = document.createElement('div');
    this.container.className = 'mode-switcher-wrapper';

    const row = document.createElement('div');
    row.className = 'mode-switcher';

    const styleBar = document.createElement('div');
    styleBar.className = 'mode-style-bar';

    const buttons: HTMLButtonElement[] = [];
    // Which style within each category is currently selected — preserved
    // per-category so returning to it later remembers your last choice.
    const styleIndices: number[] = CATEGORIES.map(() => 0);

    const findCategoryIndexForMode = (mode: VisualMode): number =>
      CATEGORIES.findIndex((c) => c.styles.some((s) => s.id === mode));

    const initialCategory = findCategoryIndexForMode(appState.mode);
    if (initialCategory >= 0) {
      styleIndices[initialCategory] = CATEGORIES[initialCategory]!.styles.findIndex((s) => s.id === appState.mode);
    }

    const refreshActiveStates = (): void => {
      const currentCategory = findCategoryIndexForMode(appState.mode);
      for (let i = 0; i < buttons.length; i++) {
        buttons[i]!.classList.toggle('active', i === currentCategory);
      }
    };

    const renderStyleBar = (categoryIndex: number): void => {
      styleBar.innerHTML = '';
      const category = CATEGORIES[categoryIndex]!;
      if (category.styles.length <= 1) {
        styleBar.style.display = 'none';
        return;
      }
      styleBar.style.display = 'flex';
      category.styles.forEach((style, styleIdx) => {
        const pill = document.createElement('button');
        pill.className = 'style-pill';
        pill.textContent = style.styleLabel;
        if (styleIndices[categoryIndex] === styleIdx) pill.classList.add('active');
        pill.addEventListener('click', () => {
          styleIndices[categoryIndex] = styleIdx;
          appState.mode = style.id;
          renderStyleBar(categoryIndex);
          refreshActiveStates();
        });
        styleBar.appendChild(pill);
      });
    };

    CATEGORIES.forEach((category, i) => {
      const btn = document.createElement('button');
      btn.className = 'mode-button';
      btn.textContent = category.label;

      if (category.styles[styleIndices[i]!]!.id === appState.mode) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        appState.mode = category.styles[styleIndices[i]!]!.id;
        refreshActiveStates();
        renderStyleBar(i);
      });

      buttons.push(btn);
      row.appendChild(btn);
    });

    this.container.appendChild(row);
    this.container.appendChild(styleBar);

    renderStyleBar(initialCategory >= 0 ? initialCategory : 0);
  }
}
