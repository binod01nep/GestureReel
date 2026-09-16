const $ = selector => document.querySelector(selector);
let settings;
let activeTab;

function platformLabel(url) {
  if (/youtube\.com\/shorts/.test(url)) return 'YouTube Shorts';
  if (/instagram\.com\/reel/.test(url)) return 'Instagram Reels';
  if (/facebook\.com\/(reel|watch)/.test(url)) return 'Facebook Reels';
  return 'Unsupported tab';
}

async function save(values) {
  settings = await chrome.storage.sync.set({ ...values, autoNext:true }).then(() => chrome.storage.sync.get({ gestureEnabled:false, autoNext:true, swipeSensitivity:50, cooldown:1200, previewEnabled:true }));
  if (activeTab?.id) chrome.tabs.sendMessage(activeTab.id, { type:'SETTINGS_CHANGED', settings }).catch(() => {});
  render();
}

function render(status) {
  $('#gestureEnabled').checked = settings.gestureEnabled;
  $('#autoNext').checked = true;
  $('#sensitivity').value = settings.swipeSensitivity;
  $('#cooldown').value = settings.cooldown;
  $('#sensitivityValue').value = settings.swipeSensitivity;
  $('#cooldownValue').value = `${(settings.cooldown / 1000).toFixed(1)}s`;
  $('#platform').textContent = status?.platform || platformLabel(activeTab?.url || '');
  $('#support').textContent = status?.supported ? 'Ready' : 'Open a reel';
  $('#support').classList.toggle('off', !status?.supported);
  const active = status?.camera === 'ON' || settings.gestureEnabled;
  $('#cameraState').textContent = active ? 'Active' : 'Disabled';
  $('#cameraDot').classList.toggle('on', active);
}

async function init() {
  settings = await chrome.storage.sync.get({ gestureEnabled:false, autoNext:true, swipeSensitivity:50, cooldown:1200, previewEnabled:true });
  [activeTab] = await chrome.tabs.query({ active:true, currentWindow:true });
  render();

  if (activeTab?.id) {
    // 1. Establish session port (triggers onDisconnect cleanup when popup closes)
    try {
      chrome.tabs.connect(activeTab.id, { name: 'gesturereel-popup-session' });
    } catch (e) {}

    // 2. Guarantee blur is active on the current tab even if tab was loaded before extension reload
    try {
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
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

          showBlur();

          if (!window.__grConnectListening && typeof chrome !== 'undefined' && chrome.runtime?.onConnect) {
            window.__grConnectListening = true;
            chrome.runtime.onConnect.addListener(port => {
              if (port.name !== 'gesturereel-popup-session') return;
              showBlur();
              port.onDisconnect.addListener(hideBlur);
            });
          }
        }
      }).catch(() => {});
    } catch (e) {}

    chrome.tabs.sendMessage(activeTab.id, { type:'GET_STATUS' }, status => {
      if (chrome.runtime.lastError) { $('#message').textContent = 'Open a supported reel to connect.'; return; }
      render(status);
    });
  }
}

$('#gestureEnabled').addEventListener('change', event => save({ gestureEnabled:event.target.checked }));
$('#autoNext').addEventListener('change', event => save({ autoNext:event.target.checked }));
$('#sensitivity').addEventListener('input', event => { $('#sensitivityValue').value = event.target.value; });
$('#sensitivity').addEventListener('change', event => save({ swipeSensitivity:Number(event.target.value) }));
$('#cooldown').addEventListener('input', event => { $('#cooldownValue').value = `${(event.target.value / 1000).toFixed(1)}s`; });
$('#cooldown').addEventListener('change', event => save({ cooldown:Number(event.target.value) }));
init();
