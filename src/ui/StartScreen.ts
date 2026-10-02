/**
 * Full-screen landing overlay shown before the instrument starts — app name, a short description,
 * and the single "Connect to Camera" call-to-action, with a visible privacy note underneath. Shown
 * first (not a small corner button after a busy canvas/UI), matching the reference app's landing
 * pattern, and doubles as the thing that keeps the cluttered live-performance UI hidden until the
 * user has actually opted in.
 */
export class StartScreen {
  readonly container: HTMLDivElement;
  readonly connectButton: HTMLButtonElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'start-screen';

    const title = document.createElement('div');
    title.className = 'start-screen-title';
    title.textContent = 'TRACEVERSE';

    const tagline = document.createElement('p');
    tagline.className = 'start-screen-tagline';
    tagline.textContent = 'Turn your body and music into generative art, live.';

    const instructions = document.createElement('p');
    instructions.className = 'start-screen-instructions';
    instructions.textContent =
      'Step back so your full body is in frame · Move to shape the pattern · Switch modes any time · F fullscreen';

    this.connectButton = document.createElement('button');
    this.connectButton.className = 'start-screen-button';
    this.connectButton.textContent = 'Connect to Camera';

    const privacy = document.createElement('p');
    privacy.className = 'start-screen-privacy';
    privacy.innerHTML = '🔒 Your camera never leaves your device. Nothing is uploaded, recorded, or saved.';

    this.container.append(title, tagline, instructions, this.connectButton, privacy);
  }

  hide(): void {
    this.container.remove();
  }
}
