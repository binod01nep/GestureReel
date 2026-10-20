(() => {
  'use strict';

  class AnalyticsTracker {
    constructor() {
      this.session = new GestureReelSessionManager();
      this.currentVideo = null;
      this.currentVideoId = null;
      this.controller = null;
      this.ticker = null;

      this.initEvents();
    }

    initEvents() {
      // Visibility changes (tab switching, window minimization)
      document.addEventListener('visibilitychange', () => {
        this.session.setVisibility(!document.hidden && document.visibilityState === 'visible');
      }, { passive: true });

      // Clean unload tracking
      window.addEventListener('beforeunload', () => {
        this.session.endSession();
      });
      window.addEventListener('pagehide', () => {
        this.session.endSession();
      });

      // Periodic 1-second interval to commit active durations continuously
      this.ticker = window.setInterval(() => {
        if (this.session.isActive()) {
          this.session.flushInterval();
        }
      }, 1000);
    }

    onVideoChanged(controller, video) {
      if (!video || !controller?.isSupported()) return;

      const platform = controller.name;
      const videoType = typeof controller.getVideoType === 'function'
        ? controller.getVideoType(video)
        : ((typeof controller.isRegularVideo === 'function' && controller.isRegularVideo()) ? 'video' : 'reel');

      const videoId = typeof controller.getVideoId === 'function'
        ? controller.getVideoId(video)
        : (video.currentSrc || `vid_${video.duration}_${video.videoWidth}`);

      const videoTitle = typeof controller.getVideoTitle === 'function'
        ? controller.getVideoTitle(video)
        : (document.title || 'Video');

      const videoUrl = window.location.href;

      // Deduplication: if same video and session is already active, don't count twice
      if (this.currentVideoId === videoId && this.currentVideo === video && this.session.getCurrentSession()) {
        // Re-check playback state in case of autoplay
        const isPlaying = !video.paused && !video.ended;
        this.session.setPlayback(isPlaying);
        return;
      }

      this.currentVideo = video;
      this.currentVideoId = videoId;
      this.controller = controller;

      const isPlaying = !video.paused && !video.ended;
      const isVisible = !document.hidden && document.visibilityState === 'visible';

      // Start distinct viewing session
      this.session.startSession({
        platform,
        videoType,
        videoId,
        videoTitle,
        videoUrl,
        isPlaying,
        isVisible
      });

      // Bind media events to video
      this.bindVideoEvents(video);
    }

    bindVideoEvents(video) {
      if (video.__gr_analytics_bound) return;
      video.__gr_analytics_bound = true;

      video.addEventListener('play', () => {
        if (video === this.currentVideo) this.session.setPlayback(true);
      }, { passive: true });

      video.addEventListener('playing', () => {
        if (video === this.currentVideo) this.session.setPlayback(true);
      }, { passive: true });

      video.addEventListener('pause', () => {
        if (video === this.currentVideo) this.session.setPlayback(false);
      }, { passive: true });

      video.addEventListener('ended', () => {
        if (video === this.currentVideo) this.session.setPlayback(false);
      }, { passive: true });

      video.addEventListener('emptied', () => {
        if (video === this.currentVideo) this.session.setPlayback(false);
      }, { passive: true });

      video.addEventListener('timeupdate', () => {
        if (video === this.currentVideo && !video.paused && !video.ended) {
          const sess = this.session.getCurrentSession();
          if (sess && !sess.isPlaying) {
            this.session.setPlayback(true);
          }
        }
      }, { passive: true });
    }
  }

  globalThis.GestureReelTracker = new AnalyticsTracker();
})();
