# GestureReel

GestureReel is a Manifest V3 Chrome extension for controlling short-form video feeds with a local webcam hand gesture. It is designed for YouTube Shorts, Instagram Reels, and Facebook Reels.

## Features

- **Next Reel**: Show two fingers spread (peace sign ✌️) with ring and pinky folded.
- **Previous Reel**: Show two fingers attached/joined side-by-side with ring and pinky folded.
- **Like Reel**: Show thumbs up (👍).
- **Dislike / Unlike Reel**: Show thumbs down (👎) to dislike or remove an existing like.
- **Play / Pause**: Show index finger pointing upward (☝️).
- Optional automatic advance when the HTML5 video ends.
- Separate navigation adapters for YouTube Shorts, Instagram Reels, and Facebook Reels (Next, Previous, Like, Dislike/Unlike, Play/Pause).
- Local webcam processing with a sleek HUD and status indicator.
- Persistent gesture, auto-next, sensitivity, cooldown, confidence, and preview settings.
- Frame throttling, tab-safe cleanup, cooldown protection, and graceful camera errors.

## Architecture

- `manifest.json`: MV3 permissions, content-script entry points, and popup registration.
- `background/service-worker.js`: installs default settings and relays extension messages.
- `content/platformDetector.js`: selects the platform adapter, binds the active video, and owns navigation locks.
- `content/youtube.js`, `content/instagram.js`, `content/facebook.js`: platform-specific video and next-item behavior.
- `gesture/camera.js`: explicit camera lifecycle, preview, 10 FPS processing loop, and cleanup.
- `gesture/handTracker.js`: MediaPipe Hands integration and wrist landmark extraction.
- `gesture/gestureDetector.js`: bounded multi-frame swipe classification.
- `popup/`: settings UI and status display.

## Technologies

Chrome Manifest V3, vanilla JavaScript, Chrome Storage API, MediaPipe Hands, HTML5 MediaDevices API.

## Installation

1. Download or clone this project.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `gesture-reel` folder.
6. Open a supported Shorts/Reels page and click the GestureReel toolbar icon.

The MediaPipe Hands runtime is loaded when gesture control is first enabled. Webcam frames are sent to the local in-page tracker only; GestureReel does not upload, store, or record frames.

## Usage

1. Open a YouTube Short, Instagram Reel, or Facebook Reel.
2. Open the popup and enable **Gesture control**.
3. Grant camera permission when Chrome asks.
4. Swipe your hand upward in front of the camera to advance.
5. Adjust sensitivity and cooldown in the popup. Disable the preview from the settings object if you prefer invisible processing; the camera status remains visible.

## Gesture algorithm

The detector records wrist positions across recent frames. It triggers a swipe only when upward displacement exceeds the sensitivity-derived minimum, vertical movement dominates horizontal movement, the movement completes within 650 ms, landmark confidence is sufficient, and the cooldown has elapsed. It also recognizes two raised fingers (index and middle) with ring and pinky folded across two confident frames. A successful gesture clears the history and locks navigation until the configured cooldown expires.

## Supported platforms and limitations

Platform layouts change frequently. GestureReel prefers visible HTML5 video elements and accessible next controls, then falls back to an Arrow Down keyboard event. Instagram and Facebook may require the feed to be focused, and autoplay or login state can affect `video.ended`. The extension does not bypass platform permissions, sign-in, age gates, or browser autoplay rules.

The MediaPipe Hands runtime, model data, and WASM binaries are vendored under `vendor/mediapipe/hands`. GestureReel does not load executable code or model assets from the network.

## Privacy

The camera is never requested until the user enables gesture control. Processing occurs in the page using MediaPipe; no webcam frame is sent to a server or written to disk. Disabling gesture control stops every camera track and removes the preview. The only persisted data is the extension's settings in Chrome sync storage.

## Testing checklist

- Small or slow movement: no action.
- Horizontal movement: no action.
- Fast upward movement: one next action.
- Repeated swipe during cooldown: one next action.
- Video end with auto-next on: adapter navigation.
- Video end with auto-next off: no navigation.
- Camera permission denied or unavailable: popup remains usable and reports an error in the page console.
- Switch tabs or disable gesture control: camera tracks stop and processing ends.

## Future improvements

Add automated browser tests with platform fixtures, expose confidence threshold in the popup, draw landmarks on a canvas preview, and add adapter-specific selectors maintained through platform smoke tests.
