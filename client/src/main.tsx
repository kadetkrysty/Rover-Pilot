import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installDemoTransport, isDemoMode } from "./lib/demoMode";

installDemoTransport();
createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker for PWA
if ('serviceWorker' in navigator && !isDemoMode()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.log('Service Worker registration failed:', err);
    });
  });
}
