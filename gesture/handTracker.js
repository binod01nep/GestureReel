class LocalHandTracker {
  constructor(onPoint, onError) {
    this.onPoint = onPoint;
    this.onError = onError;
    this.hands = null;
    this.loaded = false;
    this.loading = null;
  }

  async load() {
    if (this.loaded) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      if (typeof globalThis.Hands !== 'function') {
        throw new Error('Packaged MediaPipe Hands runtime is unavailable. Reload the extension.');
      }
      await this.verifyAssets();
      return new Promise(resolve => this.initialize(resolve));
    })().catch(error => { this.onError(error); throw error; });
    return this.loading;
  }

  async verifyAssets() {
    const assets = ['hands.binarypb', 'hands_solution_packed_assets.data', 'hand_landmark_lite.tflite'];
    for (const asset of assets) {
      const url = chrome.runtime.getURL(`vendor/mediapipe/hands/${asset}`);
      let response;
      try {
        response = await fetch(url, { cache: 'no-store' });
      } catch (error) {
        throw new Error(`MediaPipe asset fetch failed (${asset}): ${error.message}`);
      }
      if (!response.ok) throw new Error(`MediaPipe asset unavailable (${asset}): HTTP ${response.status}`);
    }
  }

  initialize(resolve) {
    this.hands = new Hands({ locateFile: file => chrome.runtime.getURL(`vendor/mediapipe/hands/${file}`) });
    this.hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.65, minTrackingConfidence: 0.65 });
    this.hands.onResults(results => {
      const wrist = results.multiHandLandmarks?.[0]?.[0];
      if (!wrist) return;
      const confidence = results.multiHandedness?.[0]?.score || 1;
      this.onPoint({ x: wrist.x, y: wrist.y, confidence, landmarks: results.multiHandLandmarks[0] });
    });
    this.loaded = true;
    resolve();
  }

  async process(video) {
    if (!this.hands) await this.load();
    try {
      await this.hands.send({ image: video });
    } catch (error) {
      throw new Error(`MediaPipe frame processing failed: ${error?.message || error}`);
    }
  }

  close() { this.hands?.close(); this.hands = null; this.loaded = false; this.loading = null; }
}
