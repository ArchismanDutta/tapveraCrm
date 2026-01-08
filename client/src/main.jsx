import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Provider } from "react-redux";
import store from "./store/index.js";

// iOS Safari debugging - log app startup
console.log('App starting...', {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
  isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
});

// Global error handler for uncaught errors (especially for iOS Safari)
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  window.lastGlobalError = {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.toString(),
    stack: event.error?.stack
  };
});

// Catch unhandled promise rejections (common in iOS Safari)
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  window.lastPromiseError = {
    reason: event.reason?.toString(),
    promise: event.promise
  };
});

// Remove StrictMode wrapper so components mount only once
createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
  </Provider>
);

console.log('App rendered successfully');
