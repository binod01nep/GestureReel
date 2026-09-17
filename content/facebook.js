class FacebookController {
  get name() { return 'Facebook Reels'; }
  isSupported() {
    return location.hostname.endsWith('facebook.com') && (
      location.pathname.includes('/reel') ||
      location.pathname.includes('/watch') ||
      location.pathname.includes('/reels')
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
    return video.closest('div[role="article"], div[data-pagelet*="Reel"], div[data-video-id], div.x1ey2m1c, div.x78zum5') || video.parentElement || document;
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
    const next = [...document.querySelectorAll('div[role="button"], button')].find(node => /next|suivant/i.test(node.getAttribute('aria-label') || node.textContent || ''));
    if (next) { this.simulateClick(next); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
    eventTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    return true;
  }

  prevVideo() {
    const prev = [...document.querySelectorAll('div[role="button"], button')].find(node => /previous|précédent|prev|back/i.test(node.getAttribute('aria-label') || node.textContent || ''));
    if (prev) { this.simulateClick(prev); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: -window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: -window.innerHeight, behavior: 'instant' });
    eventTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
    return true;
  }

  likeVideo() {
    const root = this.getReelContainer();
    const buttons = [...root.querySelectorAll('div[role="button"], button'), ...document.querySelectorAll('div[role="button"], button')];
    
    // Check if already liked
    const alreadyLiked = buttons.find(node => {
      const label = (node.getAttribute('aria-label') || node.textContent || '').trim().toLowerCase();
      const isPressed = node.getAttribute('aria-pressed') === 'true';
      return isPressed || label === 'unlike' || label.includes('remove like') || label === 'je n\'aime plus';
    });
    if (alreadyLiked) {
      return 'already-liked';
    }

    const likeButton = buttons.find(node => {
      const label = (node.getAttribute('aria-label') || node.textContent || '').trim().toLowerCase();
      return label === 'like' || label === "j'aime" || label.includes('like this reel') || label.includes('like reel');
    });

    if (likeButton) {
      this.simulateClick(likeButton);
      return true;
    }

    // Double click fallback on video
    const video = this.getVideo();
    if (video) {
      this.simulateDoubleClick(video.parentElement || video);
      return true;
    }

    return false;
  }

  dislikeVideo() {
    const root = this.getReelContainer();
    const buttons = [...root.querySelectorAll('div[role="button"], button'), ...document.querySelectorAll('div[role="button"], button')];
    const unlikeButton = buttons.find(node => {
      const label = (node.getAttribute('aria-label') || node.textContent || '').trim().toLowerCase();
      return label === 'unlike' || label.includes('remove like') || label === 'je n\'aime plus' || (label === 'like' && node.getAttribute('aria-pressed') === 'true');
    });
    if (unlikeButton) {
      this.simulateClick(unlikeButton);
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
