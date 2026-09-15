const DEFAULTS = {
  gestureEnabled: false,
  autoNext: true,
  swipeSensitivity: 50,
  cooldown: 1200,
  confidence: 0.65,
  previewEnabled: true
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set(DEFAULTS);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SETTINGS_CHANGED' && sender.tab?.id) {
    chrome.tabs.sendMessage(sender.tab.id, { type: 'SETTINGS_CHANGED', settings: message.settings }).catch(() => {});
  }
  if (message.type === 'SET_TAB_ZOOM' && sender.tab?.id) {
    chrome.tabs.setZoom(sender.tab.id, message.zoomLevel).catch(() => {});
  }
  if (message.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse({ tabId: tab?.id, url: tab?.url || '' });
    });
    return true;
  }
});

