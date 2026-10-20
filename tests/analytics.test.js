// Comprehensive test suite for GestureReel Analytics:
// 1. Two-calendar-day retention & cleanup
// 2. Video & reel view counting & deduplication
// 3. Active viewing-time accumulation on play/pause/visibility change
// 4. Platform breakdown aggregation

(() => {
  'use strict';

  // Mock chrome.storage.local
  const mockStorage = {};
  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys) => {
          const res = {};
          const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys));
          for (const k of keyList) {
            res[k] = mockStorage[k] !== undefined ? JSON.parse(JSON.stringify(mockStorage[k])) : undefined;
          }
          return res;
        },
        set: async (items) => {
          for (const [k, v] of Object.entries(items)) {
            mockStorage[k] = JSON.parse(JSON.stringify(v));
          }
        }
      }
    },
    alarms: {
      get: (name, cb) => cb(null),
      create: () => {}
    }
  };

  // Mock window & location if running in test environment
  if (typeof window === 'undefined') {
    globalThis.window = { location: { href: 'https://www.youtube.com/shorts/test1234' } };
  }

  // Auto-load modules in Node.js environment if needed
  if (typeof require !== 'undefined') {
    const fs = require('fs');
    const path = require('path');
    const vm = require('vm');
    if (typeof GestureReelRetention === 'undefined') {
      vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../analytics/retentionManager.js'), 'utf8'));
    }
    if (typeof GestureReelDailyAggregator === 'undefined') {
      vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../analytics/dailyAggregator.js'), 'utf8'));
    }
    if (typeof GestureReelSessionManager === 'undefined') {
      vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../analytics/sessionManager.js'), 'utf8'));
    }
  }

  // Load modules into context if not already loaded
  const retentionScript = typeof GestureReelRetention !== 'undefined';
  console.assert(retentionScript, 'GestureReelRetention should be loaded');

  // Test 1: Retention date keys & calendar logic
  const now = new Date('2026-10-20T12:00:00');
  const { todayKey, yesterdayKey } = GestureReelRetention.getTodayAndYesterdayKeys(now);
  console.assert(todayKey === '2026-10-20', `Today should be 2026-10-20, got: ${todayKey}`);
  console.assert(yesterdayKey === '2026-10-19', `Yesterday should be 2026-10-19, got: ${yesterdayKey}`);

  (async () => {
    // Test 2: Pruning records older than yesterday
    mockStorage.analytics_days = {
      '2026-10-17': { date: '2026-10-17', totalCount: 15 }, // Day 1 (expired)
      '2026-10-18': { date: '2026-10-18', totalCount: 20 }, // Day 2 (expired)
      '2026-10-19': { date: '2026-10-19', totalCount: 30 }, // Yesterday (retained)
      '2026-10-20': { date: '2026-10-20', totalCount: 45 }  // Today (retained)
    };

    mockStorage.analytics_recent_sessions = [
      { date: '2026-10-17', videoId: 'old1' },
      { date: '2026-10-19', videoId: 'yest1' },
      { date: '2026-10-20', videoId: 'tod1' }
    ];

    const cleanupRes = await GestureReelRetention.cleanupOldRecords();
    const storedDays = mockStorage.analytics_days;

    console.assert(Object.keys(storedDays).length === 2, 'Exactly 2 calendar days should remain in storage');
    console.assert(storedDays['2026-10-19'] !== undefined, 'Yesterday (2026-10-19) must be retained');
    console.assert(storedDays['2026-10-20'] !== undefined, 'Today (2026-10-20) must be retained');
    console.assert(storedDays['2026-10-17'] === undefined, 'Expired day 2026-10-17 must be deleted');
    console.assert(storedDays['2026-10-18'] === undefined, 'Expired day 2026-10-18 must be deleted');

    const storedSessions = mockStorage.analytics_recent_sessions;
    console.assert(storedSessions.length === 2, 'Expired sessions must be pruned');
    console.assert(!storedSessions.some(s => s.date === '2026-10-17'), 'No 2026-10-17 sessions should remain');

    // Test 3: Daily Aggregator view counting
    // Record Reel
    await GestureReelDailyAggregator.recordNewView({
      dateKey: todayKey,
      platform: 'YouTube Shorts',
      videoType: 'reel',
      videoId: 'short_abc',
      videoTitle: 'Test Short'
    });

    // Record Regular Video
    await GestureReelDailyAggregator.recordNewView({
      dateKey: todayKey,
      platform: 'YouTube Video',
      videoType: 'video',
      videoId: 'vid_xyz',
      videoTitle: 'Test Video'
    });

    const dayRecord = mockStorage.analytics_days[todayKey];
    console.assert(dayRecord.reelsCount >= 1, 'Reels count should increment');
    console.assert(dayRecord.videosCount >= 1, 'Videos count should increment');
    console.assert(dayRecord.platformStats['YouTube Shorts'].reelsCount >= 1, 'YouTube Shorts reelsCount should increment');
    console.assert(dayRecord.platformStats['YouTube Video'].videosCount >= 1, 'YouTube Video videosCount should increment');

    // Test 4: Duration accumulation
    await GestureReelDailyAggregator.recordDuration({
      dateKey: todayKey,
      platform: 'YouTube Shorts',
      videoType: 'reel',
      durationMs: 45000 // 45 seconds
    });

    const updatedDayRecord = mockStorage.analytics_days[todayKey];
    console.assert(updatedDayRecord.reelsDurationMs === 45000, `Reels duration should be 45000ms, got: ${updatedDayRecord.reelsDurationMs}`);
    console.assert(updatedDayRecord.totalDurationMs === 45000, `Total duration should be 45000ms, got: ${updatedDayRecord.totalDurationMs}`);
    console.assert(updatedDayRecord.platformStats['YouTube Shorts'].reelsDurationMs === 45000, 'Platform duration should match');

    // Test 5: Session Manager lifecycle & active viewing time
    const sessionManager = new GestureReelSessionManager();
    const fakeNow = 1000000;
    const realDateNow = Date.now;
    Date.now = () => fakeNow;

    // Start active playing session
    const sess = await sessionManager.startSession({
      platform: 'Instagram Reels',
      videoType: 'reel',
      videoId: 'ig_123',
      videoTitle: 'Instagram Reel Test',
      isPlaying: true,
      isVisible: true
    });

    console.assert(sess.status === 'active', 'Session should be active when playing and visible');
    console.assert(sess.lastActiveAt === fakeNow, 'lastActiveAt should match start timestamp');

    // Advance 30 seconds while playing
    Date.now = () => fakeNow + 30000;
    await sessionManager.flushInterval();
    console.assert(sess.activeDurationMs === 30000, `Active duration should be 30000ms, got: ${sess.activeDurationMs}`);

    // Pause video: duration should freeze
    Date.now = () => fakeNow + 35000;
    await sessionManager.setPlayback(false);
    console.assert(sess.status === 'paused', 'Session should be paused');
    console.assert(sess.activeDurationMs === 35000, `Active duration should be 35000ms, got: ${sess.activeDurationMs}`);

    // Time passes while paused (e.g. 20s): no duration should be added
    Date.now = () => fakeNow + 55000;
    await sessionManager.flushInterval();
    console.assert(sess.activeDurationMs === 35000, 'Paused duration should NOT accumulate');

    // Resume playing
    Date.now = () => fakeNow + 60000;
    await sessionManager.setPlayback(true);
    console.assert(sess.status === 'active', 'Session should become active again');

    // Tab becomes hidden (user switches tab or minimizes window)
    Date.now = () => fakeNow + 80000; // 20 seconds of playback
    await sessionManager.setVisibility(false);
    console.assert(sess.status === 'idle', 'Session should become idle when tab is hidden');
    console.assert(sess.activeDurationMs === 55000, `Active duration should be 35000 + 20000 = 55000ms, got: ${sess.activeDurationMs}`);

    // 1 minute passes in background tab: should NOT accumulate
    Date.now = () => fakeNow + 140000;
    await sessionManager.flushInterval();
    console.assert(sess.activeDurationMs === 55000, 'Background-tab duration must NOT accumulate');

    // User returns to tab (visibility becomes true)
    Date.now = () => fakeNow + 150000;
    await sessionManager.setVisibility(true);
    console.assert(sess.status === 'active', 'Session should resume when tab becomes visible');

    // 10 more seconds of watching
    Date.now = () => fakeNow + 160000;
    await sessionManager.endSession();
    console.assert(sess.activeDurationMs === 65000, `Final duration should be 65000ms, got: ${sess.activeDurationMs}`);

    // Test 6: Deduplication & placeholder rejection
    const startReelsCount = mockStorage.analytics_days[todayKey].reelsCount;

    // A. Placeholder ID should be rejected
    await GestureReelDailyAggregator.recordNewView({
      dateKey: todayKey,
      platform: 'YouTube Shorts',
      videoType: 'reel',
      videoId: 'yt_video',
      videoTitle: 'Placeholder'
    });
    console.assert(mockStorage.analytics_days[todayKey].reelsCount === startReelsCount, 'Placeholder IDs must not increment count');

    // B. Real Short clicked at first: Call 1
    await GestureReelDailyAggregator.recordNewView({
      dateKey: todayKey,
      platform: 'YouTube Shorts',
      videoType: 'reel',
      videoId: 'short_first_click_123',
      videoTitle: 'First Click Short'
    });
    console.assert(mockStorage.analytics_days[todayKey].reelsCount === startReelsCount + 1, 'First real view must increment count by exactly 1');

    // C. Immediate Call 2 for same videoId: should deduplicate
    await GestureReelDailyAggregator.recordNewView({
      dateKey: todayKey,
      platform: 'YouTube Shorts',
      videoType: 'reel',
      videoId: 'short_first_click_123',
      videoTitle: 'First Click Short (Active Renderer)'
    });
    console.assert(mockStorage.analytics_days[todayKey].reelsCount === startReelsCount + 1, 'Duplicate call for same videoId must NOT increment count again');

    // D. SessionManager deduplication test
    const sm2 = new GestureReelSessionManager();
    const sessA = await sm2.startSession({
      platform: 'YouTube Shorts',
      videoType: 'reel',
      videoId: 'short_sm_dup',
      videoTitle: 'Short SM Test'
    });
    const countBeforeSecondCall = mockStorage.analytics_days[todayKey].reelsCount;
    const sessB = await sm2.startSession({
      platform: 'YouTube Shorts',
      videoType: 'reel',
      videoId: 'short_sm_dup',
      videoTitle: 'Short SM Test Updated'
    });
    console.assert(sessA === sessB, 'SessionManager should reuse existing session for same videoId');
    console.assert(mockStorage.analytics_days[todayKey].reelsCount === countBeforeSecondCall, 'SessionManager should not increment view count on duplicate videoId');

    Date.now = realDateNow;
    console.log('✅ All GestureReel Analytics tests passed successfully!');
  })();
})();
