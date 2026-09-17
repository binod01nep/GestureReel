class InstagramController {
  get name() { return 'Instagram Reels'; }

  isSupported() {
    return location.hostname.endsWith('instagram.com') && (
      location.pathname.includes('/reel') ||
      location.pathname.includes('/reels') ||
      location.pathname.includes('/p/')
    );
  }

  getVideo() {
    const videos = [...document.querySelectorAll('video')]
      .filter(video => !video.closest('#gesturereel-camera'))
      .filter(video => {
        const rect = video.getBoundingClientRect();
        return rect.width > 50 && rect.height > 50 && rect.bottom > 0 && rect.top < window.innerHeight;
      })
      .sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return (rectB.width * rectB.height) - (rectA.width * rectA.height);
      });

    return videos.find(video => !video.paused) || videos[0] || document.querySelector('video:not(#gesturereel-camera video)');
  }

  getReelContainer() {
    const video = this.getVideo();
    if (!video) return document;
    return video.closest('article, div[role="presentation"], div[role="dialog"], section, div.x1n2onr6') || video.parentElement || document;
  }

  simulateClick(el) {
    if (!el) return false;
    try {
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.click();
      return true;
    } catch (e) {
      el.click();
      return true;
    }
  }

  simulateDoubleClick(el) {
    if (!el) return false;
    try {
      const opts = { bubbles: true, cancelable: true, view: window, detail: 2 };
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      el.dispatchEvent(new MouseEvent('dblclick', opts));
      return true;
    } catch (e) {
      return false;
    }
  }

  nextVideo() {
    const next = document.querySelector('button[aria-label="Next"], button[aria-label*="Next" i], div[role="button"][aria-label*="Next" i]');
    if (next) { this.simulateClick(next); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
    eventTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    return true;
  }

  prevVideo() {
    const prev = document.querySelector('button[aria-label="Previous"], button[aria-label*="Previous" i], button[aria-label*="Back" i], div[role="button"][aria-label*="Previous" i]');
    if (prev) { this.simulateClick(prev); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: -window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: -window.innerHeight, behavior: 'instant' });
    eventTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
    return true;
  }

  likeVideo() {
    const container = this.getReelContainer();
    
    // 1. Check if already liked in this container
    const isAlreadyLiked = container.querySelector([
      'svg[aria-label*="Unlike" i]',
      'svg[aria-label*="Je n\'aime plus" i]',
      'svg[aria-label*="Ya no me gusta" i]',
      'svg[aria-label*="Non mi piace più" i]',
      'svg[aria-label*="Gefällt mir nicht mehr" i]',
      'svg[color="rgb(255, 48, 64)"]',
      'svg[fill="rgb(255, 48, 64)"]',
      'svg[color="#ff3040"]',
      'svg[fill="#ff3040"]',
      'button[aria-label*="Unlike" i]',
      'div[role="button"][aria-label*="Unlike" i]'
    ].join(','));

    if (isAlreadyLiked) {
      return 'already-liked';
    }

    // 2. Find Like SVG or Button in active reel container
    const likeSvg = container.querySelector([
      'svg[aria-label="Like"]',
      'svg[aria-label*="Like" i]',
      'svg[aria-label="J\'aime" i]',
      'svg[aria-label="Me gusta" i]',
      'svg[aria-label="Curtir" i]',
      'svg[aria-label="Gefällt mir" i]',
      'svg[aria-label="Mi piace" i]'
    ].join(',')) || document.querySelector('svg[aria-label="Like"], svg[aria-label*="Like" i]');

    const button = likeSvg?.closest('button, div[role="button"], span[role="button"]') ||
      container.querySelector('button[aria-label*="Like" i]:not([aria-label*="Unlike" i]), div[role="button"][aria-label*="Like" i]:not([aria-label*="Unlike" i])') ||
      document.querySelector('button[aria-label*="Like" i]:not([aria-label*="Unlike" i]), div[role="button"][aria-label*="Like" i]:not([aria-label*="Unlike" i])');

    if (button) {
      this.simulateClick(button);
      return true;
    }

    // 3. Native Instagram double-click fallback on active video / container
    const video = this.getVideo();
    const target = video?.parentElement || video || (container !== document ? container : null);
    if (target) {
      this.simulateDoubleClick(target);
      return true;
    }

    return false;
  }

  dislikeVideo() {
    const container = this.getReelContainer();
    const unlikeSvg = container.querySelector([
      'svg[aria-label="Unlike"]',
      'svg[aria-label*="Unlike" i]',
      'svg[aria-label="Je n\'aime plus" i]',
      'svg[aria-label="Ya no me gusta" i]',
      'svg[aria-label="Non mi piace più" i]',
      'svg[aria-label="Gefällt mir nicht mehr" i]'
    ].join(',')) || document.querySelector('svg[aria-label*="Unlike" i]');

    const button = unlikeSvg?.closest('button, div[role="button"]') ||
      container.querySelector('button[aria-label*="Unlike" i], div[role="button"][aria-label*="Unlike" i]') ||
      document.querySelector('button[aria-label*="Unlike" i], div[role="button"][aria-label*="Unlike" i]');

    if (button) {
      this.simulateClick(button);
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
