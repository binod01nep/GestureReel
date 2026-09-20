(() => {
  // Test YouTubeController
  const fakeLocation = { hostname: 'www.youtube.com', pathname: '/watch' };
  globalThis.location = fakeLocation;
  globalThis.document = {
    querySelector: (selector) => {
      if (selector.includes('video')) {
        return fakeVideo;
      }
      return null;
    },
    querySelectorAll: () => []
  };

  const fakeVideo = {
    playbackRate: 1.0,
    paused: false,
    closest: () => null,
    getBoundingClientRect: () => ({ width: 640, height: 360, top: 100, bottom: 460 })
  };

  const yt = new YouTubeController();
  console.assert(yt.isSupported(), 'YouTube should be supported on youtube.com');
  console.assert(yt.isRegularVideo(), 'Regular video should be detected on /watch');
  console.assert(!yt.isShorts(), 'Should not be shorts on /watch');
  console.assert(yt.name === 'YouTube Video', 'Name should be YouTube Video');

  // Test setPlaybackRate
  yt.setPlaybackRate(2.0);
  console.assert(fakeVideo.playbackRate === 2.0, 'Playback rate should be set to 2.0');
  console.assert(yt.getPlaybackRate() === 2.0, 'getPlaybackRate should return 2.0');

  yt.setPlaybackRate(1.0);
  console.assert(fakeVideo.playbackRate === 1.0, 'Playback rate should return to 1.0');
  console.assert(yt.getPlaybackRate() === 1.0, 'getPlaybackRate should return 1.0');

  // Test Shorts detection
  fakeLocation.pathname = '/shorts/abcd123';
  console.assert(yt.isShorts(), 'Should detect shorts on /shorts/');
  console.assert(!yt.isRegularVideo(), 'Should not be regular video on /shorts/');
  console.assert(yt.name === 'YouTube Shorts', 'Name should be YouTube Shorts');

  console.log('YouTubeController tests passed successfully.');
})();
