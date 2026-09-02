// utils/notificationSound.js
//
// The notification chime, owned in one place.
//
// It used to live inside NotificationBell, which renders in DashboardHeader —
// and DashboardHeader is on exactly one page, while the sidebar is on 52. So
// the sound almost never played. Now both the sidebar and the bell call in
// here, and the id guard below means the same notification chimes once even
// when both are mounted.
//
// Browsers refuse to play audio until the user has interacted with the page,
// so the first click or keypress primes the element.

import notiSound from "../assets/notisound.wav";

const MUTE_KEY = "notifications:muted";

let audio = null;
let unlocked = false;

// Notifications already chimed for, so two mounted listeners cannot
// double-play. Bounded: a session does not need to remember forever.
const chimedFor = new Set();

const getAudio = () => {
  if (audio) return audio;
  try {
    audio = new Audio(notiSound);
    audio.preload = "auto";
  } catch {
    audio = null;
  }
  return audio;
};

export const isNotificationSoundMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === "true";
  } catch {
    return false;
  }
};

export const setNotificationSoundMuted = (muted) => {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "true" : "false");
  } catch {
    // Private mode: the preference just doesn't survive the session.
  }
};

/**
 * Prime the audio element on a user gesture. Safe to call repeatedly.
 * Without this the first real notification is swallowed by the browser's
 * autoplay policy.
 */
export const unlockNotificationSound = () => {
  if (unlocked) return;
  const element = getAudio();
  if (!element) return;

  element
    .play()
    .then(() => {
      element.pause();
      element.currentTime = 0;
      unlocked = true;
    })
    .catch(() => {
      // Still blocked — try again on the next gesture.
    });
};

/**
 * Play the chime for a notification.
 *
 * @param {string} [notificationId] - dedupe key. Two components listening for
 *   the same socket event pass the same id, so it only sounds once.
 * @returns {boolean} whether a sound was actually started
 */
export const playNotificationSound = (notificationId) => {
  if (isNotificationSoundMuted()) return false;

  if (notificationId) {
    if (chimedFor.has(notificationId)) return false;
    chimedFor.add(notificationId);
    if (chimedFor.size > 200) {
      // Keep the guard from growing without bound over a long session.
      chimedFor.delete(chimedFor.values().next().value);
    }
  }

  const element = getAudio();
  if (!element) return false;

  try {
    element.currentTime = 0;
    const played = element.play();
    if (played && typeof played.catch === "function") {
      played.catch(() => {
        // Blocked because the user has not interacted with the page yet.
        // The light still blinks, which is the part that must not fail.
      });
    }
    return true;
  } catch {
    return false;
  }
};
