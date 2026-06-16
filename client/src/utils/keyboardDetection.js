// client/src/utils/keyboardDetection.js
/**
 * iOS keyboard detection
 * Adds/removes class when iOS keyboard appears
 */

export function initializeKeyboardDetection() {
  if (!/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return; // Only run on iOS
  }

  let lastHeight = window.innerHeight;

  const checkKeyboard = () => {
    const currentHeight = window.innerHeight;

    // Keyboard opened (viewport shrunk by more than 150px)
    if (currentHeight < lastHeight - 150) {
      document.body.classList.add('keyboard-visible');
    } else {
      document.body.classList.remove('keyboard-visible');
    }

    lastHeight = currentHeight;
  };

  // Check on resize
  window.addEventListener('resize', checkKeyboard);

  // Check on visual viewport resize (iOS specific)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', checkKeyboard);
  }
}
