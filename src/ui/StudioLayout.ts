/** Reparents the original controls without replacing their listeners or state. */
export class StudioLayout {
  constructor(app: HTMLElement, canvas: HTMLCanvasElement, modes: HTMLElement, parameters: HTMLElement,
    settingsButton: HTMLButtonElement, presentationButton: HTMLButtonElement, camera: HTMLElement[],
    background: HTMLElement[], sound: HTMLElement, recording: HTMLElement, status: HTMLElement) {
    app.classList.add('studio-layout');
    const stage = document.createElement('main'); stage.className = 'studio-stage';
    stage.setAttribute('aria-label', 'Live artwork preview'); stage.append(canvas); app.prepend(stage);
    const toolbar = document.createElement('header'); toolbar.className = 'studio-toolbar';
    const brand = document.createElement('strong'); brand.textContent = 'TRACEVERSE';
    const label = document.createElement('span'); label.textContent = 'Live studio';
    settingsButton.textContent = 'Hide controls'; settingsButton.setAttribute('aria-expanded', 'true');
    toolbar.append(brand, label, settingsButton, presentationButton); app.append(toolbar);
    const dock = document.createElement('aside'); dock.className = 'studio-dock'; dock.id = 'studio-controls';
    dock.setAttribute('aria-label', 'Studio controls'); settingsButton.setAttribute('aria-controls', dock.id);
    const section = (title: string, elements: HTMLElement[], open: boolean) => {
      const group = document.createElement('details'); group.className = 'studio-group'; group.open = open;
      const heading = document.createElement('summary'); heading.textContent = title;
      const content = document.createElement('div'); content.className = 'studio-group-content';
      content.append(...elements); group.append(heading, content); dock.append(group);
      return group;
    };
    section('Visual modes', [modes], true);
    const parameterGroup = section('Palette & effect settings', [parameters], false);
    section('Background & video', background, false);
    section('Sound & motion', [sound], false);
    section('Record & export', [recording], true);
    section('Camera & tracking', camera, false);
    app.append(dock);
    const footer = document.createElement('footer'); footer.className = 'studio-status'; footer.append(status); app.append(footer);
    settingsButton.addEventListener('click', () => {
      const hidden = app.classList.toggle('controls-hidden');
      settingsButton.textContent = hidden ? 'Show controls' : 'Hide controls';
      settingsButton.setAttribute('aria-expanded', String(!hidden));
    });
    // Keep mode-specific parameter folders reachable when a category changes.
    modes.addEventListener('click', () => { if (parameterGroup.open) parameters.scrollTop = 0; });
  }
}
