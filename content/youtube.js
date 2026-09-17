class YouTubeController {
  get name() { return 'YouTube Shorts'; }
  isSupported() { return location.hostname.endsWith('youtube.com') && (location.pathname.startsWith('/shorts/') || location.pathname.includes('/shorts')); }

  getActiveRenderer() {
    return document.querySelector('ytd-reel-video-renderer[is-active]') ||
      [...document.querySelectorAll('ytd-reel-video-renderer')].find(renderer => {
        const v = renderer.querySelector('video');
        return v && !v.paused;
      }) ||
      document.querySelector('ytd-reel-video-renderer');
  }

  getVideo() {
    const activeRenderer = this.getActiveRenderer();
    if (activeRenderer) {
      const activeVideo = activeRenderer.querySelector('video');
      if (activeVideo) return activeVideo;
    }
    const videos = [...document.querySelectorAll('video')]
      .filter(video => !video.closest('#gesturereel-camera'))
      .map(video => ({ video, rect: video.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight)
      .sort((first, second) => (second.rect.width * second.rect.height) - (first.rect.width * first.rect.height))
      .map(({ video }) => video);
    return videos.find(video => !video.paused) || videos[0] || document.querySelector('ytd-shorts video, video:not(#gesturereel-camera video)');
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

  nextVideo() {
    const nextButton = [...document.querySelectorAll([
      'ytd-shorts #navigation-button-down button',
      'ytd-shorts button[aria-label*="Next" i]',
      'button[aria-label*="Next video" i]',
      'button[title*="Next" i]'
    ].join(','))].find(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true' && button.offsetParent !== null);
    if (nextButton) { this.simulateClick(nextButton); return true; }
    const currentRenderer = this.getActiveRenderer() || document.querySelector('ytd-reel-video-renderer:has(video)');
    const renderers = [...document.querySelectorAll('ytd-reel-video-renderer')];
    const nextRenderer = currentRenderer && renderers[renderers.indexOf(currentRenderer) + 1];
    if (nextRenderer) { nextRenderer.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
    const shortsContainer = document.querySelector('#shorts-container, ytd-shorts');
    if (shortsContainer?.scrollBy) { shortsContainer.scrollBy({ top: window.innerHeight, behavior: 'smooth' }); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
    eventTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    return true;
  }

  prevVideo() {
    const prevButton = [...document.querySelectorAll([
      'ytd-shorts #navigation-button-up button',
      'ytd-shorts button[aria-label*="Previous" i]',
      'button[aria-label*="Previous video" i]',
      'button[title*="Previous" i]'
    ].join(','))].find(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true' && button.offsetParent !== null);
    if (prevButton) { this.simulateClick(prevButton); return true; }
    const currentRenderer = this.getActiveRenderer() || document.querySelector('ytd-reel-video-renderer:has(video)');
    const renderers = [...document.querySelectorAll('ytd-reel-video-renderer')];
    const prevRenderer = currentRenderer && renderers[renderers.indexOf(currentRenderer) - 1];
    if (prevRenderer) { prevRenderer.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
    const shortsContainer = document.querySelector('#shorts-container, ytd-shorts');
    if (shortsContainer?.scrollBy) { shortsContainer.scrollBy({ top: -window.innerHeight, behavior: 'smooth' }); return true; }
    const eventTarget = document.activeElement || document.body;
    eventTarget.dispatchEvent(new WheelEvent('wheel', { deltaY: -window.innerHeight, bubbles: true, cancelable: true }));
    window.scrollBy({ top: -window.innerHeight, behavior: 'instant' });
    eventTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
    return true;
  }

  likeVideo() {
    const root = this.getActiveRenderer() || document;
    
    // Dedicated like containers first
    const dedicatedContainer = root.querySelector('#like-button, ytd-like-button-renderer, like-button-view-model');
    let likeButton = dedicatedContainer?.querySelector('button, yt-button-shape button, [role="button"]');

    if (!likeButton) {
      const buttons = [...root.querySelectorAll('button')];
      likeButton = buttons.find(b => {
        const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').trim().toLowerCase();
        return label.includes('like') && !label.includes('dislike') && !label.includes('unlike');
      });
    }

    if (likeButton) {
      const isAlreadyLiked = likeButton.getAttribute('aria-pressed') === 'true' || 
                             likeButton.closest('like-button-view-model')?.getAttribute('aria-pressed') === 'true' ||
                             likeButton.closest('ytd-like-button-renderer')?.querySelector('button[aria-pressed="true"]');
      if (isAlreadyLiked) {
        return 'already-liked';
      }
      this.simulateClick(likeButton);
      return true;
    }
    return false;
  }

  dislikeVideo() {
    const root = this.getActiveRenderer() || document;
    
    // 1. If currently liked, clicking like button unlikes it
    const dedicatedLikeContainer = root.querySelector('#like-button, ytd-like-button-renderer, like-button-view-model');
    let likeButton = dedicatedLikeContainer?.querySelector('button, yt-button-shape button');
    if (!likeButton) {
      const buttons = [...root.querySelectorAll('button')];
      likeButton = buttons.find(b => {
        const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').trim().toLowerCase();
        return label.includes('like') && !label.includes('dislike') && !label.includes('unlike');
      });
    }
    const isAlreadyLiked = likeButton && (likeButton.getAttribute('aria-pressed') === 'true' || 
                           likeButton.closest('like-button-view-model')?.getAttribute('aria-pressed') === 'true' ||
                           likeButton.closest('ytd-like-button-renderer')?.querySelector('button[aria-pressed="true"]'));
    if (isAlreadyLiked) {
      this.simulateClick(likeButton);
      return true;
    }

    // 2. Otherwise click dislike button
    const dedicatedDislikeContainer = root.querySelector('#dislike-button, ytd-dislike-button-renderer, dislike-button-view-model');
    let dislikeButton = dedicatedDislikeContainer?.querySelector('button, yt-button-shape button');
    if (!dislikeButton) {
      const buttons = [...root.querySelectorAll('button')];
      dislikeButton = buttons.find(b => {
        const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').trim().toLowerCase();
        return label.includes('dislike') || label.includes('je n\'aime pas');
      });
    }
    if (dislikeButton) {
      this.simulateClick(dislikeButton);
      return true;
    }
    return false;
  }

  togglePlay() {
    const video = this.getVideo();
    if (!video) return false;
    if (video.paused) {
      video.play().catch(() => {
        const root = this.getActiveRenderer() || document;
        const playBtn = root.querySelector('button[aria-label*="Play" i], .ytp-play-button');
        if (playBtn) this.simulateClick(playBtn);
        else video.click();
      });
      return true;
    } else {
      video.pause();
      return true;
    }
  }
}
