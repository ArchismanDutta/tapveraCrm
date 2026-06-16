# iOS Compatibility Guide

## Overview

This guide documents iOS-specific compatibility solutions implemented in the TapVera CRM application. iOS Safari presents unique challenges for web applications, particularly around viewport handling, fixed positioning, touch interactions, and storage limitations.

This documentation covers the utilities, patterns, and best practices for ensuring a smooth user experience on iOS devices.

## Problem Summary

iOS Safari has several known issues that affect web applications:

1. **Viewport Height Issues**: The viewport height changes dynamically as Safari's UI elements (address bar, toolbar) appear and disappear during scrolling
2. **Fixed Positioning**: Elements with `position: fixed` can behave erratically, especially when the keyboard is visible
3. **Touch Event Handling**: iOS handles touch events differently than other platforms, requiring special consideration
4. **Storage Limitations**: LocalStorage can throw exceptions in private browsing mode
5. **Audio Playback**: iOS has strict policies around audio autoplay and requires user interaction
6. **Scroll Behavior**: iOS uses momentum scrolling which can conflict with custom scroll implementations

## Solutions Implemented

### 1. Viewport Height Utility (`src/utils/iosViewportHeight.js`)

**Purpose**: Provides accurate viewport height measurements that account for iOS Safari's dynamic UI.

**Key Features**:
- Sets CSS custom property `--vh` for reliable height calculations
- Handles resize and orientation change events
- Accounts for virtual keyboard appearance/disappearance
- Provides stable measurements during scrolling

**Usage**:

```javascript
import { initViewportHeight } from '@/utils/iosViewportHeight';

// Initialize on app startup (typically in App.jsx or main.jsx)
useEffect(() => {
  const cleanup = initViewportHeight();
  return cleanup;
}, []);
```

**CSS Usage**:

```css
/* Instead of using 100vh directly */
.fullscreen-element {
  /* height: 100vh; */ /* DON'T USE THIS */
  height: calc(var(--vh, 1vh) * 100); /* USE THIS */
}

/* For iOS-specific adjustments */
@supports (-webkit-touch-callout: none) {
  .ios-specific {
    height: calc(var(--vh, 1vh) * 100);
  }
}
```

**API**:

- `initViewportHeight()`: Initializes the viewport height tracking and returns a cleanup function
- Updates `--vh` CSS custom property on document root
- Automatically handles all viewport changes

### 2. iOS Fixed Positioning Utility (`src/utils/iosFixedPosition.js`)

**Purpose**: Manages fixed positioning behavior and keyboard detection on iOS.

**Key Features**:
- Detects keyboard visibility state
- Provides iOS platform detection
- Manages body scroll locking for modals/overlays
- Handles safe area insets

**Usage**:

```javascript
import {
  isKeyboardVisible,
  isIOS,
  lockBodyScroll,
  unlockBodyScroll
} from '@/utils/iosFixedPosition';

// Check if keyboard is visible
if (isKeyboardVisible()) {
  // Adjust UI for keyboard
}

// Lock scrolling (e.g., when modal is open)
useEffect(() => {
  if (modalOpen) {
    lockBodyScroll();
    return unlockBodyScroll;
  }
}, [modalOpen]);

// iOS-specific rendering
{isIOS() && <IOSSpecificComponent />}
```

**API**:

- `isIOS()`: Returns `true` if running on iOS
- `isKeyboardVisible()`: Returns `true` if virtual keyboard is currently visible
- `lockBodyScroll()`: Prevents body scrolling (for modals/overlays)
- `unlockBodyScroll()`: Restores body scrolling
- `getScrollbarWidth()`: Returns scrollbar width (0 on iOS)

### 3. Safe Storage Utility (`src/utils/safeStorage.js`)

**Purpose**: Provides safe localStorage access that handles iOS private browsing mode and quota exceptions.

**Key Features**:
- Try-catch wrappers around all storage operations
- Graceful fallback when storage is unavailable
- Consistent API with native localStorage
- Handles quota exceeded errors
- Memory fallback for private browsing mode

**Usage**:

```javascript
import safeStorage from '@/utils/safeStorage';

// Set item (returns boolean indicating success)
const success = safeStorage.setItem('user_preference', 'value');
if (!success) {
  console.warn('Failed to save preference');
}

// Get item (returns null if unavailable)
const value = safeStorage.getItem('user_preference');

// Remove item
safeStorage.removeItem('user_preference');

// Clear all
safeStorage.clear();

// Check availability
if (safeStorage.isAvailable()) {
  // Storage is working
}
```

**API**:

- `setItem(key, value)`: Stores a value, returns `true` on success, `false` on failure
- `getItem(key)`: Retrieves a value, returns `null` if not found or on error
- `removeItem(key)`: Removes a value
- `clear()`: Removes all stored values
- `isAvailable()`: Returns `true` if storage is functional

**Error Handling**:

```javascript
// The utility handles these iOS-specific errors:
// - QuotaExceededError (storage full)
// - SecurityError (private browsing mode)
// - Other storage exceptions

// All methods fail gracefully and log warnings
const saved = safeStorage.setItem('key', largeValue);
if (!saved) {
  // Handle failure - maybe show user message
  // or use alternative storage strategy
}
```

### 4. Audio Manager Utility (`src/utils/audioManager.js`)

**Purpose**: Manages audio playback with iOS-specific restrictions and autoplay policies.

**Key Features**:
- Handles iOS audio unlock requirement
- Manages audio sprite loading and playback
- Provides promise-based API
- Graceful fallback when audio unavailable
- Automatic cleanup and resource management

**Usage**:

```javascript
import audioManager from '@/utils/audioManager';

// Initialize audio system (call after user interaction)
audioManager.init();

// Load audio files
audioManager.loadSound('notification', '/sounds/notification.mp3');
audioManager.loadSound('success', '/sounds/success.mp3');

// Play sound
audioManager.playSound('notification');

// Play with options
audioManager.playSound('success', {
  volume: 0.5,
  loop: false
});

// Cleanup
audioManager.cleanup();
```

**iOS-Specific Behavior**:

```javascript
// On iOS, audio must be unlocked by user interaction
function handleFirstUserInteraction() {
  audioManager.init(); // Call this on first click/touch
}

// The audio manager handles iOS restrictions internally
// No audio will play until after user interaction
```

**API**:

- `init()`: Initializes audio system (call after user interaction on iOS)
- `loadSound(id, url)`: Loads an audio file
- `playSound(id, options)`: Plays a loaded sound
- `stopSound(id)`: Stops a playing sound
- `setVolume(id, volume)`: Sets volume (0.0 to 1.0)
- `cleanup()`: Releases all audio resources

### 5. Webkit Scrolling Styles (`src/styles/iosScrolling.css`)

**Purpose**: Provides CSS utilities for smooth, native-feeling scrolling on iOS.

**Key Features**:
- Enables momentum scrolling
- Prevents scroll chaining
- Handles overscroll behavior
- Optimizes touch interactions

**Usage**:

```css
/* Import in your global styles or component */
@import '@/styles/iosScrolling.css';
```

```jsx
// Apply to scrollable containers
<div className="ios-scroll">
  {/* Scrollable content */}
</div>

// For contained scrolling (prevents scroll chaining)
<div className="ios-scroll-contained">
  {/* Scrollable content */}
</div>

// For momentum scrolling without overscroll
<div className="ios-scroll-no-overscroll">
  {/* Scrollable content */}
</div>
```

**CSS Classes**:

- `.ios-scroll`: Basic momentum scrolling
- `.ios-scroll-contained`: Prevents scroll from bubbling to parent
- `.ios-scroll-no-overscroll`: Disables bounce effect at scroll boundaries

**Manual CSS Application**:

```css
.custom-scroller {
  -webkit-overflow-scrolling: touch; /* Enable momentum */
  overscroll-behavior: contain; /* Prevent scroll chaining */
}
```

### 6. Z-Index Scale (`src/styles/zIndexScale.css`)

**Purpose**: Provides a standardized z-index scale to prevent layering issues.

**Key Features**:
- Consistent layering across the application
- Prevents z-index conflicts
- iOS-safe values (avoids very high z-index issues)
- Semantic naming

**Usage**:

```css
/* Import in your global styles */
@import '@/styles/zIndexScale.css';
```

```css
/* Use CSS custom properties for z-index values */
.modal {
  z-index: var(--z-modal); /* 1000 */
}

.dropdown {
  z-index: var(--z-dropdown); /* 500 */
}

.fixed-header {
  z-index: var(--z-header); /* 100 */
}

.tooltip {
  z-index: var(--z-tooltip); /* 1500 */
}
```

**Available Z-Index Levels**:

- `--z-base`: 1 (Base level)
- `--z-dropdown`: 500 (Dropdowns, popovers)
- `--z-sticky`: 100 (Sticky headers, footers)
- `--z-header`: 100 (Fixed headers)
- `--z-overlay`: 800 (Overlays, backdrops)
- `--z-modal`: 1000 (Modals, dialogs)
- `--z-popover`: 1200 (Popovers over modals)
- `--z-tooltip`: 1500 (Tooltips)
- `--z-notification`: 2000 (Toast notifications)

## Best Practices

### Viewport Height

**DO:**

```jsx
// Initialize viewport height utility
useEffect(() => {
  const cleanup = initViewportHeight();
  return cleanup;
}, []);

// Use CSS custom property
const styles = {
  height: 'calc(var(--vh, 1vh) * 100)'
};
```

**DON'T:**

```jsx
// Don't use 100vh directly on iOS-critical elements
const styles = {
  height: '100vh' // This will jump when Safari UI changes
};
```

### Fixed Positioning

**DO:**

```jsx
import { lockBodyScroll, unlockBodyScroll } from '@/utils/iosFixedPosition';

function Modal({ isOpen }) {
  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      return unlockBodyScroll;
    }
  }, [isOpen]);

  return (
    <div className="modal" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 'var(--z-modal)'
    }}>
      {/* Modal content */}
    </div>
  );
}
```

**DON'T:**

```jsx
// Don't use fixed positioning without scroll lock
function Modal() {
  return (
    <div style={{ position: 'fixed' }}>
      {/* Content - body can still scroll underneath */}
    </div>
  );
}
```

### Storage

**DO:**

```jsx
import safeStorage from '@/utils/safeStorage';

function saveUserPreference(key, value) {
  const success = safeStorage.setItem(key, value);
  if (!success) {
    // Fallback strategy
    showNotification('Unable to save preference');
  }
  return success;
}
```

**DON'T:**

```jsx
// Don't use localStorage directly
function saveUserPreference(key, value) {
  localStorage.setItem(key, value); // Can throw in iOS private mode
}
```

### Audio

**DO:**

```jsx
import audioManager from '@/utils/audioManager';

function GameComponent() {
  useEffect(() => {
    // Initialize on mount
    audioManager.init();
    audioManager.loadSound('click', '/sounds/click.mp3');

    return () => audioManager.cleanup();
  }, []);

  const handleClick = () => {
    audioManager.playSound('click');
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

**DON'T:**

```jsx
// Don't play audio without initialization
const audio = new Audio('/sound.mp3');
audio.play(); // Will fail on iOS without user interaction
```

### Scrolling

**DO:**

```jsx
// Use webkit scrolling utility classes
<div className="ios-scroll-contained" style={{
  height: 'calc(var(--vh, 1vh) * 100)',
  overflowY: 'auto'
}}>
  {/* Scrollable content */}
</div>
```

**DON'T:**

```jsx
// Don't forget momentum scrolling on iOS
<div style={{ overflowY: 'auto' }}>
  {/* Scrolling will feel sluggish on iOS */}
</div>
```

### Z-Index Management

**DO:**

```css
.my-modal {
  z-index: var(--z-modal);
}

.my-tooltip {
  z-index: var(--z-tooltip);
}
```

**DON'T:**

```css
.my-element {
  z-index: 999999; /* Arbitrary high values can cause issues */
}
```

## Testing on iOS

### Manual Testing Checklist

Test the following scenarios on actual iOS devices (iPhone/iPad):

#### Viewport and Layout
- [ ] Open app in Safari
- [ ] Scroll down (address bar should hide)
- [ ] Verify fullscreen elements remain fullscreen
- [ ] Rotate device (portrait/landscape)
- [ ] Verify layout adjusts correctly
- [ ] Pull down to refresh (if enabled)

#### Fixed Elements
- [ ] Open modal/overlay
- [ ] Verify background doesn't scroll
- [ ] Tap input field (keyboard appears)
- [ ] Verify fixed header stays in place
- [ ] Dismiss keyboard
- [ ] Verify layout returns to normal

#### Touch Interactions
- [ ] Test tap targets (min 44x44px)
- [ ] Test swipe gestures
- [ ] Test long press
- [ ] Verify no double-tap zoom on buttons
- [ ] Test touch feedback (active states)

#### Storage
- [ ] Enable Private Browsing mode
- [ ] Test app functionality
- [ ] Verify graceful degradation
- [ ] Disable Private Browsing
- [ ] Test normal storage operations

#### Audio
- [ ] Test audio playback after user interaction
- [ ] Verify audio doesn't autoplay
- [ ] Test with device on silent mode
- [ ] Test with headphones connected/disconnected

#### Scrolling
- [ ] Test momentum scrolling in lists
- [ ] Test scroll chaining behavior
- [ ] Test overscroll bounce
- [ ] Test nested scrollable areas
- [ ] Test horizontal scrolling

### Testing in Simulator

iOS Simulator (Xcode) can be used for basic testing:

```bash
# Open in Safari on iOS Simulator
1. Open Xcode
2. Open Simulator (Xcode > Open Developer Tool > Simulator)
3. Open Safari in simulator
4. Navigate to your local dev URL
```

**Note**: Simulator doesn't perfectly replicate all iOS behaviors. Always test on real devices before release.

### Remote Debugging

Enable Safari Web Inspector for remote debugging:

**On iOS Device**:
1. Settings > Safari > Advanced
2. Enable "Web Inspector"

**On Mac**:
1. Safari > Preferences > Advanced
2. Enable "Show Develop menu in menu bar"
3. Connect iOS device via USB
4. Develop > [Your Device] > [Page]

## Common iOS Issues and Solutions

### Issue: 100vh Taller Than Viewport

**Problem**: Elements using `100vh` extend beyond visible viewport.

**Solution**:
```css
.fullscreen {
  height: calc(var(--vh, 1vh) * 100);
}
```

### Issue: Input Fields Zoom On Focus

**Problem**: iOS Safari zooms in when input font-size is less than 16px.

**Solution**:
```css
input, textarea, select {
  font-size: 16px; /* Minimum 16px to prevent zoom */
}
```

### Issue: Fixed Elements Jump When Keyboard Appears

**Problem**: Fixed positioned elements reposition when virtual keyboard opens.

**Solution**:
```jsx
import { isKeyboardVisible } from '@/utils/iosFixedPosition';

function FixedButton() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setKeyboardVisible(isKeyboardVisible());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <button style={{
      position: 'fixed',
      bottom: keyboardVisible ? '320px' : '20px' // Adjust for keyboard
    }}>
      Submit
    </button>
  );
}
```

### Issue: Audio Won't Play

**Problem**: Audio playback fails silently on iOS.

**Solution**:
```jsx
// Initialize audio after user interaction
function handleFirstInteraction() {
  audioManager.init();
  // Now audio can play
}

<button onClick={handleFirstInteraction}>Start</button>
```

### Issue: LocalStorage Throws Exception

**Problem**: `localStorage.setItem()` throws in private browsing mode.

**Solution**:
```jsx
import safeStorage from '@/utils/safeStorage';

// Safe storage handles exceptions
safeStorage.setItem('key', 'value');
```

### Issue: Scroll Momentum Doesn't Work

**Problem**: Scrolling feels non-native and sluggish.

**Solution**:
```css
.scrollable {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

Or use utility class:
```jsx
<div className="ios-scroll-contained">
  {/* Content */}
</div>
```

### Issue: Click Delay on Touch

**Problem**: 300ms delay on touch events.

**Solution**:
```css
/* Add to global styles */
button, a, input, textarea {
  touch-action: manipulation;
}
```

### Issue: Rubber Band Scrolling

**Problem**: Unwanted bounce effect when scrolling past boundaries.

**Solution**:
```css
.no-bounce {
  overscroll-behavior: none;
}
```

### Issue: Safe Area Insets

**Problem**: Content hidden by notch or home indicator on iPhone X+.

**Solution**:
```css
.safe-area {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

## Performance Optimization

### Minimize Reflows on iOS

iOS Safari is particularly sensitive to layout reflows. Minimize them:

```jsx
// Bad: Multiple style changes cause multiple reflows
element.style.width = '100px';
element.style.height = '100px';
element.style.transform = 'translateX(10px)';

// Good: Batch style changes
element.style.cssText = 'width: 100px; height: 100px; transform: translateX(10px);';

// Better: Use classes
element.className = 'optimized-class';
```

### Use Transform for Animations

Transforms are GPU-accelerated on iOS:

```css
/* Bad: Animates layout properties */
.slide {
  transition: left 0.3s;
}

/* Good: Uses transform */
.slide {
  transition: transform 0.3s;
  will-change: transform;
}
```

### Debounce Resize Events

iOS fires many resize events during scrolling:

```jsx
import { debounce } from 'lodash';

useEffect(() => {
  const handleResize = debounce(() => {
    // Handle resize
  }, 150);

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Optimize Touch Events

Use passive event listeners for better scroll performance:

```jsx
useEffect(() => {
  const handleTouch = (e) => {
    // Handle touch
  };

  element.addEventListener('touchstart', handleTouch, { passive: true });
  return () => element.removeEventListener('touchstart', handleTouch);
}, []);
```

## Troubleshooting

### Debugging Viewport Issues

```javascript
// Add this temporarily to debug viewport behavior
window.addEventListener('resize', () => {
  console.log({
    innerHeight: window.innerHeight,
    vh: document.documentElement.style.getPropertyValue('--vh'),
    visualViewportHeight: window.visualViewport?.height
  });
});
```

### Debugging Keyboard Detection

```javascript
import { isKeyboardVisible } from '@/utils/iosFixedPosition';

// Monitor keyboard state
setInterval(() => {
  console.log('Keyboard visible:', isKeyboardVisible());
}, 500);
```

### Debugging Storage Issues

```javascript
import safeStorage from '@/utils/safeStorage';

console.log('Storage available:', safeStorage.isAvailable());

// Try setting item
const success = safeStorage.setItem('test', 'value');
console.log('Set successful:', success);
```

### Debugging Audio Issues

```javascript
import audioManager from '@/utils/audioManager';

// Check audio context state
console.log('Audio initialized:', audioManager.init());

// Monitor audio playback
audioManager.playSound('test').then(
  () => console.log('Audio played successfully'),
  (err) => console.error('Audio failed:', err)
);
```

### Checking iOS Version

```javascript
import { isIOS } from '@/utils/iosFixedPosition';

if (isIOS()) {
  const version = navigator.userAgent.match(/OS (\d+)_/);
  console.log('iOS version:', version ? version[1] : 'unknown');
}
```

## Migration Guide

### Migrating Existing Components

Follow these steps to migrate existing components to use iOS compatibility utilities:

#### Step 1: Update Viewport Heights

**Before**:
```css
.fullscreen {
  height: 100vh;
}
```

**After**:
```css
.fullscreen {
  height: calc(var(--vh, 1vh) * 100);
}
```

#### Step 2: Add Scroll Locking to Modals

**Before**:
```jsx
function Modal({ isOpen, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal">
      {children}
    </div>
  );
}
```

**After**:
```jsx
import { lockBodyScroll, unlockBodyScroll } from '@/utils/iosFixedPosition';

function Modal({ isOpen, children }) {
  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      return unlockBodyScroll;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal">
      {children}
    </div>
  );
}
```

#### Step 3: Replace localStorage with safeStorage

**Before**:
```jsx
const saveData = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const loadData = (key) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};
```

**After**:
```jsx
import safeStorage from '@/utils/safeStorage';

const saveData = (key, value) => {
  return safeStorage.setItem(key, JSON.stringify(value));
};

const loadData = (key) => {
  const data = safeStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};
```

#### Step 4: Update Scrollable Containers

**Before**:
```jsx
<div style={{ overflowY: 'auto' }}>
  {content}
</div>
```

**After**:
```jsx
<div className="ios-scroll-contained" style={{ overflowY: 'auto' }}>
  {content}
</div>
```

#### Step 5: Standardize Z-Index Values

**Before**:
```css
.modal { z-index: 1000; }
.tooltip { z-index: 1500; }
.dropdown { z-index: 999; }
```

**After**:
```css
.modal { z-index: var(--z-modal); }
.tooltip { z-index: var(--z-tooltip); }
.dropdown { z-index: var(--z-dropdown); }
```

## Support

### Resources

- [iOS Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/Introduction/Introduction.html)
- [WebKit Blog](https://webkit.org/blog/)
- [Can I Use](https://caniuse.com/) - Browser compatibility tables
- [MDN Web Docs - iOS Safari](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Scrollbar_Styling)

### Known Limitations

1. **Viewport Height**: The `--vh` custom property updates on resize, which may cause brief visual jumps
2. **Keyboard Detection**: Relies on viewport height changes, which may not be 100% accurate in all cases
3. **Audio**: Requires user interaction before first playback (iOS restriction)
4. **Storage**: Falls back to memory storage in private browsing mode (data lost on page reload)

### Reporting Issues

If you encounter iOS-specific issues:

1. Test on actual iOS device (not just simulator)
2. Note iOS version and device model
3. Check browser console for errors
4. Verify utilities are initialized correctly
5. Create issue with reproduction steps

## References

### Utilities Created

1. `src/utils/iosViewportHeight.js` - Viewport height management
2. `src/utils/iosFixedPosition.js` - Fixed positioning and keyboard detection
3. `src/utils/safeStorage.js` - Safe localStorage wrapper
4. `src/utils/audioManager.js` - Audio playback management
5. `src/styles/iosScrolling.css` - Webkit scrolling utilities
6. `src/styles/zIndexScale.css` - Standardized z-index scale

### Components Updated

1. `src/components/ErrorBoundary.jsx` - Uses safeStorage
2. `src/components/project/Screenshot.jsx` - Uses iOS utilities
3. Additional components as needed

### Testing Files

1. `src/__tests__/iosCompatibility.test.js` - Comprehensive test suite

### Documentation

1. `docs/ios-compatibility.md` - This document

---

Last Updated: 2026-06-16
Version: 1.0.0
