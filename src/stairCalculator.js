/**
 * Modulo calcolo scale.
 * Calcola pedate, alzate, verifica Blondel opzionale.
 */

/**
 * Calcola i parametri di una singola rampa.
 * @param {object} params
 * @param {number} params.height - Altezza rampa in cm
 * @param {number} params.riserHeight - Alzata desiderata in cm
 * @param {number} params.treadDepth - Pedata desiderata in cm (opzionale, calcolata se useBlondel)
 * @param {number} params.width - Larghezza scala in cm
 * @param {boolean} params.useBlondel - Se true, verifica/suggerisce con formula di Blondel
 * @returns {object} Risultato calcolo
 */
export function calculateRamp(params) {
  const { height, riserHeight, treadDepth, width, useBlondel = false } = params;

  // Numero di alzate (arrotondato)
  const numRisers = Math.round(height / riserHeight);
  // Alzata effettiva
  const actualRiser = height / numRisers;
  // Numero di pedate = alzate - 1 (l'ultima alzata arriva al piano)
  const numTreads = numRisers - 1;

  let actualTread = treadDepth;
  let blondelValue = null;
  let blondelOk = null;

  if (useBlondel && !treadDepth) {
    // Calcola pedata ottimale con Blondel: 2a + p = 63 (media)
    actualTread = 63 - 2 * actualRiser;
    if (actualTread < 20) actualTread = 20;
    if (actualTread > 40) actualTread = 40;
  }

  if (useBlondel) {
    blondelValue = 2 * actualRiser + actualTread;
    blondelOk = blondelValue >= 62 && blondelValue <= 64;
  }

  // Lunghezza totale della rampa (sviluppo orizzontale)
  const totalRun = numTreads * actualTread;

  // Pendenza
  const slopeAngle = Math.atan2(height, totalRun) * (180 / Math.PI);

  return {
    numRisers,
    numTreads,
    actualRiser: round2(actualRiser),
    actualTread: round2(actualTread),
    totalRun: round2(totalRun),
    totalRise: height,
    width,
    slopeAngle: round2(slopeAngle),
    blondelValue: blondelValue ? round2(blondelValue) : null,
    blondelOk,
  };
}

/**
 * Calcola la geometria completa della scala (tutte le rampe + connessioni).
 * Restituisce le coordinate di ogni gradino per il rendering.
 * @param {object} config - Configurazione completa
 * @returns {object} Geometria completa
 */
export function calculateFullStair(config) {
  const { stairType, stairWidth, slabThickness, ramps, connections, useBlondel } = config;

  const rampResults = [];
  const rampGeometries = [];
  let currentX = 0;
  let currentY = 0;
  let currentZ = 0;
  let currentAngle = 0; // direzione in gradi (0 = verso destra +X)

  for (let i = 0; i < ramps.length; i++) {
    const ramp = ramps[i];
    const result = calculateRamp({
      height: ramp.height,
      riserHeight: ramp.riserHeight,
      treadDepth: ramp.treadDepth,
      width: stairWidth,
      useBlondel,
    });

    rampResults.push(result);

    // Genera geometria gradini
    const steps = [];
    const rad = (currentAngle * Math.PI) / 180;
    const dirX = Math.cos(rad);
    const dirY = Math.sin(rad);

    // Vettore perpendicolare per la larghezza
    const perpX = -dirY;
    const perpY = dirX;

    for (let s = 0; s < result.numTreads; s++) {
      const x = currentX + dirX * s * result.actualTread;
      const y = currentY + dirY * s * result.actualTread;
      const z = currentZ + (s + 1) * result.actualRiser;

      steps.push({
        index: s,
        // Spigolo anteriore sinistro della pedata
        x1: x,
        y1: y,
        // Spigolo anteriore destro
        x2: x + perpX * stairWidth,
        y2: y + perpY * stairWidth,
        // Spigolo posteriore sinistro
        x3: x + dirX * result.actualTread,
        y3: y + dirY * result.actualTread,
        // Spigolo posteriore destro
        x4: x + dirX * result.actualTread + perpX * stairWidth,
        y4: y + dirY * result.actualTread + perpY * stairWidth,
        z,
        riser: result.actualRiser,
        tread: result.actualTread,
      });
    }

    const geometry = {
      rampIndex: i,
      startX: currentX,
      startY: currentY,
      startZ: currentZ,
      angle: currentAngle,
      steps,
      width: stairWidth,
      totalRun: result.totalRun,
      totalRise: result.totalRise,
      dirX,
      dirY,
      perpX,
      perpY,
    };
    rampGeometries.push(geometry);

    // Avanza la posizione alla fine della rampa
    currentX += dirX * result.totalRun;
    currentY += dirY * result.totalRun;
    currentZ += result.totalRise;

    // Se c'è una connessione dopo questa rampa, elaborala
    if (i < connections.length) {
      const conn = connections[i];
      const connGeo = calculateConnection(conn, {
        x: currentX,
        y: currentY,
        z: currentZ,
        angle: currentAngle,
        width: stairWidth,
        riserHeight: result.actualRiser,
      });

      // Aggiorna posizione/angolo dopo la connessione
      currentX = connGeo.endX;
      currentY = connGeo.endY;
      currentZ = connGeo.endZ;
      currentAngle = connGeo.endAngle;

      geometry.connection = connGeo;
    }
  }

  return {
    stairType,
    stairWidth,
    slabThickness,
    rampResults,
    rampGeometries,
    totalHeight: currentZ,
  };
}

/**
 * Calcola la geometria di una connessione (pianerottolo o gradini a spicchio).
 */
function calculateConnection(conn, context) {
  const { x, y, z, angle, width, riserHeight } = context;
  const rad = (angle * Math.PI) / 180;
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);
  const perpX = -dirY;
  const perpY = dirX;

  if (conn.type === 'landing') {
    // Pianerottolo rettangolare
    const depth = conn.depth || 100; // profondità pianerottolo in cm
    const turnAngle = conn.turnAngle || 0; // 0, 90, 180

    const landingEndX = x + dirX * depth;
    const landingEndY = y + dirY * depth;

    const geometry = {
      type: 'landing',
      x,
      y,
      z,
      width,
      depth,
      angle,
      turnAngle,
      // 4 angoli del pianerottolo
      corners: [
        { x: x, y: y },
        { x: x + perpX * width, y: y + perpY * width },
        { x: landingEndX + perpX * width, y: landingEndY + perpY * width },
        { x: landingEndX, y: landingEndY },
      ],
      endX: turnAngle === 0 ? landingEndX : x + perpX * depth * (turnAngle === 90 ? 1 : 0) + dirX * depth * (turnAngle === 180 ? 0 : 1),
      endY: turnAngle === 0 ? landingEndY : y + perpY * depth * (turnAngle === 90 ? 1 : 0) + dirY * depth * (turnAngle === 180 ? 0 : 1),
      endZ: z,
      endAngle: angle + turnAngle,
    };

    // Ricalcola end position per rotazioni
    if (turnAngle === 180) {
      // Scala a U: il pianerottolo prosegue poi torna indietro
      geometry.endX = x + perpX * (width + conn.gap);
      geometry.endY = y + perpY * (width + conn.gap);
      geometry.endZ = z;
      geometry.endAngle = angle + 180;
      geometry.corners = [
        { x: x, y: y },
        { x: x + perpX * width, y: y + perpY * width },
        { x: x + dirX * depth + perpX * width, y: y + dirY * depth + perpY * width },
        { x: x + dirX * depth + perpX * (width * 2 + (conn.gap || 0)), y: y + dirY * depth + perpY * (width * 2 + (conn.gap || 0)) },
        { x: x + perpX * (width * 2 + (conn.gap || 0)), y: y + perpY * (width * 2 + (conn.gap || 0)) },
        // Semplificazione: rettangolo pieno
      ];
    } else if (turnAngle === 90) {
      geometry.endX = x + perpX * depth;
      geometry.endY = y + perpY * depth;
      geometry.endZ = z;
      geometry.endAngle = angle + 90;
    }

    return geometry;
  }

  if (conn.type === 'winder') {
    // Gradini a spicchio
    const numWinders = conn.numWinders || 3;
    const turnAngle = conn.turnAngle || 90;
    const { winderSteps } = calculateWinderSteps({
      numSteps: numWinders,
      turnAngle,
      innerRadius: conn.innerRadius || 10,
      outerRadius: (conn.innerRadius || 10) + width,
      centerX: x + perpX * (conn.innerRadius || 10),
      centerY: y + perpY * (conn.innerRadius || 10),
      startAngle: angle,
      z,
      riserHeight,
    });

    const endAngleRad = ((angle + turnAngle) * Math.PI) / 180;

    return {
      type: 'winder',
      x,
      y,
      z,
      turnAngle,
      numWinders,
      winderSteps,
      endX: x + perpX * width + Math.cos(endAngleRad) * 0,
      endY: y + perpY * width + Math.sin(endAngleRad) * 0,
      endZ: z + numWinders * riserHeight,
      endAngle: angle + turnAngle,
    };
  }

  return { endX: x, endY: y, endZ: z, endAngle: angle };
}

/**
 * Calcola i gradini a spicchio (winder steps).
 */
function calculateWinderSteps(params) {
  const { numSteps, turnAngle, innerRadius, outerRadius, centerX, centerY, startAngle, z, riserHeight } = params;
  const stepAngle = turnAngle / numSteps;
  const winderSteps = [];

  for (let i = 0; i < numSteps; i++) {
    const a1 = startAngle + i * stepAngle;
    const a2 = startAngle + (i + 1) * stepAngle;
    const r1 = (a1 * Math.PI) / 180;
    const r2 = (a2 * Math.PI) / 180;

    winderSteps.push({
      index: i,
      // Inner edge start/end
      innerStart: { x: centerX + innerRadius * Math.cos(r1), y: centerY + innerRadius * Math.sin(r1) },
      innerEnd: { x: centerX + innerRadius * Math.cos(r2), y: centerY + innerRadius * Math.sin(r2) },
      // Outer edge start/end
      outerStart: { x: centerX + outerRadius * Math.cos(r1), y: centerY + outerRadius * Math.sin(r1) },
      outerEnd: { x: centerX + outerRadius * Math.cos(r2), y: centerY + outerRadius * Math.sin(r2) },
      z: z + (i + 1) * riserHeight,
      angle1: a1,
      angle2: a2,
    });
  }

  return { winderSteps, totalRise: numSteps * riserHeight };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
