/**
 * Fullscreen + hide-all-UI toggle for wall/projector performance — press F (or the small corner
 * toggle button, which itself hides once active) to fill the display with just the generative
 * visual, no menus/panels/webcam preview in the way. Press F again, or Escape (which exits
 * fullscreen natively and is caught here too), to bring everything back.
 */
export class PresentationMode {
  private active = false;

  constructor(toggleButton: HTMLButtonElement) {
    window.addEventListener('keydown', (e) => {
      // Ignore while typing in a text field (e.g. a Tweakpane color/text input) so 'f' types normally there.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key.toLowerCase() !== 'f') return;
      e.preventDefault();
      void this.toggle();
    });

    document.addEventListener('fullscreenchange', () => {
      // Exiting fullscreen via Escape/browser chrome (not our own toggle) should still bring the UI back.
      if (!document.fullscreenElement && this.active) this.setActive(false);
    });

    toggleButton.addEventListener('click', () => void this.toggle());
  }

  private async toggle(): Promise<void> {
    if (this.active) {
      this.setActive(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    } else {
      // Fullscreen can be denied/unsupported (notably iOS Safari) — still hide the UI either way,
      // just without OS-level fullscreen on platforms that refuse it.
      await document.documentElement.requestFullscreen?.().catch(() => undefined);
      this.setActive(true);
    }
  }

  private setActive(active: boolean): void {
    this.active = active;
    document.body.classList.toggle('presentation-mode', active);
  }
}
