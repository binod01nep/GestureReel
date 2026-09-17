// GestureReel — Popup blur overlay removed per user preferences
(function () {
  'use strict';
  try {
    document.getElementById('gr-popup-blur')?.remove();
    document.getElementById('gr-popup-blur-style')?.remove();
  } catch (e) {}
})();

