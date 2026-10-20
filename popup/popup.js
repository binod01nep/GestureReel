(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  let settings = null;
  let activeTab = null;
  let pollInterval = null;

  function platformLabel(url) {
    if (/youtube\.com\/shorts/.test(url)) return 'YouTube Shorts';
    if (/youtube\.com/.test(url)) return 'YouTube Video';
    if (/instagram\.com\/(reel|p)/.test(url)) return 'Instagram Reels';
    if (/facebook\.com\/(reel|watch)/.test(url)) return 'Facebook Reels';
    return 'Unsupported tab';
  }

  function isSupportedUrl(url) {
    return /youtube\.com|instagram\.com|facebook\.com/.test(url || '');
  }

  // Duration Formatter: 00:45 (<60s), 12:30 (<1h), 1h 05m (>=1h)
  function formatDuration(ms) {
    if (!ms || ms <= 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function formatDatePill(dateKey, defaultLabel) {
    if (!dateKey) return defaultLabel;
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return defaultLabel;
    }
  }

  // Tab switching
  function initTabs() {
    const btnAnalytics = $('#tabBtnAnalytics');
    const btnControls = $('#tabBtnControls');
    const viewAnalytics = $('#viewAnalytics');
    const viewControls = $('#viewControls');

    btnAnalytics.addEventListener('click', () => {
      btnAnalytics.classList.add('active');
      btnAnalytics.setAttribute('aria-selected', 'true');
      btnControls.classList.remove('active');
      btnControls.setAttribute('aria-selected', 'false');

      viewAnalytics.classList.add('active');
      viewControls.classList.remove('active');
    });

    btnControls.addEventListener('click', () => {
      btnControls.classList.add('active');
      btnControls.setAttribute('aria-selected', 'true');
      btnAnalytics.classList.remove('active');
      btnAnalytics.setAttribute('aria-selected', 'false');

      viewControls.classList.add('active');
      viewAnalytics.classList.remove('active');
    });
  }

  async function saveSettings(values) {
    settings = await chrome.storage.sync.set({ ...values, autoNext: true }).then(() =>
      chrome.storage.sync.get({ gestureEnabled: false, autoNext: true, swipeSensitivity: 50, cooldown: 1200, previewEnabled: true })
    );
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: 'SETTINGS_CHANGED', settings }).catch(() => {});
    }
    renderControls();
  }

  function renderControls(status) {
    if (!settings) return;
    $('#gestureEnabled').checked = settings.gestureEnabled;
    $('#autoNext').checked = true;
    $('#sensitivity').value = settings.swipeSensitivity;
    $('#cooldown').value = settings.cooldown;
    $('#sensitivityValue').value = settings.swipeSensitivity;
    $('#cooldownValue').value = `${(settings.cooldown / 1000).toFixed(1)}s`;

    const plat = status?.platform || platformLabel(activeTab?.url || '');
    $('#platform').textContent = plat;
    $('#support').textContent = status?.supported ? 'Ready' : (isSupportedUrl(activeTab?.url) ? 'Open video' : 'Unsupported');
    $('#support').classList.toggle('off', !status?.supported);

    const active = status?.camera === 'ON' || settings.gestureEnabled;
    $('#cameraState').textContent = active ? 'Active' : 'Disabled';
    $('#cameraDot').classList.toggle('on', active);
  }

  async function updateAnalyticsDashboard() {
    try {
      const data = await GestureReelDailyAggregator.getDashboardData();
      if (!data) return;

      // 1. Ask active tab for live active session if available
      let liveSession = data.activeSession;
      if (activeTab?.id) {
        try {
          const res = await new Promise(resolve => {
            chrome.tabs.sendMessage(activeTab.id, { type: 'GET_LIVE_TRACKING' }, response => {
              if (chrome.runtime.lastError || !response) resolve(null);
              else resolve(response);
            });
          });
          if (res?.activeSession) {
            liveSession = res.activeSession;
          }
        } catch (e) {}
      }

      // Render Section A: Today's Activity
      const today = data.today || {};
      $('#todayTotalCount').textContent = today.totalCount || 0;
      $('#todayTotalDuration').textContent = formatDuration(today.totalDurationMs || 0);
      $('#todayReelsCount').textContent = `${today.reelsCount || 0} watched`;
      $('#todayReelsDuration').textContent = formatDuration(today.reelsDurationMs || 0);
      $('#todayVideosCount').textContent = `${today.videosCount || 0} watched`;
      $('#todayVideosDuration').textContent = formatDuration(today.videosDurationMs || 0);
      $('#todayDatePill').textContent = formatDatePill(data.todayKey, 'Today');

      // Render Section B: Yesterday's Activity
      const yesterday = data.yesterday || {};
      $('#yesterdayTotalCount').textContent = yesterday.totalCount || 0;
      $('#yesterdayTotalDuration').textContent = formatDuration(yesterday.totalDurationMs || 0);
      $('#yesterdayReelsStat').innerHTML = `${yesterday.reelsCount || 0} <small>(${formatDuration(yesterday.reelsDurationMs || 0)})</small>`;
      $('#yesterdayVideosStat').innerHTML = `${yesterday.videosCount || 0} <small>(${formatDuration(yesterday.videosDurationMs || 0)})</small>`;
      $('#yesterdayDatePill').textContent = formatDatePill(data.yesterdayKey, 'Yesterday');

      // Render Section C: Live Tracking
      $('#liveReelsCounter').textContent = today.reelsCount || 0;
      $('#liveVideosCounter').textContent = today.videosCount || 0;

      const dot = $('#liveDot');
      const statusText = $('#liveStatusText');
      const catBadge = $('#liveCategoryBadge');
      const platLabel = $('#livePlatformLabel');
      const titleEl = $('#liveVideoTitle');
      const durationEl = $('#liveSessionDuration');

      if (liveSession && liveSession.videoId) {
        dot.className = 'live-pulse-dot';
        if (liveSession.status === 'active') {
          dot.classList.add('active');
          statusText.textContent = 'Active • Watching';
        } else if (liveSession.status === 'paused') {
          dot.classList.add('paused');
          statusText.textContent = 'Paused';
        } else {
          dot.classList.add('idle');
          statusText.textContent = 'Idle • Background';
        }

        catBadge.textContent = liveSession.videoType === 'reel' ? 'Reel / Short' : 'Video';
        platLabel.textContent = (liveSession.platform || 'VIDEO').toUpperCase();
        titleEl.textContent = liveSession.videoTitle || 'Video Playback';

        // Calculate live duration
        let currentDuration = liveSession.activeDurationMs || 0;
        if (liveSession.status === 'active' && liveSession.lastActiveAt) {
          currentDuration += Math.max(0, Date.now() - liveSession.lastActiveAt);
        }
        durationEl.textContent = formatDuration(currentDuration);
      } else {
        const supported = isSupportedUrl(activeTab?.url);
        dot.className = `live-pulse-dot ${supported ? 'idle' : 'off'}`;
        statusText.textContent = supported ? 'Ready • No video' : 'Unsupported page';
        catBadge.textContent = supported ? 'Idle' : 'Off';
        platLabel.textContent = 'CURRENT VIDEO';
        titleEl.textContent = supported ? 'Waiting for video playback...' : 'Open YouTube, Instagram, or Facebook';
        durationEl.textContent = '00:00';
      }

      // Render Section D: Platform Breakdown
      const pStats = today.platformStats || {};
      const totalDur = today.totalDurationMs || 1;

      const platforms = [
        { id: 'YTShorts', name: 'YouTube Shorts', stat: pStats['YouTube Shorts'] },
        { id: 'YTVideo', name: 'YouTube Video', stat: pStats['YouTube Video'] },
        { id: 'IGReels', name: 'Instagram Reels', stat: pStats['Instagram Reels'] },
        { id: 'FBReels', name: 'Facebook Reels', stat: pStats['Facebook Reels'] }
      ];

      platforms.forEach(p => {
        const count = (p.stat?.reelsCount || 0) + (p.stat?.videosCount || 0);
        const dur = (p.stat?.reelsDurationMs || 0) + (p.stat?.videosDurationMs || 0);
        $(`#stats${p.id}`).textContent = `${count} viewed • ${formatDuration(dur)}`;
        const pct = today.totalDurationMs > 0 ? Math.min(100, Math.round((dur / totalDur) * 100)) : 0;
        $(`#bar${p.id}`).style.width = `${pct}%`;
      });

      // Empty State Display
      const emptyState = $('#analyticsEmptyState');
      if (today.totalCount === 0 && (!liveSession || !liveSession.videoId)) {
        emptyState.style.display = 'flex';
      } else {
        emptyState.style.display = 'none';
      }
    } catch (err) {
      console.warn('[GestureReel Popup] Error updating analytics dashboard:', err);
    }
  }

  async function init() {
    initTabs();

    settings = await chrome.storage.sync.get({
      gestureEnabled: false,
      autoNext: true,
      swipeSensitivity: 50,
      cooldown: 1200,
      previewEnabled: true
    });

    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Initial renders
    renderControls();
    await updateAnalyticsDashboard();

    // Check content script status
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: 'GET_STATUS' }, status => {
        if (!chrome.runtime.lastError && status) {
          renderControls(status);
        }
      });
    }

    // Auto-refresh interval (1s) while popup is open for live timers
    pollInterval = window.setInterval(updateAnalyticsDashboard, 1000);

    // Storage listeners for real-time changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        updateAnalyticsDashboard();
      }
      if (area === 'sync') {
        chrome.storage.sync.get(settings).then(s => {
          settings = s;
          renderControls();
        });
      }
    });

    // Control event listeners
    $('#gestureEnabled').addEventListener('change', e => saveSettings({ gestureEnabled: e.target.checked }));
    $('#sensitivity').addEventListener('input', e => { $('#sensitivityValue').value = e.target.value; });
    $('#sensitivity').addEventListener('change', e => saveSettings({ swipeSensitivity: Number(e.target.value) }));
    $('#cooldown').addEventListener('input', e => { $('#cooldownValue').value = `${(e.target.value / 1000).toFixed(1)}s`; });
    $('#cooldown').addEventListener('change', e => saveSettings({ cooldown: Number(e.target.value) }));
  }

  window.addEventListener('DOMContentLoaded', init);
})();
