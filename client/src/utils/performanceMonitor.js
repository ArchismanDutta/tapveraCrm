/**
 * iOS performance monitoring
 * Tracks key metrics and reports issues
 */

export function initPerformanceMonitoring() {
  if (!window.performance) {
    console.warn('Performance API not available');
    return;
  }

  // Track page load metrics
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = window.performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      const domReadyTime = perfData.domContentLoadedEventEnd - perfData.navigationStart;

      console.log('Performance Metrics:', {
        pageLoadTime: `${pageLoadTime}ms`,
        domReadyTime: `${domReadyTime}ms`,
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent)
      });

      // Alert if performance is poor on iOS
      if (pageLoadTime > 5000 && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
        console.warn('⚠️ Slow page load detected on iOS:', pageLoadTime, 'ms');
      }
    }, 0);
  });

  // Track memory usage (if available)
  if (performance.memory) {
    let lastCheck = Date.now();

    setInterval(() => {
      const now = Date.now();
      // Only check every 30 seconds
      if (now - lastCheck < 30000) return;
      lastCheck = now;

      const memoryUsage = performance.memory.usedJSHeapSize / 1048576; // MB

      if (memoryUsage > 100) {
        console.warn('⚠️ High memory usage:', memoryUsage.toFixed(2), 'MB');
      }
    }, 30000);
  }

  // Track navigation timing
  if (performance.getEntriesByType) {
    const navEntry = performance.getEntriesByType('navigation')[0];
    if (navEntry) {
      console.log('Navigation timing:', {
        dns: navEntry.domainLookupEnd - navEntry.domainLookupStart,
        tcp: navEntry.connectEnd - navEntry.connectStart,
        request: navEntry.responseEnd - navEntry.requestStart,
        domLoading: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart
      });
    }
  }
}

export function trackCustomMetric(name, value) {
  if (window.performance && performance.mark) {
    performance.mark(`${name}-${value}`);
  }
}
