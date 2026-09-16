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
  prevVideo() {
    const prev = [...document.querySelectorAll('div[role="button"], button')].find(node => /previous|précédent|prev|back/i.test(node.getAttribute('aria-label') || node.textContent || ''));
    if (prev) { prev.click(); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: -window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: -window.innerHeight, behavior: 'instant' });
    eventTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
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
  dislikeVideo() {
    const likeButton = [...document.querySelectorAll('div[role="button"], button')].find(node => {
      const label = node.getAttribute('aria-label') || node.textContent || '';
      return /^unlike$/i.test(label) || /remove like/i.test(label) || /je n'aime plus/i.test(label) || (/^like$/i.test(label) && node.getAttribute('aria-pressed') === 'true');
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
