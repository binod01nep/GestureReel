(() => {
  const base = () => document.documentElement.dataset.gestureReelAssets || '';
  const assetNames = new Set([
    'hands.binarypb',
    'hands_solution_packed_assets.data',
    'hands_solution_wasm_bin.wasm',
    'hands_solution_simd_wasm_bin.wasm',
    'hand_landmark_lite.tflite',
    'hand_landmark_full.tflite'
  ]);
  const resolveAsset = value => {
    const assetBase = base();
    const url = String(value);
    const name = url.split('/').pop().split('?')[0];
    return assetBase && assetNames.has(name) && !url.startsWith('chrome-extension://')
      ? new URL(name, assetBase).href
      : value;
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (input instanceof Request) input = new Request(resolveAsset(input.url), input);
    else input = resolveAsset(input);
    return nativeFetch(input, init);
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    return nativeOpen.call(this, method, resolveAsset(url), ...args);
  };

  const wrap = name => {
    const factory = globalThis[name];
    if (typeof factory !== 'function' || factory.__gestureReelWrapped) return;
    const wrapped = module => {
      const assetBase = base();
      if (assetBase && (!module || typeof module.locateFile !== 'function')) {
        module = module || {};
        module.locateFile = file => new URL(file, assetBase).href;
      }
      return factory(module);
    };
    wrapped.__gestureReelWrapped = true;
    globalThis[name] = wrapped;
  };
  const timer = window.setInterval(() => {
    wrap('createMediapipeSolutionsWasm');
    wrap('createMediapipeSolutionsPackedAssets');
    if (globalThis.createMediapipeSolutionsWasm?.__gestureReelWrapped && globalThis.createMediapipeSolutionsPackedAssets?.__gestureReelWrapped) window.clearInterval(timer);
  }, 25);
  window.setTimeout(() => window.clearInterval(timer), 10000);
})();
