(() => {
  class PlatformController {
    get name() { return 'Unsupported'; }
    isSupported() { return false; }
    getVideo() { return null; }
    nextVideo() { return false; }
    prevVideo() { return false; }
    dislikeVideo() { return false; }
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

  function retreat(reason) {
    if (nextLock || !controller.isSupported() || typeof controller.prevVideo !== 'function') return false;
    nextLock = true;
    setFrameZoom(1.0);
    currentFrameZoom = 1.0;
    const moved = controller.prevVideo(reason);
    window.setTimeout(() => { nextLock = false; bindVideo(); }, 900);
    return moved;
  }

  let likeLock = false;
  let dislikeLock = false;
  let playLock = false;

  function like(reason) {
    if (likeLock || !controller.isSupported() || typeof controller.likeVideo !== 'function') return false;
    likeLock = true;
    const liked = controller.likeVideo(reason);
    window.setTimeout(() => { likeLock = false; }, 1200);
    return liked;
  }

  function dislike(reason) {
    if (dislikeLock || !controller.isSupported() || typeof controller.dislikeVideo !== 'function') return false;
    dislikeLock = true;
    const disliked = controller.dislikeVideo(reason);
    window.setTimeout(() => { dislikeLock = false; }, 1200);
    return disliked;
  }

  function togglePlay(reason) {
    if (playLock || !controller.isSupported() || typeof controller.togglePlay !== 'function') return false;
    playLock = true;
    const toggled = controller.togglePlay(reason);
    window.setTimeout(() => { playLock = false; }, 800);
    return toggled;
  }

  let speedToastTimer = null;
  function showSpeedToast(text) {
    let toast = document.getElementById('gesturereel-speed-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gesturereel-speed-toast';
      Object.assign(toast.style, {
        position: 'fixed',
        top: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        background: 'rgba(16, 22, 28, 0.92)',
        color: '#ffffff',
        padding: '10px 22px',
        borderRadius: '30px',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(12px)',
        font: '600 15px system-ui, -apple-system, sans-serif',
        letterSpacing: '0.3px',
        pointerEvents: 'none',
        transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        opacity: '0',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      });
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    clearTimeout(speedToastTimer);
    speedToastTimer = setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-8px) scale(0.95)';
      }
    }, 1200);
  }

  function handleGestureAction(event, provideFeedback) {
    const isRegularVideo = typeof controller.isRegularVideo === 'function' && controller.isRegularVideo();

    if (isRegularVideo) {
      if (event?.type === 'two-finger' || event?.type === 'two-finger-attached') {
        const res = typeof controller.setPlaybackRate === 'function' ? controller.setPlaybackRate(2.0) : false;
        if (res) {
          showSpeedToast('⚡ 2x Speed');
          provideFeedback?.('⚡ 2x Speed');
        } else {
          provideFeedback?.('⚠️ Video not found', true);
        }
        return;
      } else if (event?.type === 'index-point') {
        const res = typeof controller.setPlaybackRate === 'function' ? controller.setPlaybackRate(1.0) : false;
        if (res) {
          showSpeedToast('▶️ 1x Speed');
          provideFeedback?.('▶️ 1x Speed');
        } else {
          provideFeedback?.('⚠️ Video not found', true);
        }
        return;
      }
    }

    if (event?.type === 'thumbs-up') {
      const res = like('thumbs-up');
      if (res === 'already-liked') {
        provideFeedback?.('❤️ Already Liked');
      } else if (res) {
        provideFeedback?.('👍 Liked!');
      } else {
        provideFeedback?.('⚠️ Like failed', true);
      }
    } else if (event?.type === 'thumbs-down') {
      const res = dislike('thumbs-down');
      if (res) {
        provideFeedback?.('👎 Disliked / Unliked');
      } else {
        provideFeedback?.('⚠️ Action failed', true);
      }
    } else if (event?.type === 'two-finger') {
      const res = advance('gesture');
      if (res) {
        provideFeedback?.('✌️ Next reel');
      } else {
        provideFeedback?.('⚠️ Next unavailable', true);
      }
    } else if (event?.type === 'two-finger-attached') {
      const res = retreat('gesture');
      if (res) {
        provideFeedback?.('⏮️ Previous reel');
      } else {
        provideFeedback?.('⚠️ Prev unavailable', true);
      }
    } else if (event?.type === 'index-point') {
      const res = togglePlay('index-point');
      setTimeout(() => {
        const pageVideo = controller.getVideo() || document.querySelector('video:not(#gesturereel-camera video)');
        if (pageVideo) {
          provideFeedback?.(pageVideo.paused ? '⏸️ Paused' : '▶️ Playing');
        } else if (res) {
          provideFeedback?.('⏯️ Play / Pause');
        } else {
          provideFeedback?.('⚠️ Video not found', true);
        }
      }, 70);
    }
  }

  function handleEnded() {
    if (!settings?.autoNext) return;
    if (typeof controller.isRegularVideo === 'function' && controller.isRegularVideo()) return;
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
    if (typeof controller.isRegularVideo === 'function' && controller.isRegularVideo()) return;
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
    if (message.type === 'PREV_REEL') retreat('popup');
    if (message.type === 'LIKE_REEL') like('popup');
    if (message.type === 'DISLIKE_REEL') dislike('popup');
    if (message.type === 'TOGGLE_PLAY') togglePlay('popup');
    if (message.type === 'ZOOM_FRAME' || message.type === 'ZOOM_VIDEO') zoomFrame(message.direction);
  });

  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'sync') {
      GestureReelStorage.get().then(applySettings);
    }
  });

  GestureReelStorage.get().then(applySettings);
  bindVideo();
  new MutationObserver(bindVideo).observe(document.documentElement, { childList: true, subtree: true });
  completionTimer = window.setInterval(() => { refreshController(); bindVideo(); checkCompletion(); }, 250);
  document.addEventListener('pointermove', bindVideo, { passive: true });
  document.addEventListener('pointerdown', bindVideo, { passive: true });
})();
