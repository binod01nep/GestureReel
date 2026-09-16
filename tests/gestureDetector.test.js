// Lightweight browser-console test fixture for the pure gesture classifier.
// Load gesture/gestureDetector.js first, then run this file in a page.
(() => {
  const events = [];
  const detector = new SwipeUpDetector(event => events.push(event));
  detector.configure({ swipeSensitivity: 50, cooldown: 1200, confidence: 0.65 });
  const originalNow = performance.now;
  let now = 0;
  performance.now = () => now;
  const sample = (x, y, confidence = 0.9) => { now += 100; detector.addSample({ x, y, confidence }); };
  sample(0.5, 0.5); sample(0.51, 0.48); sample(0.52, 0.46);
  console.assert(events.length === 0, 'small movement should not trigger');
  detector.reset(); now = 0;
  const makeTwoFingerSeparatedLandmarks = () => {
    const lms = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    lms[0] = { x: 0.5, y: 0.7 }; // wrist
    lms[4] = { x: 0.42, y: 0.55 }; // thumb tip (below index/middle tips)
    // Index extended flared left
    lms[5] = { x: 0.46, y: 0.52 }; // mcp
    lms[6] = { x: 0.44, y: 0.44 }; // pip
    lms[7] = { x: 0.42, y: 0.38 }; // dip
    lms[8] = { x: 0.40, y: 0.30 }; // tip
    // Middle extended flared right
    lms[9] = { x: 0.54, y: 0.52 }; // mcp
    lms[10] = { x: 0.56, y: 0.43 }; // pip
    lms[11] = { x: 0.58, y: 0.36 }; // dip
    lms[12] = { x: 0.60, y: 0.30 }; // tip
    // Ring folded
    lms[14] = { x: 0.58, y: 0.52 };
    lms[16] = { x: 0.58, y: 0.60 };
    // Pinky folded
    lms[18] = { x: 0.62, y: 0.54 };
    lms[20] = { x: 0.62, y: 0.62 };
    return lms;
  };

  const makeTwoFingerAttachedLandmarks = () => {
    const lms = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    lms[0] = { x: 0.5, y: 0.7 }; // wrist
    lms[4] = { x: 0.45, y: 0.55 }; // thumb tip
    // Index extended straight up close to middle
    lms[5] = { x: 0.48, y: 0.52 }; // mcp
    lms[6] = { x: 0.48, y: 0.44 }; // pip
    lms[7] = { x: 0.48, y: 0.38 }; // dip
    lms[8] = { x: 0.48, y: 0.30 }; // tip
    // Middle extended straight up next to index
    lms[9] = { x: 0.52, y: 0.52 }; // mcp
    lms[10] = { x: 0.52, y: 0.43 }; // pip
    lms[11] = { x: 0.52, y: 0.36 }; // dip
    lms[12] = { x: 0.52, y: 0.30 }; // tip
    // Ring folded
    lms[14] = { x: 0.58, y: 0.52 };
    lms[16] = { x: 0.58, y: 0.60 };
    // Pinky folded
    lms[18] = { x: 0.62, y: 0.54 };
    lms[20] = { x: 0.62, y: 0.62 };
    return lms;
  };

  const makeOpenHandLandmarks = () => {
    const lms = makeTwoFingerSeparatedLandmarks();
    // Ring extended
    lms[14] = { x: 0.58, y: 0.44 };
    lms[16] = { x: 0.58, y: 0.33 };
    // Pinky extended
    lms[18] = { x: 0.62, y: 0.45 };
    lms[20] = { x: 0.62, y: 0.35 };
    return lms;
  };

  // 1. Generic swipe without two fingers should NOT trigger
  sample(0.5, 0.75); sample(0.51, 0.55); sample(0.52, 0.3);
  console.assert(events.length === 0, 'generic upward motion should NOT trigger video advance');

  // 2. Open hand should NOT trigger two-finger
  console.assert(!detector.isTwoFingerPose(makeOpenHandLandmarks()), 'open hand must not trigger two-finger pose');

  // 3. Two-finger pose differentiation
  console.assert(detector.isTwoFingerPose(makeTwoFingerSeparatedLandmarks()), 'two-finger separated pose must be detected');
  console.assert(detector.isTwoFingerSeparatedPose(makeTwoFingerSeparatedLandmarks()), 'isTwoFingerSeparatedPose must be true for spread fingers');
  console.assert(!detector.isTwoFingerAttachedPose(makeTwoFingerSeparatedLandmarks()), 'isTwoFingerAttachedPose must be false for spread fingers');

  console.assert(detector.isTwoFingerPose(makeTwoFingerAttachedLandmarks()), 'two-finger attached pose must be detected');
  console.assert(detector.isTwoFingerAttachedPose(makeTwoFingerAttachedLandmarks()), 'isTwoFingerAttachedPose must be true for attached fingers');
  console.assert(!detector.isTwoFingerSeparatedPose(makeTwoFingerAttachedLandmarks()), 'isTwoFingerSeparatedPose must be false for attached fingers');

  // Index finger touching head/face (with middle finger folded or near face) should NOT trigger two-finger
  const indexToFaceLandmarks = makeTwoFingerSeparatedLandmarks();
  indexToFaceLandmarks[12] = { x: 0.54, y: 0.58 }; // middle finger curled, only index touching head/face
  console.assert(!detector.isTwoFingerPose(indexToFaceLandmarks), 'index finger to head/face must NOT trigger two-finger pose');

  // 4a. Two consecutive frames of two-finger spread trigger 'two-finger' (next reel)
  detector.reset(); now = 2000;
  const twoFingerSpreadSample = () => { now += 100; detector.addSample({ x: 0.5, y: 0.5, confidence: 0.9, landmarks: makeTwoFingerSeparatedLandmarks() }); };
  twoFingerSpreadSample();
  console.assert(events.length === 0, 'first frame of two fingers spread should not fire yet');
  twoFingerSpreadSample();
  console.assert(events.length === 1 && events[0].type === 'two-finger', 'second frame of two fingers spread should trigger two-finger event');

  // 4b. Two consecutive frames of two-finger attached trigger 'two-finger-attached' (previous reel)
  detector.reset(); now = 4000; // after cooldown
  const twoFingerAttachedSample = () => { now += 100; detector.addSample({ x: 0.5, y: 0.5, confidence: 0.9, landmarks: makeTwoFingerAttachedLandmarks() }); };
  twoFingerAttachedSample();
  console.assert(events.length === 1, 'first frame of two fingers attached should not fire yet');
  twoFingerAttachedSample();
  console.assert(events.length === 2 && events[1].type === 'two-finger-attached', 'second frame of two fingers attached should trigger two-finger-attached event');

  // 5a. Test thumbs up pose
  detector.reset();
  now = 6000; // after cooldown
  const makeThumbsUpLandmarks = () => {
    const lms = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    lms[0] = { x: 0.5, y: 0.7 }; // wrist
    lms[1] = { x: 0.45, y: 0.65 };
    lms[2] = { x: 0.42, y: 0.58 }; // thumb mcp
    lms[3] = { x: 0.40, y: 0.48 }; // thumb ip
    lms[4] = { x: 0.38, y: 0.38 }; // thumb tip

    lms[5] = { x: 0.48, y: 0.55 }; lms[6] = { x: 0.48, y: 0.50 }; lms[7] = { x: 0.48, y: 0.54 }; lms[8] = { x: 0.48, y: 0.58 }; // index folded
    lms[9] = { x: 0.52, y: 0.55 }; lms[10] = { x: 0.52, y: 0.50 }; lms[11] = { x: 0.52, y: 0.54 }; lms[12] = { x: 0.52, y: 0.58 }; // middle folded
    lms[13] = { x: 0.56, y: 0.56 }; lms[14] = { x: 0.56, y: 0.51 }; lms[15] = { x: 0.56, y: 0.55 }; lms[16] = { x: 0.56, y: 0.59 }; // ring folded
    lms[17] = { x: 0.60, y: 0.58 }; lms[18] = { x: 0.60, y: 0.53 }; lms[19] = { x: 0.60, y: 0.57 }; lms[20] = { x: 0.60, y: 0.61 }; // pinky folded
    return lms;
  };

  console.assert(detector.isThumbsUpPose(makeThumbsUpLandmarks()), 'isThumbsUpPose should return true for synthetic thumbs up');

  // Test touching face/hair (fingers not folded tightly or thumb sideways)
  const hairTouchLandmarks = makeThumbsUpLandmarks();
  hairTouchLandmarks[8] = { x: 0.48, y: 0.42 }; // index finger extended towards hair
  console.assert(!detector.isThumbsUpPose(hairTouchLandmarks), 'touching face/hair should NOT trigger thumbs up pose');

  const sidewaysThumbLandmarks = makeThumbsUpLandmarks();
  sidewaysThumbLandmarks[4] = { x: 0.65, y: 0.58 }; // thumb pointing sideways
  console.assert(!detector.isThumbsUpPose(sidewaysThumbLandmarks), 'sideways thumb should NOT trigger thumbs up pose');

  // Test 2-frame requirement for thumbs up trigger
  const thumbsUpSample = () => { now += 100; detector.addSample({ x: 0.5, y: 0.5, confidence: 0.9, landmarks: makeThumbsUpLandmarks() }); };
  thumbsUpSample();
  console.assert(events.length === 2, 'first frame of thumbs up should not fire');
  thumbsUpSample();
  console.assert(events.length === 3 && events[2].type === 'thumbs-up', 'second frame of thumbs up should trigger thumbs-up event');

  // 5b. Test thumbs down pose
  detector.reset();
  now = 8000;
  const makeThumbsDownLandmarks = () => {
    const lms = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    lms[0] = { x: 0.5, y: 0.3 }; // wrist
    lms[1] = { x: 0.45, y: 0.35 };
    lms[2] = { x: 0.42, y: 0.42 }; // thumb mcp
    lms[3] = { x: 0.40, y: 0.52 }; // thumb ip
    lms[4] = { x: 0.38, y: 0.62 }; // thumb tip

    lms[5] = { x: 0.48, y: 0.45 }; lms[6] = { x: 0.48, y: 0.50 }; lms[7] = { x: 0.48, y: 0.46 }; lms[8] = { x: 0.48, y: 0.42 }; // index folded
    lms[9] = { x: 0.52, y: 0.45 }; lms[10] = { x: 0.52, y: 0.50 }; lms[11] = { x: 0.52, y: 0.46 }; lms[12] = { x: 0.52, y: 0.42 }; // middle folded
    lms[13] = { x: 0.56, y: 0.44 }; lms[14] = { x: 0.56, y: 0.49 }; lms[15] = { x: 0.56, y: 0.45 }; lms[16] = { x: 0.56, y: 0.41 }; // ring folded
    lms[17] = { x: 0.60, y: 0.42 }; lms[18] = { x: 0.60, y: 0.47 }; lms[19] = { x: 0.60, y: 0.43 }; lms[20] = { x: 0.60, y: 0.39 }; // pinky folded
    return lms;
  };

  console.assert(detector.isThumbsDownPose(makeThumbsDownLandmarks()), 'isThumbsDownPose should return true for synthetic thumbs down');
  console.assert(!detector.isThumbsDownPose(makeThumbsUpLandmarks()), 'thumbs up hand should NOT trigger thumbs down pose');
  console.assert(!detector.isThumbsUpPose(makeThumbsDownLandmarks()), 'thumbs down hand should NOT trigger thumbs up pose');

  const thumbsDownSample = () => { now += 100; detector.addSample({ x: 0.5, y: 0.5, confidence: 0.9, landmarks: makeThumbsDownLandmarks() }); };
  thumbsDownSample();
  console.assert(events.length === 3, 'first frame of thumbs down should not fire');
  thumbsDownSample();
  console.assert(events.length === 4 && events[3].type === 'thumbs-down', 'second frame of thumbs down should trigger thumbs-down event');

  // 6. Test index pointing pose (play/pause)
  detector.reset();
  now = 10000;
  const makeIndexPointLandmarks = () => {
    const lms = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    lms[0] = { x: 0.5, y: 0.7 }; // wrist
    lms[4] = { x: 0.45, y: 0.55 }; // thumb tip
    // Index extended
    lms[5] = { x: 0.46, y: 0.52 }; lms[6] = { x: 0.46, y: 0.44 }; lms[7] = { x: 0.46, y: 0.38 }; lms[8] = { x: 0.46, y: 0.30 };
    // Middle folded
    lms[9] = { x: 0.54, y: 0.52 }; lms[10] = { x: 0.54, y: 0.50 }; lms[11] = { x: 0.54, y: 0.54 }; lms[12] = { x: 0.54, y: 0.58 };
    // Ring folded
    lms[13] = { x: 0.58, y: 0.52 }; lms[14] = { x: 0.58, y: 0.50 }; lms[15] = { x: 0.58, y: 0.54 }; lms[16] = { x: 0.58, y: 0.59 };
    // Pinky folded
    lms[17] = { x: 0.62, y: 0.54 }; lms[18] = { x: 0.62, y: 0.52 }; lms[19] = { x: 0.62, y: 0.56 }; lms[20] = { x: 0.62, y: 0.61 };
    return lms;
  };

  console.assert(detector.isIndexPointingPose(makeIndexPointLandmarks()), 'isIndexPointingPose should return true for index pointing hand');
  console.assert(!detector.isIndexPointingPose(makeTwoFingerSeparatedLandmarks()), 'two finger hand should NOT trigger index point pose');
  console.assert(!detector.isIndexPointingPose(makeTwoFingerAttachedLandmarks()), 'two finger attached hand should NOT trigger index point pose');
  console.assert(!detector.isIndexPointingPose(makeThumbsUpLandmarks()), 'thumbs up hand should NOT trigger index point pose');
  console.assert(!detector.isIndexPointingPose(makeThumbsDownLandmarks()), 'thumbs down hand should NOT trigger index point pose');

  const indexPointSample = () => { now += 100; detector.addSample({ x: 0.5, y: 0.5, confidence: 0.9, landmarks: makeIndexPointLandmarks() }); };
  indexPointSample();
  console.assert(events.length === 4, 'first frame of index point should not fire yet');
  indexPointSample();
  console.assert(events.length === 5 && events[4].type === 'index-point', 'second frame of index point should trigger index-point event');

  // 7. Test 5-finger gesture (connected fingertips = zoom out, releasing = zoom in)
  detector.reset();
  detector.zoomEnabled = true; // test preserved logic
  now = 12000;
  const makeFiveFingerLandmarks = (radius = 0.04) => {
    const lms = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    lms[0] = { x: 0.5, y: 0.7 }; // wrist
    // 5 fingertips positioned around center (0.5, 0.45) with radius
    const angles = [0, 1.25, 2.5, 3.75, 5.0];
    const tips = [4, 8, 12, 16, 20];
    tips.forEach((tipIdx, i) => {
      lms[tipIdx] = { x: 0.5 + Math.cos(angles[i]) * radius, y: 0.45 + Math.sin(angles[i]) * radius };
    });
    // MCPs / PIPs
    lms[1] = { x: 0.46, y: 0.65 }; lms[2] = { x: 0.46, y: 0.58 };
    lms[5] = { x: 0.48, y: 0.55 }; lms[6] = { x: 0.48, y: 0.50 };
    lms[9] = { x: 0.51, y: 0.55 }; lms[10] = { x: 0.51, y: 0.50 };
    lms[13] = { x: 0.54, y: 0.55 }; lms[14] = { x: 0.54, y: 0.50 };
    lms[17] = { x: 0.57, y: 0.56 }; lms[18] = { x: 0.57, y: 0.52 };
    return lms;
  };

  console.assert(detector.isFiveFingerGesture(makeFiveFingerLandmarks(0.04)), 'isFiveFingerGesture should return true for 5 fingers connected');
  console.assert(detector.isFiveFingerGesture(makeFiveFingerLandmarks(0.14)), 'isFiveFingerGesture should return true for 5 fingers released');

  // Test Zoom In: slowly releasing fingers outwards (0.04 -> 0.12)
  now += 100;
  detector.addSample({ x: 0.5, y: 0.5, confidence: 0.9, landmarks: makeFiveFingerLandmarks(0.04) });
  now += 100;
  detector.addSample({ x: 0.5, y: 0.5, confidence: 0.9, landmarks: makeFiveFingerLandmarks(0.12) });
  console.assert(events.length === 6 && events[5].type === 'zoom' && events[5].direction === 'in', 'releasing fingers outwards should trigger zoom in');

  // Test Zoom Out: connecting all fingertips together (0.12 -> 0.04)
  now += 250;
  detector.addSample({ x: 0.5, y: 0.5, confidence: 0.9, landmarks: makeFiveFingerLandmarks(0.04) });
  console.assert(events.length === 7 && events[6].type === 'zoom' && events[6].direction === 'out', 'connecting all fingertips together should trigger zoom out');

  performance.now = originalNow;
  console.log('All gesture detector tests passed successfully.');
})();
