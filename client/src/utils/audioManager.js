/**
 * iOS-safe AudioContext management
 * Handles iOS user interaction requirement and lifecycle
 */

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;

    try {
      // Create AudioContext (webkit prefix for older iOS)
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn('AudioContext not supported');
        return false;
      }

      this.audioContext = new AudioContext();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('AudioContext initialization failed:', error);
      return false;
    }
  }

  async resume() {
    if (!this.audioContext) return false;

    try {
      // iOS requires user interaction to resume AudioContext
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      return this.audioContext.state === 'running';
    } catch (error) {
      console.error('AudioContext resume failed:', error);
      return false;
    }
  }

  async playNotificationSound() {
    // Initialize if needed
    if (!this.initialized) {
      await this.initialize();
    }

    // Resume if suspended (iOS requirement)
    const resumed = await this.resume();
    if (!resumed) {
      console.warn('AudioContext not ready');
      return;
    }

    try {
      // Create oscillator for notification sound
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Sound parameters
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.3
      );

      // Play sound
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  close() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
export const audioManager = new AudioManager();

/**
 * Initialize audio on first user interaction (iOS requirement)
 * Call this once at app startup
 */
export function initializeAudioOnUserInteraction() {
  const events = ['touchstart', 'click', 'keydown'];

  function handler() {
    audioManager.initialize();
    // Remove listeners after first interaction
    events.forEach(event => {
      document.removeEventListener(event, handler);
    });
  }

  events.forEach(event => {
    document.addEventListener(event, handler, { once: true, passive: true });
  });
}
