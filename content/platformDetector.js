(() => {
  class PlatformController {
    get name() { return 'Unsupported'; }
    isSupported() { return false; }
    getVideo() { return null; }
    nextVideo() { return false; }
  }

  const controllers = [new YouTubeController(), new InstagramController(), new FacebookController()];
  let controller = new PlatformController();
  let settings = null;
  let video = null;
  let videoObserver = null;
  let nextLock = false;
  let completionTimer = null;
  let handledVideo = null;
  let handledMediaKey = '';
  let mediaKey = '';
  let completionRetries = 0;
  let camera = null;

  function refreshController() {
    const nextController = controllers.find(item => item.isSupported()) || new PlatformController();
    if (nextController.constructor !== controller.constructor) {
      controller = nextController;
      video = null;
      handledVideo = null;
      handledMediaKey = '';
      mediaKey = '';
      completionRetries = 0;
    }
    return controller.isSupported();
  }

  const status = () => ({ platform: controller.name, supported: controller.isSupported(), camera: camera?.status || 'OFF', gesture: settings?.gestureEnabled ? 'ACTIVE' : 'DISABLED' });

  function bindVideo() {
    if (!refreshController()) return;
    const candidate = controller.getVideo();
    if (!candidate || candidate === video) return;
    video = candidate;
    handledVideo = null;
    handledMediaKey = '';
    mediaKey = getMediaKey(candidate);
    completionRetries = 0;
    videoObserver?.disconnect();
    videoObserver = new MutationObserver(() => {
      if (video !== controller.getVideo()) bindVideo();
    });
    videoObserver.observe(document.body, { childList: true, subtree: true });
    video.addEventListener('ended', handleEnded, { passive: true });
    ['loadstart', 'emptied', 'loadedmetadata', 'durationchange', 'play', 'timeupdate'].forEach(eventName => {
      video.addEventListener(eventName, checkCompletion, { passive: true });
    });
  }

  function getMediaKey(candidate) {
    return candidate.currentSrc || candidate.src || `${candidate.duration}:${candidate.videoWidth}x${candidate.videoHeight}`;
  }



  let currentFrameZoom = 1.0;

  function getVideoFrame() {
    // YouTube Shorts: Target the dedicated player frame inside active reel
    const activeRenderer = document.querySelector('ytd-reel-video-renderer[is-active]');
    if (activeRenderer) {
      const frame = activeRenderer.querySelector('#player-container, #shorts-player, .html5-video-player');
      if (frame) return { frame, container: activeRenderer };
      return { frame: activeRenderer, container: activeRenderer };
    }
    // Fallback or Instagram / Facebook: Target the reel video container wrapper
    const activeVideo = controller.getVideo();
    const frame = activeVideo?.closest('#player-container, #shorts-player, article, div[role="dialog"] div:has(> video)') || activeVideo?.parentElement || activeVideo;
    return { frame, container: frame?.parentElement };
  }

  function setFrameZoom(level) {
    const { frame, container } = getVideoFrame();
    if (!frame) return;
    frame.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
    frame.style.transformOrigin = 'center center';
    if (Math.abs(level - 1.0) < 0.02) {
      frame.style.transform = '';
      frame.style.zIndex = '';
      if (container) container.style.overflow = '';
    } else {
      frame.style.transform = `scale(${level.toFixed(2)})`;
      frame.style.zIndex = '999';
      if (container && level > 1.0) container.style.overflow = 'visible';
    }
  }

  function zoomFrame(direction) {
    if (!controller.isSupported()) return 1.0;
    if (direction === 'in') {
      currentFrameZoom = Math.min(1.8, currentFrameZoom + 0.12);
    } else if (direction === 'out') {
      currentFrameZoom = Math.max(0.5, currentFrameZoom - 0.12);
    }
    setFrameZoom(currentFrameZoom);
    return currentFrameZoom;
  }

  function advance(reason) {
    if (nextLock || !controller.isSupported()) return false;
    nextLock = true;
    setFrameZoom(1.0);
    currentFrameZoom = 1.0;
    const moved = controller.nextVideo(reason);
    window.setTimeout(() => { nextLock = false; bindVideo(); }, 900);
    return moved;
  }

  let likeLock = false;
  let playLock = false;

  function like(reason) {
    if (likeLock || !controller.isSupported() || typeof controller.likeVideo !== 'function') return false;
    likeLock = true;
    const liked = controller.likeVideo(reason);
    window.setTimeout(() => { likeLock = false; }, 1200);
    return liked;
  }

  function togglePlay(reason) {
    if (playLock || !controller.isSupported() || typeof controller.togglePlay !== 'function') return false;
    playLock = true;
    const toggled = controller.togglePlay(reason);
    window.setTimeout(() => { playLock = false; }, 800);
    return toggled;
  }

  function handleGestureAction(event) {
    if (event?.type === 'thumbs-up') {
      like('thumbs-up');
    } else if (event?.type === 'two-finger') {
      advance('gesture');
    } else if (event?.type === 'index-point') {
      togglePlay('index-point');
    }
    // Zoom feature cut off for now (code preserved above):
    // else if (event?.type === 'zoom') { zoomFrame(event.direction); }
  }

  function handleEnded() {
    if (!settings?.autoNext) return;
    const endedMediaKey = mediaKey;
    advance('video-ended');
    if (completionRetries >= 3) return;
    completionRetries += 1;
    window.setTimeout(() => {
      if (mediaKey !== endedMediaKey) return;
      if (!video || (!video.ended && video.currentTime < video.duration - 0.15)) {
        completionRetries = 0;
        return;
      }
      handledVideo = null;
      checkCompletion();
    }, 1400);
  }

  function checkCompletion() {
    if (!settings?.autoNext || !video) return;
    const currentMediaKey = getMediaKey(video);
    if (currentMediaKey !== mediaKey) {
      mediaKey = currentMediaKey;
      handledVideo = null;
      handledMediaKey = '';
      completionRetries = 0;
    }
    if (handledVideo === video && handledMediaKey === mediaKey && !video.ended && video.currentTime < 1) {
      handledVideo = null;
      handledMediaKey = '';
      completionRetries = 0;
    }
    if (handledVideo === video && handledMediaKey === mediaKey) return;
    const hasDuration = Number.isFinite(video.duration) && video.duration > 0;
    const finished = video.ended || (hasDuration && video.readyState >= 2 && video.currentTime > 1 && video.currentTime >= video.duration - 0.15);
    if (finished) {
      handledVideo = video;
      handledMediaKey = mediaKey;
      handleEnded();
    }
  }

  async function applySettings(nextSettings) {
    settings = { ...settings, ...nextSettings, autoNext: true };
    if (!camera) camera = new GestureReelCamera(handleGestureAction);
    await camera.configure(settings);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_CHANGED') applySettings(message.settings);
    if (message.type === 'GET_STATUS') sendResponse(status());
    if (message.type === 'NEXT_REEL') advance('popup');
    if (message.type === 'LIKE_REEL') like('popup');
    if (message.type === 'TOGGLE_PLAY') togglePlay('popup');
    if (message.type === 'ZOOM_FRAME' || message.type === 'ZOOM_VIDEO') zoomFrame(message.direction);
  });

  GestureReelStorage.get().then(applySettings);
  bindVideo();
  new MutationObserver(bindVideo).observe(document.documentElement, { childList: true, subtree: true });
  completionTimer = window.setInterval(() => { refreshController(); bindVideo(); checkCompletion(); }, 250);
  document.addEventListener('pointermove', bindVideo, { passive: true });
  document.addEventListener('pointerdown', bindVideo, { passive: true });
})();
