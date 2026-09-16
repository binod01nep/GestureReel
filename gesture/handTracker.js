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
      return new Promise(resolve => this.initialize(resolve));
    })().catch(error => { this.onError(error); throw error; });
    return this.loading;
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
