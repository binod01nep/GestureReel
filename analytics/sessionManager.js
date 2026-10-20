(() => {
  'use strict';

  class SessionManager {
    constructor() {
      this.currentSession = null;
      this.pendingVideoId = null;
    }

    isActive() {
      return this.currentSession && this.currentSession.status === 'active';
    }

    getCurrentSession() {
      return this.currentSession;
    }

    async startSession({ platform, videoType, videoId, videoTitle, videoUrl, isPlaying = false, isVisible = true }) {
      // Deduplication: if same video is already the current session, update metadata/state and do not duplicate
      if (this.currentSession && this.currentSession.videoId === videoId) {
        if (videoTitle && videoTitle !== 'Untitled Video') this.currentSession.videoTitle = videoTitle;
        if (videoUrl) this.currentSession.videoUrl = videoUrl;
        if (isPlaying) {
          this.setPlayback(true);
        }
        return this.currentSession;
      }

      // Prevent concurrent race conditions when two events start a session for the same video simultaneously
      if (this.pendingVideoId === videoId) {
        return this.currentSession;
      }
      this.pendingVideoId = videoId;

      // Flush previous session if still active
      if (this.currentSession) {
        await this.flushInterval();
      }

      const now = Date.now();
      const dateKey = GestureReelRetention.getLocalDateKey(new Date(now));
      const sessionId = `sess_${now}_${Math.random().toString(36).slice(2, 7)}`;
      const active = isPlaying && isVisible;

      this.currentSession = {
        sessionId,
        platform,
        videoType,
        videoId,
        videoTitle: videoTitle || 'Untitled Video',
        videoUrl: videoUrl || window.location.href,
        startedAt: now,
        lastActiveAt: active ? now : 0,
        activeDurationMs: 0,
        isPlaying: Boolean(isPlaying),
        isVisible: Boolean(isVisible),
        status: active ? 'active' : (isPlaying ? 'idle' : 'paused'),
        date: dateKey
      };
      this.pendingVideoId = null;

      // Record new view in daily aggregator if ID is valid
      const isValid = GestureReelDailyAggregator.isValidVideoId(videoId);
      if (isValid) {
        await GestureReelDailyAggregator.recordNewView({
          dateKey,
          platform,
          videoType,
          videoId,
          videoTitle: this.currentSession.videoTitle,
          videoUrl: this.currentSession.videoUrl
        });
      }

      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ analytics_active_session: this.currentSession });
      }

      return this.currentSession;
    }

    async flushInterval() {
      if (!this.currentSession || this.currentSession.status !== 'active' || !this.currentSession.lastActiveAt) {
        return;
      }

      const now = Date.now();
      const elapsed = Math.max(0, now - this.currentSession.lastActiveAt);
      if (elapsed <= 0) return;

      this.currentSession.activeDurationMs = (this.currentSession.activeDurationMs || 0) + elapsed;
      this.currentSession.lastActiveAt = now;

      // Commit duration chunk to daily storage
      await GestureReelDailyAggregator.recordDuration({
        dateKey: this.currentSession.date,
        platform: this.currentSession.platform,
        videoType: this.currentSession.videoType,
        durationMs: elapsed
      });

      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ analytics_active_session: this.currentSession });
      }
    }

    async setPlayback(isPlaying) {
      if (!this.currentSession) return;
      const playing = Boolean(isPlaying);
      if (this.currentSession.isPlaying === playing) return;

      if (!playing) {
        // Changing to paused: flush active interval
        await this.flushInterval();
        this.currentSession.isPlaying = false;
        this.currentSession.status = 'paused';
        this.currentSession.lastActiveAt = 0;
      } else {
        // Changing to playing
        this.currentSession.isPlaying = true;
        if (this.currentSession.isVisible) {
          this.currentSession.status = 'active';
          this.currentSession.lastActiveAt = Date.now();
        } else {
          this.currentSession.status = 'idle';
          this.currentSession.lastActiveAt = 0;
        }
      }

      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ analytics_active_session: this.currentSession });
      }
    }

    async setVisibility(isVisible) {
      if (!this.currentSession) return;
      const visible = Boolean(isVisible);
      if (this.currentSession.isVisible === visible) return;

      if (!visible) {
        // Tab hidden or backgrounded: flush active interval
        await this.flushInterval();
        this.currentSession.isVisible = false;
        this.currentSession.status = this.currentSession.isPlaying ? 'idle' : 'paused';
        this.currentSession.lastActiveAt = 0;
      } else {
        // Tab became visible
        this.currentSession.isVisible = true;
        if (this.currentSession.isPlaying) {
          this.currentSession.status = 'active';
          this.currentSession.lastActiveAt = Date.now();
        } else {
          this.currentSession.status = 'paused';
          this.currentSession.lastActiveAt = 0;
        }
      }

      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ analytics_active_session: this.currentSession });
      }
    }

    async endSession() {
      if (!this.currentSession) return;
      await this.flushInterval();
      this.currentSession = null;
      this.pendingVideoId = null;
      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ analytics_active_session: null });
      }
    }
  }

  globalThis.GestureReelSessionManager = SessionManager;
})();
