/** Keep fixed game UI inside the visible screen when browser chrome or the keyboard moves. */
export function fitVisibleViewport(): void {
  const update = () => {
    const viewport = window.visualViewport;
    const height = viewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    document.documentElement.style.setProperty('--app-top', `${viewport?.offsetTop ?? 0}px`);
  };
  update();
  window.addEventListener('resize', update, { passive: true });
  window.visualViewport?.addEventListener('resize', update, { passive: true });
  window.visualViewport?.addEventListener('scroll', update, { passive: true });
}
