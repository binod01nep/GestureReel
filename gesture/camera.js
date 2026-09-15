class GestureReelCamera {
  constructor(onSwipe) {
    this.onSwipe = onSwipe;
    this.stream = null;
    this.video = null;
    this.preview = null;
    this.tracker = null;
    this.detector = new SwipeUpDetector(event => this.handleGesture(event));
    this.running = false;
    this.lastFrame = 0;
    this.status = 'OFF';
    this.feedbackTimer = null;
  }

  handleGesture(event) {
    if (event?.type === 'thumbs-up') {
      this.showFeedback('👍 Liked!');
      this.onSwipe?.(event);
    } else if (event?.type === 'two-finger') {
      this.showFeedback('✌️ Next reel');
      this.onSwipe?.(event);
    } else if (event?.type === 'index-point') {
      this.onSwipe?.(event);
      setTimeout(() => {
        const pageVideo = document.querySelector('video:not(#gesturereel-camera video)');
        if (pageVideo) {
          this.showFeedback(pageVideo.paused ? '⏸️ Paused' : '▶️ Playing');
        } else {
          this.showFeedback('⏯️ Play / Pause');
        }
      }, 60);
    }
    /* Zoom feature cutoff for now (code preserved):
    else if (event?.type === 'zoom') {
      this.onSwipe?.(event);
      setTimeout(() => {
        const frame = document.querySelector('#player-container, #shorts-player, article, video:not(#gesturereel-camera video)');
        const transform = frame?.style?.transform || '';
        const match = transform.match(/scale\(([\d\.]+)\)/);
        const scaleVal = match ? `${match[1]}x` : (event.direction === 'in' ? 'Zoom In' : '1.0x');
        this.showFeedback(event.direction === 'in' ? `🔍 Frame In (${scaleVal})` : `🔍 Frame Out (${scaleVal})`);
      }, 40);
    } */
  }

  showFeedback(text) {
    const state = this.preview?.querySelector('.gr-camera-state');
    if (state) {
      state.textContent = text;
      state.style.color = '#98e6c2';
      state.style.fontWeight = 'bold';
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = setTimeout(() => {
        if (state && this.status === 'ON') {
          state.textContent = 'Gesture active - local processing';
          state.style.color = '';
          state.style.fontWeight = '';
        }
      }, 1200);
    }
  }

  async configure(settings) {
    this.detector.configure(settings);
    if (!settings.gestureEnabled) { this.stop(); return; }
    if (this.running) { this.preview.style.display = settings.previewEnabled ? 'block' : 'none'; return; }
    await this.start(settings.previewEnabled);
  }

  async start(showPreview) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
      this.preview = this.createPreview(showPreview);
      this.video = this.preview.querySelector('video');
      await this.video.play();
      this.tracker = new LocalHandTracker(point => this.detector.addSample(point), error => this.fail(error));
      await this.tracker.load();
      this.running = true;
      this.status = 'ON';
      const state = this.preview?.querySelector('.gr-camera-state');
      if (state) state.textContent = 'Gesture active - local processing';
      this.loop();
    } catch (error) { this.fail(error); }
  }

  createPreview(showPreview) {
    const root = document.createElement('section');
    root.id = 'gesturereel-camera';
    root.innerHTML = '<div class="gr-camera-head"><strong>GestureReel</strong><button type="button" aria-label="Turn camera off">OFF</button></div><video autoplay muted playsinline></video><small class="gr-camera-state">Starting local tracking...</small>';
    Object.assign(root.style, { position: 'fixed', right: '18px', bottom: '18px', zIndex: '2147483647', width: '180px', padding: '8px', background: '#10161c', color: '#d7e2e8', border: '1px solid #49606b', borderRadius: '10px', font: '12px system-ui', boxShadow: '0 8px 24px #0008', display: showPreview ? 'block' : 'none' });
    const video = root.querySelector('video');
    Object.assign(video.style, { width: '100%', display: 'block', transform: 'scaleX(-1)', borderRadius: '6px', margin: '6px 0' });
    root.querySelector('button').style.cssText = 'float:right;background:transparent;color:#b8d7d9;border:0;cursor:pointer;font-weight:700';
    root.querySelector('button').addEventListener('click', () => chrome.storage.sync.set({ gestureEnabled: false }));
    document.documentElement.appendChild(root);
    video.srcObject = this.stream;
    video.addEventListener('loadedmetadata', () => video.play().catch(error => this.fail(error)), { once: true });
    return root;
  }

  async loop() {
    if (!this.running || !this.video) return;
    const now = performance.now();
    if (now - this.lastFrame >= 100) {
      this.lastFrame = now;
      if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !this.video.videoWidth) {
        requestAnimationFrame(() => this.loop());
        return;
      }
      try { await this.tracker.process(this.video); } catch (error) { this.fail(error); return; }
    }
    requestAnimationFrame(() => this.loop());
  }

  fail(error) {
    console.warn('[GestureReel]', error.message);
    const state = this.preview?.querySelector('.gr-camera-state');
    if (state) state.textContent = `Tracking error: ${error.message}`;
    this.status = 'ERROR';
    this.stop(false);
    chrome.runtime.sendMessage({ type: 'CAMERA_ERROR', message: error.message }).catch(() => {});
  }

  stop(removePreview = true) {
    this.running = false;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.tracker?.close();
    this.tracker = null;
    this.detector.reset();
    if (removePreview) this.preview?.remove();
    this.preview = null;
    this.video = null;
    this.status = 'OFF';
  }
}
