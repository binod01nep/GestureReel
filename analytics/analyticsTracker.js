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

      // Always bind media events to the video element
      this.bindVideoEvents(video);

      // Validate video ID: do not start sessions or record views for unresolved placeholders
      const isValid = GestureReelDailyAggregator?.isValidVideoId
        ? GestureReelDailyAggregator.isValidVideoId(videoId)
        : (Boolean(videoId) && !['yt_video', 'ig_reel', 'fb_reel', 'video', 'undefined', 'null'].includes(videoId));

      if (!isValid) {
        // ID not yet ready (e.g. video element just mounted before URL/metadata settled)
        this.currentVideo = video;
        return;
      }

      // Deduplication: if same videoId is already active, don't count twice or start a new session!
      // (Even if the DOM video element was swapped/upgraded from placeholder to active renderer)
      if (this.currentVideoId === videoId) {
        this.currentVideo = video;
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
