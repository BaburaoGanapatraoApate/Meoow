/**
 * Click-through management.
 * On Windows, setting ignoreMouseEvents(true) applies WS_EX_TRANSPARENT,
 * which blocks all mouse clicks (WM_LBUTTONDOWN) and causes buttons like
 * End, Analyze, and Menu to fail.
 * We ensure the window remains 100% interactive and clickable at all times.
 */
export function setupClickThrough(_active = false): () => void {
  window.meow?.setIgnoreMouseEvents?.(false);
  return () => {
    window.meow?.setIgnoreMouseEvents?.(false);
  };
}

