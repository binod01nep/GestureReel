(() => {
  'use strict';

  function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getTodayAndYesterdayKeys(baseDate = new Date()) {
    const todayKey = getLocalDateKey(baseDate);
    const yesterdayDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 1);
    const yesterdayKey = getLocalDateKey(yesterdayDate);
    return { todayKey, yesterdayKey };
  }

  function createEmptyDay(dateKey) {
    return {
      date: dateKey,
      reelsCount: 0,
      videosCount: 0,
      totalCount: 0,
      reelsDurationMs: 0,
      videosDurationMs: 0,
      totalDurationMs: 0,
      platformStats: {
        'YouTube Shorts': { reelsCount: 0, videosCount: 0, reelsDurationMs: 0, videosDurationMs: 0 },
        'YouTube Video': { reelsCount: 0, videosCount: 0, reelsDurationMs: 0, videosDurationMs: 0 },
        'Instagram Reels': { reelsCount: 0, videosCount: 0, reelsDurationMs: 0, videosDurationMs: 0 },
        'Facebook Reels': { reelsCount: 0, videosCount: 0, reelsDurationMs: 0, videosDurationMs: 0 }
      },
      updatedAt: Date.now()
    };
  }

  const RetentionManager = {
    getLocalDateKey,
    getTodayAndYesterdayKeys,
    createEmptyDay,

    async cleanupOldRecords() {
      if (!chrome?.storage?.local) return { removedCount: 0 };
      try {
        const { todayKey, yesterdayKey } = getTodayAndYesterdayKeys();
        const data = await chrome.storage.local.get(['analytics_days', 'analytics_recent_sessions', 'analytics_active_session']);
        
        let days = data.analytics_days || {};
        let removedCount = 0;
        const cleanedDays = {};

        // Retain only today and yesterday in analytics_days
        for (const [key, value] of Object.entries(days)) {
          if (key === todayKey || key === yesterdayKey) {
            cleanedDays[key] = value;
          } else {
            removedCount++;
          }
        }

        // Ensure both today and yesterday exist
        if (!cleanedDays[todayKey]) cleanedDays[todayKey] = createEmptyDay(todayKey);
        if (!cleanedDays[yesterdayKey]) cleanedDays[yesterdayKey] = createEmptyDay(yesterdayKey);

        // Retain only sessions from today and yesterday
        let recentSessions = Array.isArray(data.analytics_recent_sessions) ? data.analytics_recent_sessions : [];
        const cleanedSessions = recentSessions.filter(s => s && (s.date === todayKey || s.date === yesterdayKey));

        // Active session check
        let activeSession = data.analytics_active_session || null;
        if (activeSession && activeSession.date !== todayKey && activeSession.date !== yesterdayKey) {
          activeSession = null;
        }

        await chrome.storage.local.set({
          analytics_days: cleanedDays,
          analytics_recent_sessions: cleanedSessions,
          analytics_active_session: activeSession
        });

        return { todayKey, yesterdayKey, removedCount };
      } catch (err) {
        console.warn('[GestureReel Analytics] Retention cleanup error:', err);
        return { removedCount: 0 };
      }
    },

    setupAlarm() {
      if (!chrome?.alarms) return;
      try {
        chrome.alarms.get('gesturereel_retention_alarm', alarm => {
          if (!alarm) {
            chrome.alarms.create('gesturereel_retention_alarm', { periodInMinutes: 60 });
          }
        });
      } catch (e) {}
    }
  };

  globalThis.GestureReelRetention = RetentionManager;
})();
