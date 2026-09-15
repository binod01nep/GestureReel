class SwipeUpDetector {
  constructor(onSwipe) {
    this.onSwipe = onSwipe;
    this.history = [];
    this.cooldownUntil = 0;
    this.twoFingerFrames = 0;
    this.thumbsUpFrames = 0;
    this.indexFingerFrames = 0;
    this.lastFiveFingerSpread = null;
    this.zoomCooldownUntil = 0;
    this.zoomEnabled = false; // Zoom feature cut off for now (code preserved)
    this.config = { distance: 0.18, duration: 650, cooldown: 1200, confidence: 0.65 };
  }

  configure(settings) {
    this.config = {
      distance: 0.08 + ((100 - Number(settings.swipeSensitivity || 50)) / 100) * 0.2,
      duration: 650,
      cooldown: Number(settings.cooldown || 1200),
      confidence: Number(settings.confidence || 0.65)
    };
  }

  reset() {
    this.history = [];
    this.twoFingerFrames = 0;
    this.thumbsUpFrames = 0;
    this.indexFingerFrames = 0;
    this.lastFiveFingerSpread = null;
  }

  dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  isTwoFingerPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];

    // 1. Index finger extended upward and away from wrist
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];
    const indexUp = indexTip.y < indexPip.y && indexPip.y < indexMcp.y && indexTip.y < wrist.y;
    const indexExtended = (indexMcp.y - indexTip.y) > 0.08;
    const indexVertical = Math.abs(indexMcp.y - indexTip.y) > Math.abs(indexMcp.x - indexTip.x) * 0.8;
    const indexFromWrist = this.dist(indexTip, wrist) > this.dist(indexMcp, wrist) * 1.2;

    if (!indexUp || !indexExtended || !indexVertical || !indexFromWrist) return false;

    // 2. Middle finger extended upward and away from wrist (both index AND middle must be clearly extended!)
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const middleMcp = landmarks[9];
    const middleUp = middleTip.y < middlePip.y && middlePip.y < middleMcp.y && middleTip.y < wrist.y;
    const middleExtended = (middleMcp.y - middleTip.y) > 0.08;
    const middleVertical = Math.abs(middleMcp.y - middleTip.y) > Math.abs(middleMcp.x - middleTip.x) * 0.8;
    const middleFromWrist = this.dist(middleTip, wrist) > this.dist(middleMcp, wrist) * 1.2;

    if (!middleUp || !middleExtended || !middleVertical || !middleFromWrist) return false;

    // 3. In a two-finger peace sign, both extended fingers must reach similar heights
    if (Math.abs(indexTip.y - middleTip.y) > 0.08) return false;

    // 4. Ring finger must be folded tightly in the palm
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const ringFolded = ringTip.y > ringPip.y;
    const ringTucked = this.dist(ringTip, wrist) <= this.dist(ringPip, wrist) + 0.02;

    // 5. Pinky finger must be folded tightly in the palm
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];
    const pinkyFolded = pinkyTip.y > pinkyPip.y;
    const pinkyTucked = this.dist(pinkyTip, wrist) <= this.dist(pinkyPip, wrist) + 0.02;

    if (!ringFolded || !ringTucked || !pinkyFolded || !pinkyTucked) return false;

    // 6. Extended fingers must be significantly higher than folded ring and pinky fingers
    if (indexTip.y >= ringTip.y - 0.06 || indexTip.y >= pinkyTip.y - 0.06) return false;
    if (middleTip.y >= ringTip.y - 0.06 || middleTip.y >= pinkyTip.y - 0.06) return false;

    // 7. Thumb below index and middle fingertips
    const thumbTip = landmarks[4];
    if (thumbTip.y <= indexTip.y + 0.04 || thumbTip.y <= middleTip.y + 0.04) return false;

    return true;
  }

  isThumbsUpPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const thumbMcp = landmarks[2];

    // 1. Thumb must be extended upward and higher than wrist and its own joints
    const thumbUp = thumbTip.y < thumbIp.y && thumbIp.y < thumbMcp.y && thumbTip.y < wrist.y;
    const thumbVertical = (thumbMcp.y - thumbTip.y) > 0.07;
    const thumbMostlyVertical = Math.abs(thumbMcp.y - thumbTip.y) > Math.abs(thumbMcp.x - thumbTip.x) * 0.85;
    const thumbExtended = this.dist(thumbTip, wrist) > this.dist(thumbMcp, wrist) * 1.15;

    if (!thumbUp || !thumbVertical || !thumbMostlyVertical || !thumbExtended) return false;

    // 2. Thumb tip must be clearly above knuckles (MCP joints 5 and 9)
    if (thumbTip.y >= landmarks[5].y - 0.04 || thumbTip.y >= landmarks[9].y - 0.04) return false;

    // 3. All four fingers must be curled tightly in a fist (not touching hair, face, or loosely hanging)
    const fingers = [
      { tip: 8, pip: 6, mcp: 5 },    // Index
      { tip: 12, pip: 10, mcp: 9 },  // Middle
      { tip: 16, pip: 14, mcp: 13 }, // Ring
      { tip: 20, pip: 18, mcp: 17 }  // Pinky
    ];

    for (const f of fingers) {
      const tip = landmarks[f.tip];
      const pip = landmarks[f.pip];
      // Finger tip must be curled below PIP
      if (tip.y <= pip.y) return false;
      // In a fist, the tip is curled inwards towards the palm, closer to wrist than PIP
      if (this.dist(tip, wrist) > this.dist(pip, wrist) + 0.02) return false;
      // Thumb tip must be well above each finger tip
      if (thumbTip.y >= tip.y - 0.04) return false;
    }

    return true;
  }

  isIndexPointingPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];

    // 1. Index finger extended upward
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];
    const indexUp = indexTip.y < indexPip.y && indexPip.y < indexMcp.y && indexTip.y < wrist.y;
    const indexExtended = (indexMcp.y - indexTip.y) > 0.07;
    const indexVertical = Math.abs(indexMcp.y - indexTip.y) > Math.abs(indexMcp.x - indexTip.x) * 0.85;

    if (!indexUp || !indexExtended || !indexVertical) return false;

    // 2. Middle, Ring, Pinky must be curled/folded
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const middleFolded = middleTip.y > middlePip.y;

    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const ringFolded = ringTip.y > ringPip.y;

    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];
    const pinkyFolded = pinkyTip.y > pinkyPip.y;

    if (!middleFolded || !ringFolded || !pinkyFolded) return false;

    // Ensure other fingertips are close to palm/wrist
    if (this.dist(middleTip, wrist) > this.dist(middlePip, wrist) + 0.02) return false;
    if (this.dist(ringTip, wrist) > this.dist(ringPip, wrist) + 0.02) return false;
    if (this.dist(pinkyTip, wrist) > this.dist(pinkyPip, wrist) + 0.02) return false;

    // 3. Index tip must be the highest point of the hand, well above all other fingers
    if (indexTip.y >= middleTip.y - 0.05) return false;
    if (indexTip.y >= ringTip.y - 0.05) return false;
    if (indexTip.y >= pinkyTip.y - 0.05) return false;

    // 4. Thumb must be below the index fingertip
    const thumbTip = landmarks[4];
    if (thumbTip.y <= indexTip.y + 0.04) return false;

    return true;
  }

  isFiveFingerGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];
    const tips = [4, 8, 12, 16, 20];
    for (const idx of tips) {
      if (this.dist(landmarks[idx], wrist) < 0.11) return false;
    }
    // Ring and pinky must not be folded deep into the palm (as in peace sign or index point)
    if (landmarks[16].y > landmarks[14].y + 0.06 && landmarks[20].y > landmarks[18].y + 0.06) {
      return false;
    }
    return true;
  }

  getFiveFingerSpread(landmarks) {
    const tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const cx = tips.reduce((sum, p) => sum + p.x, 0) / 5;
    const cy = tips.reduce((sum, p) => sum + p.y, 0) / 5;
    const center = { x: cx, y: cy };
    let totalDist = 0;
    for (const tip of tips) {
      totalDist += this.dist(tip, center);
    }
    return totalDist / 5;
  }

  addSample(point) {
    const now = performance.now();
    if (!point || point.confidence < this.config.confidence) { this.reset(); return; }
    if (now >= this.cooldownUntil) {
      if (this.isThumbsUpPose(point.landmarks)) {
        this.lastFiveFingerSpread = null;
        this.thumbsUpFrames = (this.thumbsUpFrames || 0) + 1;
        this.twoFingerFrames = 0;
        this.indexFingerFrames = 0;
        if (this.thumbsUpFrames >= 3) {
          this.cooldownUntil = now + this.config.cooldown;
          this.reset();
          this.onSwipe({ type: 'thumbs-up' });
          return;
        }
      } else if (this.isTwoFingerPose(point.landmarks)) {
        this.lastFiveFingerSpread = null;
        this.twoFingerFrames = (this.twoFingerFrames || 0) + 1;
        this.thumbsUpFrames = 0;
        this.indexFingerFrames = 0;
        if (this.twoFingerFrames >= 3) {
          this.cooldownUntil = now + this.config.cooldown;
          this.reset();
          this.onSwipe({ type: 'two-finger' });
          return;
        }
      } else if (this.isIndexPointingPose(point.landmarks)) {
        this.lastFiveFingerSpread = null;
        this.indexFingerFrames = (this.indexFingerFrames || 0) + 1;
        this.thumbsUpFrames = 0;
        this.twoFingerFrames = 0;
        if (this.indexFingerFrames >= 2) {
          this.cooldownUntil = now + this.config.cooldown;
          this.reset();
          this.onSwipe({ type: 'index-point' });
          return;
        }
      } else if (this.zoomEnabled && this.isFiveFingerGesture(point.landmarks)) {
        this.twoFingerFrames = 0;
        this.thumbsUpFrames = 0;
        this.indexFingerFrames = 0;
        const currentSpread = this.getFiveFingerSpread(point.landmarks);
        if (this.lastFiveFingerSpread !== null) {
          const delta = currentSpread - this.lastFiveFingerSpread;
          if (now >= this.zoomCooldownUntil) {
            // Releasing fingers outward (spread increasing) -> Zoom In
            if (delta > 0.02) {
              this.zoomCooldownUntil = now + 180;
              this.lastFiveFingerSpread = currentSpread;
              this.onSwipe({ type: 'zoom', direction: 'in', spread: currentSpread });
              return;
            }
            // Fingertips connected together (spread decreasing or tight cluster) -> Zoom Out
            else if (delta < -0.02 || currentSpread < 0.06) {
              this.zoomCooldownUntil = now + 180;
              this.lastFiveFingerSpread = currentSpread;
              this.onSwipe({ type: 'zoom', direction: 'out', spread: currentSpread });
              return;
            }
          }
        } else {
          this.lastFiveFingerSpread = currentSpread;
        }
      } else {
        this.twoFingerFrames = 0;
        this.thumbsUpFrames = 0;
        this.indexFingerFrames = 0;
        this.lastFiveFingerSpread = null;
      }
    } else {
      this.twoFingerFrames = 0;
      this.thumbsUpFrames = 0;
      this.indexFingerFrames = 0;
      this.lastFiveFingerSpread = null;
    }
  }
}
