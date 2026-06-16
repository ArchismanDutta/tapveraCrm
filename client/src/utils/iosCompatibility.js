/**
 * iOS detection and compatibility utilities
 */

export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

export const isSafari = () => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export const getIOSVersion = () => {
  if (!isIOS()) return null;

  const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3] || 0, 10)
  };
};

export const isIOSVersionAtLeast = (major, minor = 0) => {
  const version = getIOSVersion();
  if (!version) return false;

  if (version.major > major) return true;
  if (version.major === major && version.minor >= minor) return true;
  return false;
};

export const isPrivateBrowsing = async () => {
  try {
    // Test localStorage availability
    const test = '__private_browsing_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return false;
  } catch (e) {
    return true;
  }
};

export const supportsWebP = () => {
  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
};

export const addIOSMetadata = () => {
  // Add iOS-specific meta tags if not present
  const metaTags = {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'format-detection': 'telephone=no'
  };

  Object.entries(metaTags).forEach(([name, content]) => {
    if (!document.querySelector(`meta[name="${name}"]`)) {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
    }
  });
};

export const logIOSInfo = () => {
  if (!isIOS()) return;

  console.log('iOS Device Detected:', {
    version: getIOSVersion(),
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height
    }
  });
};
