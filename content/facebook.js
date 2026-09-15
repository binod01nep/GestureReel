class FacebookController {
  get name() { return 'Facebook Reels'; }
  isSupported() { return location.hostname.endsWith('facebook.com') && (location.pathname.includes('/reel') || location.pathname.includes('/watch')); }
  getVideo() {
    return [...document.querySelectorAll('video')]
      .filter(video => !video.closest('#gesturereel-camera'))
      .find(video => video.offsetParent !== null) || document.querySelector('video:not(#gesturereel-camera video)');
  }
  nextVideo() {
    const next = [...document.querySelectorAll('div[role="button"], button')].find(node => /next|suivant/i.test(node.getAttribute('aria-label') || node.textContent || ''));
    if (next) { next.click(); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
    return true;
  }
  likeVideo() {
    const likeButton = [...document.querySelectorAll('div[role="button"], button')].find(node => {
      const label = node.getAttribute('aria-label') || node.textContent || '';
      return /^like$/i.test(label) || /^j'aime$/i.test(label) || /like this reel/i.test(label);
    });
    if (likeButton) {
      likeButton.click();
      return true;
    }
    return false;
  }
  togglePlay() {
    const video = this.getVideo();
    if (!video) return false;
    if (video.paused) {
      video.play().catch(() => video.click());
    } else {
      video.pause();
    }
    return true;
  }
}
