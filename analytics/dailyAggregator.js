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

    async recordNewView({ dateKey, platform, videoType, videoId, videoTitle, videoUrl }) {
      if (!chrome?.storage?.local) return;
      try {
        const { todayKey, yesterdayKey } = GestureReelRetention.getTodayAndYesterdayKeys();
        const activeKey = dateKey || todayKey;

        const data = await chrome.storage.local.get(['analytics_days', 'analytics_recent_sessions']);
        let days = data.analytics_days || {};
        let recentSessions = Array.isArray(data.analytics_recent_sessions) ? data.analytics_recent_sessions : [];

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
        record.updatedAt = Date.now();

        // Track in recent sessions (capped at 50 for quick display/history)
        recentSessions.unshift({
          videoId,
          videoTitle: videoTitle || 'Untitled Video',
          videoUrl: videoUrl || '',
          platform,
          videoType,
          date: activeKey,
          timestamp: Date.now()
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
