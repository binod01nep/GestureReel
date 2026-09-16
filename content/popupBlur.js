// GestureReel — Popup Blur Overlay
// Runs on ALL pages. When the extension popup opens, it connects a port
// named 'gesturereel-popup-session'. We listen for that, inject the blur
// overlay, and remove it cleanly when the port disconnects (popup closed).

(function () {
  'use strict';

  function ensureOverlay() {
    let overlay = document.getElementById('gr-popup-blur');
    if (!overlay) {
      const style = document.createElement('style');
      style.id = 'gr-popup-blur-style';
      style.textContent = `
        #gr-popup-blur {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          /* macOS-like frosted glass dimming layer */
          background: rgba(10, 12, 20, 0.42) !important;
          backdrop-filter: blur(14px) saturate(130%) brightness(0.88) !important;
          -webkit-backdrop-filter: blur(14px) saturate(130%) brightness(0.88) !important;
          z-index: 2147483647 !important;
          pointer-events: none !important;
          opacity: 0 !important;
          transition: opacity 0.28s cubic-bezier(0.2, 0.85, 0.4, 1) !important;
        }
        #gr-popup-blur.visible {
          opacity: 1 !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);

      overlay = document.createElement('div');
      overlay.id = 'gr-popup-blur';
      overlay.setAttribute('aria-hidden', 'true');
      (document.body || document.documentElement).appendChild(overlay);
    }
    return overlay;
  }

  function showBlur() {
    const overlay = ensureOverlay();
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  function hideBlur() {
    const overlay = document.getElementById('gr-popup-blur');
    if (overlay) overlay.classList.remove('visible');
  }

  window.__grShowBlur = showBlur;
  window.__grHideBlur = hideBlur;

  if (typeof chrome !== 'undefined' && chrome.runtime?.onConnect) {
    chrome.runtime.onConnect.addListener(port => {
      if (port.name !== 'gesturereel-popup-session') return;
      showBlur();
      port.onDisconnect.addListener(hideBlur);
    });
  }
})();
