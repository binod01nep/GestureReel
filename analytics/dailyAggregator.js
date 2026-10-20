(() => {
  'use strict';

  const DailyAggregator = {
    async getDays() {
      if (!chrome?.storage?.local) return { today: null, yesterday: null };
      const { todayKey, yesterdayKey } = GestureReelRetention.getTodayAndYesterdayKeys();
      const data = await chrome.storage.local.get(['analytics_days']);
      const days = data.analytics_days || {};

      const today = days[todayKey] || GestureReelRetention.createEmptyDay(todayKey);
      const yesterday = days[yesterdayKey] || GestureReelRetention.createEmptyDay(yesterdayKey);

      return { today, yesterday, todayKey, yesterdayKey };
    },

    _recentRecorded: {},

    isValidVideoId(id) {
      if (!id || typeof id !== 'string') return false;
      const clean = id.trim();
      if (!clean) return false;
      if (['video', 'yt_video', 'ig_reel', 'fb_reel', 'vid_video', 'undefined', 'null'].includes(clean.toLowerCase())) return false;
      if (/^(yt|ig|fb|vid)_(nan|undefined|0(_0)?)(_.*)?$/i.test(clean)) return false;
      return true;
    },

    async recordNewView({ dateKey, platform, videoType, videoId, videoTitle, videoUrl }) {
      if (!chrome?.storage?.local) return;
      if (!this.isValidVideoId(videoId)) return;

      const now = Date.now();
      if (!this._recentRecorded) this._recentRecorded = {};
      if (this._recentRecorded[videoId] && (now - this._recentRecorded[videoId] < 10000)) {
        return;
      }
      this._recentRecorded[videoId] = now;

      try {
        const { todayKey, yesterdayKey } = GestureReelRetention.getTodayAndYesterdayKeys();
        const activeKey = dateKey || todayKey;

        const data = await chrome.storage.local.get(['analytics_days', 'analytics_recent_sessions']);
        let days = data.analytics_days || {};
        let recentSessions = Array.isArray(data.analytics_recent_sessions) ? data.analytics_recent_sessions : [];

        // Deduplication: if the exact same video was already recorded within 15 seconds, avoid double-increment
        if (recentSessions.length > 0 &&
            recentSessions[0].videoId === videoId &&
            (now - (recentSessions[0].timestamp || 0) < 15000)) {
          if (videoTitle && (!recentSessions[0].videoTitle || recentSessions[0].videoTitle === 'Untitled Video')) {
            recentSessions[0].videoTitle = videoTitle;
            await chrome.storage.local.set({ analytics_recent_sessions: recentSessions });
          }
          return;
        }

        if (!days[activeKey]) {
          days[activeKey] = GestureReelRetention.createEmptyDay(activeKey);
        }

        const record = days[activeKey];
        if (videoType === 'reel') {
          record.reelsCount = (record.reelsCount || 0) + 1;
        } else {
          record.videosCount = (record.videosCount || 0) + 1;
        }
        record.totalCount = record.reelsCount + record.videosCount;

        if (!record.platformStats) record.platformStats = {};
        if (!record.platformStats[platform]) {
          record.platformStats[platform] = { reelsCount: 0, videosCount: 0, reelsDurationMs: 0, videosDurationMs: 0 };
        }
        const plat = record.platformStats[platform];
        if (videoType === 'reel') {
          plat.reelsCount = (plat.reelsCount || 0) + 1;
        } else {
          plat.videosCount = (plat.videosCount || 0) + 1;
        }
        record.updatedAt = now;

        // Track in recent sessions (capped at 50 for quick display/history)
        recentSessions.unshift({
          videoId,
          videoTitle: videoTitle || 'Untitled Video',
          videoUrl: videoUrl || '',
          platform,
          videoType,
          date: activeKey,
          timestamp: now
        });
        if (recentSessions.length > 50) {
          recentSessions = recentSessions.slice(0, 50);
        }

        // Clean any older days before saving
        const cleanedDays = {};
        for (const [k, v] of Object.entries(days)) {
          if (k === todayKey || k === yesterdayKey) {
            cleanedDays[k] = v;
          }
        }

        await chrome.storage.local.set({
          analytics_days: cleanedDays,
          analytics_recent_sessions: recentSessions
        });
      } catch (err) {
        console.warn('[GestureReel Analytics] Failed to record new view:', err);
      }
    },

    async recordDuration({ dateKey, platform, videoType, durationMs }) {
      if (!chrome?.storage?.local || !durationMs || durationMs <= 0) return;
      try {
        const { todayKey, yesterdayKey } = GestureReelRetention.getTodayAndYesterdayKeys();
        const activeKey = dateKey || todayKey;

        const data = await chrome.storage.local.get(['analytics_days']);
        let days = data.analytics_days || {};

        if (!days[activeKey]) {
          days[activeKey] = GestureReelRetention.createEmptyDay(activeKey);
        }

        const record = days[activeKey];
        if (videoType === 'reel') {
          record.reelsDurationMs = (record.reelsDurationMs || 0) + durationMs;
        } else {
          record.videosDurationMs = (record.videosDurationMs || 0) + durationMs;
        }
        record.totalDurationMs = (record.reelsDurationMs || 0) + (record.videosDurationMs || 0);

        if (!record.platformStats) record.platformStats = {};
        if (!record.platformStats[platform]) {
          record.platformStats[platform] = { reelsCount: 0, videosCount: 0, reelsDurationMs: 0, videosDurationMs: 0 };
        }
        const plat = record.platformStats[platform];
        if (videoType === 'reel') {
          plat.reelsDurationMs = (plat.reelsDurationMs || 0) + durationMs;
        } else {
          plat.videosDurationMs = (plat.videosDurationMs || 0) + durationMs;
        }
        record.updatedAt = Date.now();

        const cleanedDays = {};
        for (const [k, v] of Object.entries(days)) {
          if (k === todayKey || k === yesterdayKey) {
            cleanedDays[k] = v;
          }
        }

        await chrome.storage.local.set({ analytics_days: cleanedDays });
      } catch (err) {
        console.warn('[GestureReel Analytics] Failed to record duration:', err);
      }
    },

    async getDashboardData() {
      if (!chrome?.storage?.local) return null;
      await GestureReelRetention.cleanupOldRecords();
      const { today, yesterday, todayKey, yesterdayKey } = await this.getDays();
      const data = await chrome.storage.local.get(['analytics_active_session', 'analytics_recent_sessions']);

      return {
        today,
        yesterday,
        todayKey,
        yesterdayKey,
        activeSession: data.analytics_active_session || null,
        recentSessions: Array.isArray(data.analytics_recent_sessions) ? data.analytics_recent_sessions : []
      };
    }
  };

  globalThis.GestureReelDailyAggregator = DailyAggregator;
})();
