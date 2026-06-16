// client/src/utils/viewportHeight.js
/**
 * iOS-safe viewport height management
 * Handles iOS Safari's dynamic viewport (address bar show/hide)
 */

export function initializeViewportHeight() {
  // Set custom CSS property for real viewport height
  function setVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }

  // Set on load
  setVH();

  // Update on resize (throttled to avoid performance issues)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(setVH, 100);
  });

  // Update on orientation change
  window.addEventListener('orientationchange', () => {
    // Delay to ensure new dimensions are available
    setTimeout(setVH, 100);
  });

  // iOS-specific: update when viewport changes
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setVH);
  }
}
