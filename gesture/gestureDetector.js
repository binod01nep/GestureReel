class SwipeUpDetector {
  constructor(onSwipe) {
    this.onSwipe = onSwipe;
    this.history = [];
    this.cooldownUntil = 0;
    this.twoFingerFrames = 0;
    this.twoFingerSpreadFrames = 0;
    this.twoFingerAttachedFrames = 0;
    this.thumbsUpFrames = 0;
    this.thumbsDownFrames = 0;
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
    this.twoFingerSpreadFrames = 0;
    this.twoFingerAttachedFrames = 0;
    this.thumbsUpFrames = 0;
    this.thumbsDownFrames = 0;
    this.indexFingerFrames = 0;
    this.lastFiveFingerSpread = null;
  }

  dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  isTwoFingerPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];
    const handScale = Math.max(0.12, this.dist(wrist, landmarks[9]));

    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];

    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const middleMcp = landmarks[9];

    const ringTip = landmarks[16];
    const ringPip = landmarks[14];

    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    const thumbTip = landmarks[4];

    // 1. Index & Middle fingers extended upward
    const indexUp = indexTip.y < indexPip.y && indexTip.y < indexMcp.y && indexTip.y < wrist.y;
    const middleUp = middleTip.y < middlePip.y && middleTip.y < middleMcp.y && middleTip.y < wrist.y;
    if (!indexUp || !middleUp) return false;

    // Both index & middle must be extended away from knuckles
    if ((indexMcp.y - indexTip.y) < handScale * 0.22 || (middleMcp.y - middleTip.y) < handScale * 0.22) return false;

    // 2. Ring & Pinky fingers must be folded/curled
    const ringFolded = ringTip.y > ringPip.y || this.dist(ringTip, wrist) < this.dist(indexTip, wrist) * 0.85;
    const pinkyFolded = pinkyTip.y > pinkyPip.y || this.dist(pinkyTip, wrist) < this.dist(middleTip, wrist) * 0.85;
    if (!ringFolded || !pinkyFolded) return false;

    // 3. Extended fingertips must be higher than folded ring & pinky fingertips
    if (indexTip.y >= ringTip.y - 0.02 || indexTip.y >= pinkyTip.y - 0.02) return false;
    if (middleTip.y >= ringTip.y - 0.02 || middleTip.y >= pinkyTip.y - 0.02) return false;

    // 4. Thumb must not be above index & middle fingertips
    if (thumbTip.y <= indexTip.y || thumbTip.y <= middleTip.y) return false;

    return true;
  }

  isTwoFingerAttachedPose(landmarks) {
    if (!this.isTwoFingerPose(landmarks)) return false;
    const tipDist = this.dist(landmarks[8], landmarks[12]);
    const mcpDist = this.dist(landmarks[5], landmarks[9]);
    return tipDist <= Math.max(0.045, mcpDist * 1.15);
  }

  isTwoFingerSeparatedPose(landmarks) {
    if (!this.isTwoFingerPose(landmarks)) return false;
    const tipDist = this.dist(landmarks[8], landmarks[12]);
    const mcpDist = this.dist(landmarks[5], landmarks[9]);
    return tipDist > Math.max(0.045, mcpDist * 1.15);
  }

  isThumbsUpPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const thumbMcp = landmarks[2];
    const handScale = Math.max(0.12, this.dist(wrist, landmarks[9]));

    // 1. Thumb extended upward
    const thumbUp = thumbTip.y < thumbIp.y && thumbIp.y < thumbMcp.y && thumbTip.y < wrist.y;
    const thumbVertical = (thumbMcp.y - thumbTip.y) > handScale * 0.22;
    if (!thumbUp || !thumbVertical) return false;

    // 2. Thumb tip clearly above knuckles
    if (thumbTip.y >= landmarks[5].y - 0.02 || thumbTip.y >= landmarks[9].y - 0.02) return false;

    // 3. Four fingers folded in a fist
    const fingers = [
      { tip: 8, pip: 6 },
      { tip: 12, pip: 10 },
      { tip: 16, pip: 14 },
      { tip: 20, pip: 18 }
    ];
    for (const f of fingers) {
      const tip = landmarks[f.tip];
      const pip = landmarks[f.pip];
      if (tip.y < pip.y && this.dist(tip, wrist) > this.dist(pip, wrist) + 0.02) return false;
      if (thumbTip.y >= tip.y - 0.02) return false;
    }

    return true;
  }

  isThumbsDownPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const thumbMcp = landmarks[2];
    const handScale = Math.max(0.12, this.dist(wrist, landmarks[9]));

    // 1. Thumb extended downward
    const thumbDown = thumbTip.y > thumbIp.y && thumbIp.y > thumbMcp.y;
    const thumbVertical = (thumbTip.y - thumbMcp.y) > handScale * 0.22;
    if (!thumbDown || !thumbVertical) return false;

    // 2. Thumb tip clearly below knuckles
    if (thumbTip.y <= landmarks[5].y + 0.02 || thumbTip.y <= landmarks[9].y + 0.02) return false;

    // 3. Four fingers folded in a fist
    const fingers = [
      { tip: 8, pip: 6 },
      { tip: 12, pip: 10 },
      { tip: 16, pip: 14 },
      { tip: 20, pip: 18 }
    ];
    for (const f of fingers) {
      const tip = landmarks[f.tip];
      const pip = landmarks[f.pip];
      if (this.dist(tip, wrist) > this.dist(pip, wrist) + 0.04) return false;
      if (thumbTip.y <= tip.y + 0.02) return false;
    }

    return true;
  }

  isIndexPointingPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];
    const handScale = Math.max(0.12, this.dist(wrist, landmarks[9]));

    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];

    // 1. Index finger extended upward
    const indexUp = indexTip.y < indexPip.y && indexTip.y < indexMcp.y && indexTip.y < wrist.y;
    const indexExtended = (indexMcp.y - indexTip.y) > handScale * 0.22;
    if (!indexUp || !indexExtended) return false;

    // 2. Other fingers (Middle, Ring, Pinky) must be folded
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    const otherFolded = (middleTip.y > middlePip.y || this.dist(middleTip, wrist) < this.dist(indexTip, wrist) * 0.85) &&
                        (ringTip.y > ringPip.y || this.dist(ringTip, wrist) < this.dist(indexTip, wrist) * 0.85) &&
                        (pinkyTip.y > pinkyPip.y || this.dist(pinkyTip, wrist) < this.dist(indexTip, wrist) * 0.85);
    if (!otherFolded) return false;

    // 3. Index tip must be the highest point of the hand
    if (indexTip.y >= middleTip.y - 0.02 || indexTip.y >= ringTip.y - 0.02 || indexTip.y >= pinkyTip.y - 0.02) return false;
    if (landmarks[4].y <= indexTip.y) return false; // thumb below index tip

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
        this.thumbsDownFrames = 0;
        this.twoFingerSpreadFrames = 0;
        this.twoFingerAttachedFrames = 0;
        this.twoFingerFrames = 0;
        this.indexFingerFrames = 0;
        if (this.thumbsUpFrames >= 2) {
          this.cooldownUntil = now + this.config.cooldown;
          this.reset();
          this.onSwipe({ type: 'thumbs-up' });
          return;
        }
      } else if (this.isThumbsDownPose(point.landmarks)) {
        this.lastFiveFingerSpread = null;
        this.thumbsDownFrames = (this.thumbsDownFrames || 0) + 1;
        this.thumbsUpFrames = 0;
        this.twoFingerSpreadFrames = 0;
        this.twoFingerAttachedFrames = 0;
        this.twoFingerFrames = 0;
        this.indexFingerFrames = 0;
        if (this.thumbsDownFrames >= 2) {
          this.cooldownUntil = now + this.config.cooldown;
          this.reset();
          this.onSwipe({ type: 'thumbs-down' });
          return;
        }
      } else if (this.isTwoFingerAttachedPose(point.landmarks)) {
        this.lastFiveFingerSpread = null;
        this.twoFingerAttachedFrames = (this.twoFingerAttachedFrames || 0) + 1;
        this.twoFingerSpreadFrames = 0;
        this.twoFingerFrames = 0;
        this.thumbsUpFrames = 0;
        this.thumbsDownFrames = 0;
        this.indexFingerFrames = 0;
        if (this.twoFingerAttachedFrames >= 2) {
          this.cooldownUntil = now + this.config.cooldown;
          this.reset();
          this.onSwipe({ type: 'two-finger-attached' });
          return;
        }
      } else if (this.isTwoFingerSeparatedPose(point.landmarks)) {
        this.lastFiveFingerSpread = null;
        this.twoFingerSpreadFrames = (this.twoFingerSpreadFrames || 0) + 1;
        this.twoFingerAttachedFrames = 0;
        this.twoFingerFrames = this.twoFingerSpreadFrames;
        this.thumbsUpFrames = 0;
        this.thumbsDownFrames = 0;
        this.indexFingerFrames = 0;
        if (this.twoFingerSpreadFrames >= 2) {
          this.cooldownUntil = now + this.config.cooldown;
          this.reset();
          this.onSwipe({ type: 'two-finger' });
          return;
        }
      } else if (this.isIndexPointingPose(point.landmarks)) {
        this.lastFiveFingerSpread = null;
        this.indexFingerFrames = (this.indexFingerFrames || 0) + 1;
        this.thumbsUpFrames = 0;
        this.thumbsDownFrames = 0;
        this.twoFingerSpreadFrames = 0;
        this.twoFingerAttachedFrames = 0;
        this.twoFingerFrames = 0;
        if (this.indexFingerFrames >= 2) {
          this.cooldownUntil = now + this.config.cooldown;
          this.reset();
          this.onSwipe({ type: 'index-point' });
          return;
        }
      } else if (this.zoomEnabled && this.isFiveFingerGesture(point.landmarks)) {
        this.twoFingerSpreadFrames = 0;
        this.twoFingerAttachedFrames = 0;
        this.twoFingerFrames = 0;
        this.thumbsUpFrames = 0;
        this.thumbsDownFrames = 0;
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
        this.twoFingerSpreadFrames = 0;
        this.twoFingerAttachedFrames = 0;
        this.twoFingerFrames = 0;
        this.thumbsUpFrames = 0;
        this.thumbsDownFrames = 0;
        this.indexFingerFrames = 0;
        this.lastFiveFingerSpread = null;
      }
    } else {
      this.twoFingerSpreadFrames = 0;
      this.twoFingerAttachedFrames = 0;
      this.twoFingerFrames = 0;
      this.thumbsUpFrames = 0;
      this.thumbsDownFrames = 0;
      this.indexFingerFrames = 0;
      this.lastFiveFingerSpread = null;
    }
  }
}
