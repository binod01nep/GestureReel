(() => {
  const DEFAULTS = {
    gestureEnabled: false,
    autoNext: true,
    swipeSensitivity: 50,
    cooldown: 1200,
    confidence: 0.65,
    previewEnabled: true
  };

  globalThis.GestureReelStorage = {
    defaults: DEFAULTS,
    async get() {
      const values = await chrome.storage.sync.get(DEFAULTS);
      return { ...DEFAULTS, ...values };
    },
    async set(values) {
      await chrome.storage.sync.set(values);
      return this.get();
    }
  };
})();
