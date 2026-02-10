/**
 * Calcolo scale - supporta tutte le tipologie.
 * Unità: cm
 */

/**
 * Calcola una singola rampa.
 */
export function calcRamp(rampLength, numSteps, totalRiseForRamp) {
  const riserH = totalRiseForRamp / numSteps;
  const treadD = rampLength / (numSteps - 1); // numSteps - 1 pedate (ultimo gradino è il piano)
  const slopeAngle = Math.atan2(totalRiseForRamp, rampLength) * (180 / Math.PI);
  return {
    numSteps,
    numTreads: numSteps - 1,
    riserHeight: round2(riserH),
    treadDepth: round2(treadD),
    totalRun: rampLength,
    totalRise: totalRiseForRamp,
    slopeAngle: round2(slopeAngle),
  };
}

/**
 * Calcola la scala completa (geometria per pianta e sezioni).
 */
export function calculateStair(config) {
  const {
    type, totalHeight, stairWidth, slabThickness,
    rampLength1, rampLength2, rampLength3,
    numSteps1, numSteps2, numSteps3,
    stepThickness, nosing, hasRiser, riserThickness,
    landingDepth, landingDepth2,
    numWinders, innerRadius,
    gapBetween, structureType, stringerWidth, stringerHeight,
    useBlondel,
  } = config;

  const result = {
    type, totalHeight, stairWidth, slabThickness,
    stepThickness, nosing, hasRiser, riserThickness,
    structureType, stringerWidth, stringerHeight,
    ramps: [],
    landings: [],
    winders: [],
    warnings: [],
  };

  if (type === 'straight') {
    const ramp = calcRamp(rampLength1, numSteps1, totalHeight);
    result.ramps.push(ramp);
    buildStraightGeometry(result, ramp);
  }

  else if (type === 'l-landing') {
    // Dividi altezza proporzionalmente ai gradini
    const totalSteps = numSteps1 + numSteps2;
    const h1 = totalHeight * (numSteps1 / totalSteps);
    const h2 = totalHeight - h1;
    const r1 = calcRamp(rampLength1, numSteps1, h1);
    const r2 = calcRamp(rampLength2, numSteps2, h2);
    result.ramps.push(r1, r2);
    result.landings.push({ depth: landingDepth, turnAngle: 90 });
    buildLLandingGeometry(result, r1, r2, landingDepth, stairWidth, gapBetween);
  }

  else if (type === 'l-winder') {
    const totalSteps = numSteps1 + numWinders + numSteps2;
    const h1 = totalHeight * (numSteps1 / totalSteps);
    const hW = totalHeight * (numWinders / totalSteps);
    const h2 = totalHeight - h1 - hW;
    const r1 = calcRamp(rampLength1, numSteps1, h1);
    const r2 = calcRamp(rampLength2, numSteps2, h2);
    result.ramps.push(r1, r2);
    result.winders.push({
      numWinders, turnAngle: 90, innerRadius,
      riserHeight: round2(hW / numWinders), totalRise: hW,
    });
    buildLWinderGeometry(result, r1, r2, numWinders, innerRadius, stairWidth);
  }

  else if (type === 'u-landing') {
    const totalSteps = numSteps1 + numSteps2;
    const h1 = totalHeight * (numSteps1 / totalSteps);
    const h2 = totalHeight - h1;
    const r1 = calcRamp(rampLength1, numSteps1, h1);
    const r2 = calcRamp(rampLength2, numSteps2, h2);
    result.ramps.push(r1, r2);
    result.landings.push({ depth: landingDepth, turnAngle: 180 });
    buildULandingGeometry(result, r1, r2, landingDepth, stairWidth, gapBetween);
  }

  else if (type === 'u-winder') {
    const totalSteps = numSteps1 + numWinders + numSteps2;
    const h1 = totalHeight * (numSteps1 / totalSteps);
    const hW = totalHeight * (numWinders / totalSteps);
    const h2 = totalHeight - h1 - hW;
    const r1 = calcRamp(rampLength1, numSteps1, h1);
    const r2 = calcRamp(rampLength2, numSteps2, h2);
    result.ramps.push(r1, r2);
    result.winders.push({
      numWinders, turnAngle: 180, innerRadius,
      riserHeight: round2(hW / numWinders), totalRise: hW,
    });
    buildUWinderGeometry(result, r1, r2, numWinders, innerRadius, stairWidth, gapBetween);
  }

  else if (type === 'three-flight') {
    const totalSteps = numSteps1 + numSteps2 + numSteps3;
    const h1 = totalHeight * (numSteps1 / totalSteps);
    const h2 = totalHeight * (numSteps2 / totalSteps);
    const h3 = totalHeight - h1 - h2;
    const r1 = calcRamp(rampLength1, numSteps1, h1);
    const r2 = calcRamp(rampLength2, numSteps2, h2);
    const r3 = calcRamp(rampLength3, numSteps3, h3);
    result.ramps.push(r1, r2, r3);
    result.landings.push({ depth: landingDepth, turnAngle: 90 });
    result.landings.push({ depth: landingDepth2, turnAngle: 90 });
    buildThreeFlightGeometry(result, r1, r2, r3, landingDepth, landingDepth2, stairWidth, gapBetween);
  }

  // Blondel check
  if (useBlondel) {
    for (let i = 0; i < result.ramps.length; i++) {
      const r = result.ramps[i];
      const blondel = 2 * r.riserHeight + r.treadDepth;
      r.blondelValue = round2(blondel);
      r.blondelOk = blondel >= 60 && blondel <= 66;
      if (!r.blondelOk) {
        result.warnings.push(`Rampa ${i + 1}: Blondel = ${r.blondelValue} (ideale 62÷64)`);
      }
    }
  }

  // Warning pendenza
  for (let i = 0; i < result.ramps.length; i++) {
    const r = result.ramps[i];
    if (r.slopeAngle > 45) {
      result.warnings.push(`Rampa ${i + 1}: pendenza ${r.slopeAngle}° (> 45° - molto ripida)`);
    } else if (r.slopeAngle > 40) {
      result.warnings.push(`Rampa ${i + 1}: pendenza ${r.slopeAngle}° (> 40° - ripida)`);
    }
    if (r.riserHeight > 22) {
      result.warnings.push(`Rampa ${i + 1}: alzata ${r.riserHeight} cm (> 22 cm - alta)`);
    }
    if (r.treadDepth < 22) {
      result.warnings.push(`Rampa ${i + 1}: pedata ${r.treadDepth} cm (< 22 cm - stretta)`);
    }
  }

  return result;
}

// ─── GEOMETRY BUILDERS ──────────────────────────────────────
// Ogni builder popola result.planGeometry e result.sideProfile

function buildStraightGeometry(result, ramp) {
  const W = result.stairWidth;
  // Pianta: rampa va da (0,0) verso +Y
  const steps = [];
  for (let i = 0; i < ramp.numTreads; i++) {
    const y = i * ramp.treadDepth;
    steps.push({
      x1: 0, y1: y, x2: W, y2: y,
      x3: 0, y3: y + ramp.treadDepth, x4: W, y4: y + ramp.treadDepth,
      label: i + 1,
    });
  }
  result.planGeometry = {
    ramps: [{
      outline: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: ramp.totalRun }, { x: 0, y: ramp.totalRun }],
      steps,
      direction: { startX: W / 2, startY: 0, endX: W / 2, endY: ramp.totalRun },
    }],
    landings: [],
    winders: [],
  };

  // Vista laterale
  result.sideProfile = buildSideProfile([ramp], [], result);
}

function buildLLandingGeometry(result, r1, r2, landingDepth, W, gap) {
  // Rampa 1: sale verso +Y
  const steps1 = [];
  for (let i = 0; i < r1.numTreads; i++) {
    const y = i * r1.treadDepth;
    steps1.push({
      x1: 0, y1: y, x2: W, y2: y,
      x3: 0, y3: y + r1.treadDepth, x4: W, y4: y + r1.treadDepth,
      label: i + 1,
    });
  }

  // Pianerottolo: rettangolo alla fine della rampa1, poi gira 90° a destra
  const landingY = r1.totalRun;
  const landing = {
    corners: [
      { x: 0, y: landingY },
      { x: W, y: landingY },
      { x: W, y: landingY + landingDepth },
      { x: 0, y: landingY + landingDepth },
    ],
  };

  // Rampa 2: sale verso +X, partendo dal bordo destro del pianerottolo
  const r2StartX = W;
  const r2StartY = landingY;
  const steps2 = [];
  for (let i = 0; i < r2.numTreads; i++) {
    const x = r2StartX + i * r2.treadDepth;
    steps2.push({
      x1: x, y1: r2StartY,
      x2: x, y2: r2StartY + landingDepth,
      x3: x + r2.treadDepth, y3: r2StartY,
      x4: x + r2.treadDepth, y4: r2StartY + landingDepth,
      label: r1.numTreads + i + 1,
    });
  }

  result.planGeometry = {
    ramps: [
      {
        outline: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: r1.totalRun }, { x: 0, y: r1.totalRun }],
        steps: steps1,
        direction: { startX: W / 2, startY: 0, endX: W / 2, endY: r1.totalRun },
      },
      {
        outline: [
          { x: r2StartX, y: r2StartY },
          { x: r2StartX + r2.totalRun, y: r2StartY },
          { x: r2StartX + r2.totalRun, y: r2StartY + landingDepth },
          { x: r2StartX, y: r2StartY + landingDepth },
        ],
        steps: steps2,
        direction: { startX: r2StartX, startY: r2StartY + landingDepth / 2, endX: r2StartX + r2.totalRun, endY: r2StartY + landingDepth / 2 },
      },
    ],
    landings: [landing],
    winders: [],
  };

  result.sideProfile = buildSideProfile([r1, r2], [{ depth: landingDepth }], result);
}

function buildULandingGeometry(result, r1, r2, landingDepth, W, gap) {
  const G = gap || 10;
  // Rampa 1: sale verso +Y
  const steps1 = [];
  for (let i = 0; i < r1.numTreads; i++) {
    const y = i * r1.treadDepth;
    steps1.push({
      x1: 0, y1: y, x2: W, y2: y,
      x3: 0, y3: y + r1.treadDepth, x4: W, y4: y + r1.treadDepth,
      label: i + 1,
    });
  }

  // Pianerottolo a U: largo 2W+G, profondo landingDepth
  const landingY = r1.totalRun;
  const totalW = 2 * W + G;
  const landing = {
    corners: [
      { x: 0, y: landingY },
      { x: totalW, y: landingY },
      { x: totalW, y: landingY + landingDepth },
      { x: 0, y: landingY + landingDepth },
    ],
  };

  // Rampa 2: scende verso -Y (torna indietro), offset a destra
  const r2StartX = W + G;
  const r2StartY = landingY;
  const steps2 = [];
  for (let i = 0; i < r2.numTreads; i++) {
    const y = r2StartY - (i + 1) * r2.treadDepth;
    steps2.push({
      x1: r2StartX, y1: y + r2.treadDepth,
      x2: r2StartX + W, y2: y + r2.treadDepth,
      x3: r2StartX, y3: y,
      x4: r2StartX + W, y4: y,
      label: r1.numTreads + i + 1,
    });
  }

  result.planGeometry = {
    ramps: [
      {
        outline: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: r1.totalRun }, { x: 0, y: r1.totalRun }],
        steps: steps1,
        direction: { startX: W / 2, startY: 0, endX: W / 2, endY: r1.totalRun },
      },
      {
        outline: [
          { x: r2StartX, y: r2StartY - r2.totalRun },
          { x: r2StartX + W, y: r2StartY - r2.totalRun },
          { x: r2StartX + W, y: r2StartY },
          { x: r2StartX, y: r2StartY },
        ],
        steps: steps2,
        direction: { startX: r2StartX + W / 2, startY: r2StartY, endX: r2StartX + W / 2, endY: r2StartY - r2.totalRun },
      },
    ],
    landings: [landing],
    winders: [],
  };

  result.sideProfile = buildSideProfile([r1, r2], [{ depth: landingDepth }], result);
}

function buildLWinderGeometry(result, r1, r2, numW, innerR, W) {
  const steps1 = [];
  for (let i = 0; i < r1.numTreads; i++) {
    const y = i * r1.treadDepth;
    steps1.push({
      x1: 0, y1: y, x2: W, y2: y,
      x3: 0, y3: y + r1.treadDepth, x4: W, y4: y + r1.treadDepth,
      label: i + 1,
    });
  }

  // Winder steps: pivot al punto (0, r1.totalRun), gira 90° in senso orario
  const cx = 0;
  const cy = r1.totalRun;
  const outerR = innerR + W;
  const winderSteps = [];
  const stepAngle = 90 / numW;
  for (let i = 0; i < numW; i++) {
    const a1 = (90 - i * stepAngle) * Math.PI / 180;
    const a2 = (90 - (i + 1) * stepAngle) * Math.PI / 180;
    winderSteps.push({
      innerStart: { x: cx + innerR * Math.cos(a1), y: cy + innerR * Math.sin(a1) },
      innerEnd: { x: cx + innerR * Math.cos(a2), y: cy + innerR * Math.sin(a2) },
      outerStart: { x: cx + outerR * Math.cos(a1), y: cy + outerR * Math.sin(a1) },
      outerEnd: { x: cx + outerR * Math.cos(a2), y: cy + outerR * Math.sin(a2) },
      label: r1.numTreads + i + 1,
    });
  }

  // Rampa 2: sale verso +X dal punto di uscita dei winder
  const r2StartX = outerR;
  const r2StartY = cy;
  const steps2 = [];
  for (let i = 0; i < r2.numTreads; i++) {
    const x = r2StartX + i * r2.treadDepth;
    steps2.push({
      x1: x, y1: r2StartY - W, x2: x, y2: r2StartY,
      x3: x + r2.treadDepth, y3: r2StartY - W, x4: x + r2.treadDepth, y4: r2StartY,
      label: r1.numTreads + numW + i + 1,
    });
  }

  result.planGeometry = {
    ramps: [
      {
        outline: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: r1.totalRun }, { x: 0, y: r1.totalRun }],
        steps: steps1,
        direction: { startX: W / 2, startY: 0, endX: W / 2, endY: r1.totalRun },
      },
      {
        outline: [
          { x: r2StartX, y: r2StartY - W },
          { x: r2StartX + r2.totalRun, y: r2StartY - W },
          { x: r2StartX + r2.totalRun, y: r2StartY },
          { x: r2StartX, y: r2StartY },
        ],
        steps: steps2,
        direction: { startX: r2StartX, startY: r2StartY - W / 2, endX: r2StartX + r2.totalRun, endY: r2StartY - W / 2 },
      },
    ],
    landings: [],
    winders: [{ steps: winderSteps }],
  };

  const winderRunEstimate = numW * 30;
  result.sideProfile = buildSideProfile([r1, r2], [{ depth: winderRunEstimate, isWinder: true, numWinders: numW, riserH: result.winders[0].riserHeight }], result);
}

function buildUWinderGeometry(result, r1, r2, numW, innerR, W, gap) {
  const G = gap || 10;
  const steps1 = [];
  for (let i = 0; i < r1.numTreads; i++) {
    const y = i * r1.treadDepth;
    steps1.push({
      x1: 0, y1: y, x2: W, y2: y,
      x3: 0, y3: y + r1.treadDepth, x4: W, y4: y + r1.treadDepth,
      label: i + 1,
    });
  }

  // Winder steps: pivot, 180° turn
  const cx = W + G / 2;
  const cy = r1.totalRun;
  const outerR = (W * 2 + G) / 2;
  const actualInnerR = G / 2;
  const winderSteps = [];
  const stepAngle = 180 / numW;
  for (let i = 0; i < numW; i++) {
    const a1 = (180 - i * stepAngle) * Math.PI / 180;
    const a2 = (180 - (i + 1) * stepAngle) * Math.PI / 180;
    winderSteps.push({
      innerStart: { x: cx + actualInnerR * Math.cos(a1), y: cy + actualInnerR * Math.sin(a1) },
      innerEnd: { x: cx + actualInnerR * Math.cos(a2), y: cy + actualInnerR * Math.sin(a2) },
      outerStart: { x: cx + outerR * Math.cos(a1), y: cy + outerR * Math.sin(a1) },
      outerEnd: { x: cx + outerR * Math.cos(a2), y: cy + outerR * Math.sin(a2) },
      label: r1.numTreads + i + 1,
    });
  }

  // Rampa 2: torna indietro verso -Y
  const r2StartX = W + G;
  const r2StartY = cy;
  const steps2 = [];
  for (let i = 0; i < r2.numTreads; i++) {
    const y = r2StartY - (i + 1) * r2.treadDepth;
    steps2.push({
      x1: r2StartX, y1: y + r2.treadDepth,
      x2: r2StartX + W, y2: y + r2.treadDepth,
      x3: r2StartX, y3: y,
      x4: r2StartX + W, y4: y,
      label: r1.numTreads + numW + i + 1,
    });
  }

  result.planGeometry = {
    ramps: [
      {
        outline: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: r1.totalRun }, { x: 0, y: r1.totalRun }],
        steps: steps1,
        direction: { startX: W / 2, startY: 0, endX: W / 2, endY: r1.totalRun },
      },
      {
        outline: [
          { x: r2StartX, y: r2StartY - r2.totalRun },
          { x: r2StartX + W, y: r2StartY - r2.totalRun },
          { x: r2StartX + W, y: r2StartY },
          { x: r2StartX, y: r2StartY },
        ],
        steps: steps2,
        direction: { startX: r2StartX + W / 2, startY: r2StartY, endX: r2StartX + W / 2, endY: r2StartY - r2.totalRun },
      },
    ],
    landings: [],
    winders: [{ steps: winderSteps }],
  };

  const winderRunEstimate = numW * 30;
  result.sideProfile = buildSideProfile([r1, r2], [{ depth: winderRunEstimate, isWinder: true, numWinders: numW, riserH: result.winders[0].riserHeight }], result);
}

function buildThreeFlightGeometry(result, r1, r2, r3, landingD1, landingD2, W, gap) {
  const G = gap || 10;

  // Rampa 1: sale verso +Y
  const steps1 = [];
  for (let i = 0; i < r1.numTreads; i++) {
    const y = i * r1.treadDepth;
    steps1.push({
      x1: 0, y1: y, x2: W, y2: y,
      x3: 0, y3: y + r1.treadDepth, x4: W, y4: y + r1.treadDepth,
      label: i + 1,
    });
  }

  // Pianerottolo 1
  const l1Y = r1.totalRun;
  const landing1 = {
    corners: [
      { x: 0, y: l1Y },
      { x: W, y: l1Y },
      { x: W, y: l1Y + landingD1 },
      { x: 0, y: l1Y + landingD1 },
    ],
  };

  // Rampa 2: sale verso +X
  const r2sx = W;
  const r2sy = l1Y;
  const steps2 = [];
  for (let i = 0; i < r2.numTreads; i++) {
    const x = r2sx + i * r2.treadDepth;
    steps2.push({
      x1: x, y1: r2sy, x2: x, y2: r2sy + landingD1,
      x3: x + r2.treadDepth, y3: r2sy, x4: x + r2.treadDepth, y4: r2sy + landingD1,
      label: r1.numTreads + i + 1,
    });
  }

  // Pianerottolo 2
  const l2X = r2sx + r2.totalRun;
  const landing2 = {
    corners: [
      { x: l2X, y: r2sy },
      { x: l2X + landingD2, y: r2sy },
      { x: l2X + landingD2, y: r2sy + landingD1 },
      { x: l2X, y: r2sy + landingD1 },
    ],
  };

  // Rampa 3: sale verso -Y (o +Y a seconda della configurazione)
  const r3sx = l2X;
  const r3sy = r2sy + landingD1;
  const steps3 = [];
  for (let i = 0; i < r3.numTreads; i++) {
    const y = r3sy + i * r3.treadDepth;
    steps3.push({
      x1: r3sx, y1: y, x2: r3sx + landingD2, y2: y,
      x3: r3sx, y3: y + r3.treadDepth, x4: r3sx + landingD2, y4: y + r3.treadDepth,
      label: r1.numTreads + r2.numTreads + i + 1,
    });
  }

  result.planGeometry = {
    ramps: [
      {
        outline: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: r1.totalRun }, { x: 0, y: r1.totalRun }],
        steps: steps1,
        direction: { startX: W / 2, startY: 0, endX: W / 2, endY: r1.totalRun },
      },
      {
        outline: [
          { x: r2sx, y: r2sy }, { x: r2sx + r2.totalRun, y: r2sy },
          { x: r2sx + r2.totalRun, y: r2sy + landingD1 }, { x: r2sx, y: r2sy + landingD1 },
        ],
        steps: steps2,
        direction: { startX: r2sx, startY: r2sy + landingD1 / 2, endX: r2sx + r2.totalRun, endY: r2sy + landingD1 / 2 },
      },
      {
        outline: [
          { x: r3sx, y: r3sy }, { x: r3sx + landingD2, y: r3sy },
          { x: r3sx + landingD2, y: r3sy + r3.totalRun }, { x: r3sx, y: r3sy + r3.totalRun },
        ],
        steps: steps3,
        direction: { startX: r3sx + landingD2 / 2, startY: r3sy, endX: r3sx + landingD2 / 2, endY: r3sy + r3.totalRun },
      },
    ],
    landings: [landing1, landing2],
    winders: [],
  };

  result.sideProfile = buildSideProfile([r1, r2, r3], [{ depth: landingD1 }, { depth: landingD2 }], result);
}

// ─── SIDE PROFILE ────────────────────────────────────────────

function buildSideProfile(ramps, connections, result) {
  const segments = [];
  let x = 0;
  let z = 0;

  for (let r = 0; r < ramps.length; r++) {
    const ramp = ramps[r];
    // Profilo a dente di sega
    const rampSegs = [];
    for (let s = 0; s < ramp.numSteps; s++) {
      // Alzata
      rampSegs.push({ type: 'riser', x1: x + s * ramp.treadDepth, z1: z + s * ramp.riserHeight, x2: x + s * ramp.treadDepth, z2: z + (s + 1) * ramp.riserHeight });
      // Pedata (tranne l'ultimo gradino)
      if (s < ramp.numTreads) {
        rampSegs.push({ type: 'tread', x1: x + s * ramp.treadDepth, z1: z + (s + 1) * ramp.riserHeight, x2: x + (s + 1) * ramp.treadDepth, z2: z + (s + 1) * ramp.riserHeight });
      }
    }
    segments.push(...rampSegs);

    x += ramp.totalRun;
    z += ramp.totalRise;

    // Connessione
    if (r < connections.length) {
      const conn = connections[r];
      if (conn.isWinder) {
        for (let w = 0; w < conn.numWinders; w++) {
          const wd = conn.depth / conn.numWinders;
          segments.push({ type: 'winder-riser', x1: x + w * wd, z1: z + w * conn.riserH, x2: x + w * wd, z2: z + (w + 1) * conn.riserH });
          segments.push({ type: 'winder-tread', x1: x + w * wd, z1: z + (w + 1) * conn.riserH, x2: x + (w + 1) * wd, z2: z + (w + 1) * conn.riserH });
        }
        z += conn.numWinders * conn.riserH;
      } else {
        segments.push({ type: 'landing', x1: x, z1: z, x2: x + conn.depth, z2: z });
      }
      x += conn.depth;
    }
  }

  return { segments, totalRun: x, totalRise: z };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
