class InstagramController {
  get name() { return 'Instagram Reels'; }
  isSupported() { return location.hostname.endsWith('instagram.com') && location.pathname.includes('/reel'); }
  getVideo() {
    return [...document.querySelectorAll('video')]
      .filter(video => !video.closest('#gesturereel-camera'))
      .find(video => video.offsetParent !== null) || document.querySelector('video:not(#gesturereel-camera video)');
  }
  nextVideo() {
    const next = document.querySelector('button[aria-label="Next"], button[aria-label*="Next"]');
    if (next) { next.click(); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
    return true;
  }
  prevVideo() {
    const prev = document.querySelector('button[aria-label="Previous"], button[aria-label*="Previous" i], button[aria-label*="Back" i]');
    if (prev) { prev.click(); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: -window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: -window.innerHeight, behavior: 'instant' });
    eventTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
    return true;
  }
  likeVideo() {
    const likeSvg = document.querySelector('svg[aria-label="Like"]');
    const button = likeSvg?.closest('button, div[role="button"]') || document.querySelector('button[aria-label="Like"]');
    if (button) {
      button.click();
      return true;
    }
    return false;
  }
  dislikeVideo() {
    const unlikeSvg = document.querySelector('svg[aria-label="Unlike"], svg[aria-label*="Unlike" i], svg[aria-label="Je n\'aime plus" i]');
    const button = unlikeSvg?.closest('button, div[role="button"]') || document.querySelector('button[aria-label="Unlike"], button[aria-label*="Unlike" i]');
    if (button) {
      button.click();
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
