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
    // Remove any legacy blur overlay if present
    try {
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          document.getElementById('gr-popup-blur')?.remove();
          document.getElementById('gr-popup-blur-style')?.remove();
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
