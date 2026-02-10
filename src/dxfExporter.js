/**
 * Modulo export DXF.
 * Genera file DXF compatibile con AutoCAD con pianta, vista laterale, vista frontale e quotature.
 * Usa formato DXF AC1009 (R12) per massima compatibilità.
 */

// Scala: 1 unità DXF = 1 cm

export class DxfExporter {
  constructor() {
    this.entities = [];
    this.layers = [];
    this._defineDefaultLayers();
  }

  _defineDefaultLayers() {
    this.layers = [
      { name: '0', color: 7 },
      { name: 'GRADINI', color: 5 },          // Blu
      { name: 'CONTORNO', color: 3 },          // Verde
      { name: 'PIANEROTTOLO', color: 2 },      // Giallo
      { name: 'SPICCHIO', color: 1 },          // Rosso
      { name: 'QUOTATURE', color: 8 },         // Grigio
      { name: 'ALZATE', color: 1 },            // Rosso
      { name: 'PEDATE', color: 5 },            // Blu
      { name: 'SOLAIO', color: 8 },            // Grigio
      { name: 'SEZIONE', color: 4 },           // Ciano
      { name: 'FRECCIA', color: 8 },           // Grigio
      { name: 'TESTI', color: 7 },             // Bianco
    ];
  }

  /**
   * Genera il DXF completo dalla configurazione calcolata.
   */
  generate(stairData, options) {
    this.entities = [];
    const { exportPlan, exportSide, exportFront, exportDimensions } = options;

    let offsetX = 0;

    if (exportPlan) {
      this._generatePlan(stairData, 0, 0);
      offsetX = this._getMaxX(stairData) + 200;
    }

    if (exportSide) {
      this._generateSideView(stairData, offsetX, 0);
      offsetX += this._getSideViewWidth(stairData) + 200;
    }

    if (exportFront) {
      this._generateFrontView(stairData, offsetX, 0);
    }

    return this._buildDxfString();
  }

  // ─── PIANTA ─────────────────────────────────────────────────

  _generatePlan(data, ox, oy) {
    for (const geo of data.rampGeometries) {
      const { steps, width, dirX, dirY, perpX, perpY, startX, startY, totalRun } = geo;

      // Contorno rampa
      const endX = startX + dirX * totalRun;
      const endY = startY + dirY * totalRun;
      this._addPolyline('CONTORNO', [
        { x: ox + startX, y: oy + startY },
        { x: ox + endX, y: oy + endY },
        { x: ox + endX + perpX * width, y: oy + endY + perpY * width },
        { x: ox + startX + perpX * width, y: oy + startY + perpY * width },
      ], true);

      // Linee gradini
      for (const step of steps) {
        this._addLine('GRADINI',
          ox + step.x3, oy + step.y3,
          ox + step.x4, oy + step.y4
        );
      }

      // Numeri gradini
      for (const step of steps) {
        const cx = (step.x1 + step.x4) / 2;
        const cy = (step.y1 + step.y4) / 2;
        this._addText('TESTI', ox + cx, oy + cy, String(step.index + 1), 3);
      }

      // Freccia direzione salita
      if (steps.length > 1) {
        const midPx = perpX * width * 0.5;
        const midPy = perpY * width * 0.5;
        const first = steps[0];
        const last = steps[steps.length - 1];
        this._addLine('FRECCIA',
          ox + first.x1 + midPx, oy + first.y1 + midPy,
          ox + last.x3 + midPx, oy + last.y3 + midPy
        );
      }

      // Connessione
      if (geo.connection) {
        this._drawConnectionDxf(geo.connection, ox, oy);
      }

      // Quotature pianta
      if (steps.length > 0) {
        // Quota lunghezza rampa
        const qy = oy + startY - 15;
        this._addAlignedDimension('QUOTATURE',
          ox + startX, oy + startY, ox + endX, oy + endY,
          qy, `${geo.totalRun}`
        );
        // Quota larghezza
        this._addAlignedDimension('QUOTATURE',
          ox + startX, oy + startY, ox + startX + perpX * width, oy + startY + perpY * width,
          ox + startX - 15, `${width}`
        );
      }
    }
  }

  _drawConnectionDxf(conn, ox, oy) {
    if (conn.type === 'landing' && conn.corners) {
      const pts = conn.corners.map(c => ({ x: ox + c.x, y: oy + c.y }));
      this._addPolyline('PIANEROTTOLO', pts, true);
      this._addText('TESTI', ox + conn.x + 15, oy + conn.y + 15, 'PIANEROTTOLO', 3);
    }

    if (conn.type === 'winder' && conn.winderSteps) {
      for (const ws of conn.winderSteps) {
        this._addPolyline('SPICCHIO', [
          { x: ox + ws.innerStart.x, y: oy + ws.innerStart.y },
          { x: ox + ws.outerStart.x, y: oy + ws.outerStart.y },
          { x: ox + ws.outerEnd.x, y: oy + ws.outerEnd.y },
          { x: ox + ws.innerEnd.x, y: oy + ws.innerEnd.y },
        ], true);
      }
    }
  }

  // ─── VISTA LATERALE ─────────────────────────────────────────

  _generateSideView(data, ox, oy) {
    let runOffset = 0;

    // Label
    this._addText('TESTI', ox, oy + data.totalHeight + 20, 'VISTA LATERALE', 5);

    for (let r = 0; r < data.rampGeometries.length; r++) {
      const ramp = data.rampResults[r];
      const geo = data.rampGeometries[r];
      const startZ = geo.startZ;

      // Profilo a scalino
      const profilePts = [{ x: ox + runOffset, y: oy + startZ }];

      for (let s = 0; s < ramp.numTreads; s++) {
        const x = runOffset + s * ramp.actualTread;
        const z = startZ + s * ramp.actualRiser;
        // Alzata
        profilePts.push({ x: ox + x, y: oy + z + ramp.actualRiser });
        // Pedata
        profilePts.push({ x: ox + x + ramp.actualTread, y: oy + z + ramp.actualRiser });
      }

      // Ultima alzata
      const lastX = runOffset + ramp.numTreads * ramp.actualTread;
      const lastZ = startZ + ramp.numTreads * ramp.actualRiser;
      profilePts.push({ x: ox + lastX, y: oy + lastZ + ramp.actualRiser });

      this._addPolyline('CONTORNO', profilePts, false);

      // Linee di quotatura per pedate e alzate
      // Quota singola alzata (prima)
      if (ramp.numTreads > 0) {
        this._addLinearDimension('QUOTATURE',
          ox + runOffset, oy + startZ,
          ox + runOffset, oy + startZ + ramp.actualRiser,
          ox + runOffset - 10,
          `a=${ramp.actualRiser}`, true
        );
        // Quota singola pedata (prima)
        this._addLinearDimension('QUOTATURE',
          ox + runOffset, oy + startZ + ramp.actualRiser,
          ox + runOffset + ramp.actualTread, oy + startZ + ramp.actualRiser,
          oy + startZ + ramp.actualRiser - 10,
          `p=${ramp.actualTread}`, false
        );
      }

      runOffset += ramp.totalRun;

      // Connessione nella vista laterale
      if (geo.connection && geo.connection.type === 'landing') {
        const depth = geo.connection.depth || 100;
        const z = geo.startZ + ramp.totalRise;
        this._addLine('PIANEROTTOLO', ox + runOffset, oy + z, ox + runOffset + depth, oy + z);
        // Bordo inferiore pianerottolo (spessore)
        this._addLine('PIANEROTTOLO', ox + runOffset, oy + z - 15, ox + runOffset + depth, oy + z - 15);
        this._addLine('PIANEROTTOLO', ox + runOffset, oy + z, ox + runOffset, oy + z - 15);
        this._addLine('PIANEROTTOLO', ox + runOffset + depth, oy + z, ox + runOffset + depth, oy + z - 15);
        runOffset += depth;
      } else if (geo.connection && geo.connection.type === 'winder') {
        const numW = geo.connection.numWinders || 3;
        const baseZ = geo.startZ + ramp.totalRise;
        const rH = ramp.actualRiser;
        for (let w = 0; w < numW; w++) {
          this._addLine('SPICCHIO', ox + runOffset + w * 30, oy + baseZ + w * rH, ox + runOffset + w * 30, oy + baseZ + (w + 1) * rH);
          this._addLine('SPICCHIO', ox + runOffset + w * 30, oy + baseZ + (w + 1) * rH, ox + runOffset + (w + 1) * 30, oy + baseZ + (w + 1) * rH);
        }
        runOffset += numW * 30;
      }
    }

    // Linea pavimento
    this._addLine('SOLAIO', ox - 20, oy, ox + runOffset + 40, oy);

    // Solaio di arrivo
    const topY = oy + data.totalHeight;
    this._addPolyline('SOLAIO', [
      { x: ox + runOffset - 20, y: topY },
      { x: ox + runOffset + 60, y: topY },
      { x: ox + runOffset + 60, y: topY + data.slabThickness },
      { x: ox + runOffset - 20, y: topY + data.slabThickness },
    ], true);

    // Quota altezza totale
    this._addLinearDimension('QUOTATURE',
      ox + runOffset + 40, oy,
      ox + runOffset + 40, oy + data.totalHeight,
      ox + runOffset + 55,
      `H=${data.totalHeight}`, true
    );

    // Quota sviluppo totale
    this._addLinearDimension('QUOTATURE',
      ox, oy - 15,
      ox + runOffset, oy - 15,
      oy - 25,
      `L=${round2(runOffset)}`, false
    );
  }

  // ─── VISTA FRONTALE ─────────────────────────────────────────

  _generateFrontView(data, ox, oy) {
    const width = data.stairWidth;
    const totalH = data.totalHeight;

    // Label
    this._addText('TESTI', ox, oy + totalH + 20, 'VISTA FRONTALE', 5);

    // Contorno sezione
    this._addPolyline('SEZIONE', [
      { x: ox, y: oy },
      { x: ox + width, y: oy },
      { x: ox + width, y: oy + totalH },
      { x: ox, y: oy + totalH },
    ], true);

    // Linee tratteggiate dei gradini
    const firstRamp = data.rampResults[0];
    let z = 0;
    for (let s = 0; s < firstRamp.numRisers; s++) {
      z += firstRamp.actualRiser;
      if (z >= totalH) break;
      this._addLine('GRADINI', ox, oy + z, ox + width, oy + z);
    }

    // Quota larghezza
    this._addLinearDimension('QUOTATURE',
      ox, oy - 10,
      ox + width, oy - 10,
      oy - 20,
      `L=${width}`, false
    );

    // Quota altezza
    this._addLinearDimension('QUOTATURE',
      ox + width + 10, oy,
      ox + width + 10, oy + totalH,
      ox + width + 25,
      `H=${totalH}`, true
    );
  }

  // ─── DXF PRIMITIVES ────────────────────────────────────────

  _addLine(layer, x1, y1, x2, y2) {
    this.entities.push({ type: 'LINE', layer, x1, y1, x2, y2 });
  }

  _addPolyline(layer, points, closed) {
    this.entities.push({ type: 'LWPOLYLINE', layer, points, closed });
  }

  _addText(layer, x, y, text, height) {
    this.entities.push({ type: 'TEXT', layer, x, y, text, height: height || 3 });
  }

  _addAlignedDimension(layer, x1, y1, x2, y2, dimLinePos, text) {
    // Rappresentiamo la quota come linea + testo per compatibilità R12
    this._addLine(layer, x1, y1, x2, y2);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    this._addText(layer, mx, my + 4, text, 2.5);
  }

  _addLinearDimension(layer, x1, y1, x2, y2, offset, text, vertical) {
    if (vertical) {
      // Linea quotatura verticale
      this._addLine(layer, offset, y1, offset, y2);
      // Linee di richiamo
      this._addLine(layer, x1, y1, offset, y1);
      this._addLine(layer, x1, y2, offset, y2);
      // Frecce (piccole linee)
      this._addLine(layer, offset - 1.5, y1 + 3, offset, y1);
      this._addLine(layer, offset + 1.5, y1 + 3, offset, y1);
      this._addLine(layer, offset - 1.5, y2 - 3, offset, y2);
      this._addLine(layer, offset + 1.5, y2 - 3, offset, y2);
      // Testo
      this._addText(layer, offset + 3, (y1 + y2) / 2, text, 2.5);
    } else {
      // Linea quotatura orizzontale
      this._addLine(layer, x1, offset, x2, offset);
      // Linee di richiamo
      this._addLine(layer, x1, y1, x1, offset);
      this._addLine(layer, x2, y2, x2, offset);
      // Frecce
      this._addLine(layer, x1 + 3, offset - 1.5, x1, offset);
      this._addLine(layer, x1 + 3, offset + 1.5, x1, offset);
      this._addLine(layer, x2 - 3, offset - 1.5, x2, offset);
      this._addLine(layer, x2 - 3, offset + 1.5, x2, offset);
      // Testo
      this._addText(layer, (x1 + x2) / 2, offset + 3, text, 2.5);
    }
  }

  // ─── UTILITY ────────────────────────────────────────────────

  _getMaxX(data) {
    let maxX = 0;
    for (const geo of data.rampGeometries) {
      for (const step of geo.steps) {
        maxX = Math.max(maxX, step.x3, step.x4);
      }
      if (geo.connection && geo.connection.corners) {
        for (const c of geo.connection.corners) {
          maxX = Math.max(maxX, c.x);
        }
      }
    }
    return maxX;
  }

  _getSideViewWidth(data) {
    let total = 0;
    for (let r = 0; r < data.rampResults.length; r++) {
      total += data.rampResults[r].totalRun;
      const geo = data.rampGeometries[r];
      if (geo.connection) {
        if (geo.connection.type === 'landing') total += geo.connection.depth || 100;
        else if (geo.connection.type === 'winder') total += (geo.connection.numWinders || 3) * 30;
      }
    }
    return total + 80;
  }

  // ─── DXF STRING BUILDER ────────────────────────────────────

  _buildDxfString() {
    let dxf = '';

    // HEADER
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1009\n';
    dxf += '9\n$INSBASE\n10\n0.0\n20\n0.0\n30\n0.0\n';
    dxf += '9\n$INSUNITS\n70\n5\n'; // Centimetri
    dxf += '0\nENDSEC\n';

    // TABLES
    dxf += '0\nSECTION\n2\nTABLES\n';

    // Layer table
    dxf += '0\nTABLE\n2\nLAYER\n70\n' + this.layers.length + '\n';
    for (const layer of this.layers) {
      dxf += '0\nLAYER\n2\n' + layer.name + '\n70\n0\n62\n' + layer.color + '\n6\nCONTINUOUS\n';
    }
    dxf += '0\nENDTAB\n';

    // Linetype table
    dxf += '0\nTABLE\n2\nLTYPE\n70\n1\n';
    dxf += '0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n';
    dxf += '0\nENDTAB\n';

    // Style table
    dxf += '0\nTABLE\n2\nSTYLE\n70\n1\n';
    dxf += '0\nSTYLE\n2\nSTANDARD\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n2.5\n3\ntxt\n4\n\n';
    dxf += '0\nENDTAB\n';

    dxf += '0\nENDSEC\n';

    // ENTITIES
    dxf += '0\nSECTION\n2\nENTITIES\n';

    for (const ent of this.entities) {
      switch (ent.type) {
        case 'LINE':
          dxf += '0\nLINE\n8\n' + ent.layer + '\n';
          dxf += '10\n' + r(ent.x1) + '\n20\n' + r(ent.y1) + '\n30\n0.0\n';
          dxf += '11\n' + r(ent.x2) + '\n20\n' + r(ent.y2) + '\n31\n0.0\n';
          break;

        case 'LWPOLYLINE':
          dxf += '0\nPOLYLINE\n8\n' + ent.layer + '\n66\n1\n70\n' + (ent.closed ? '1' : '0') + '\n';
          for (const pt of ent.points) {
            dxf += '0\nVERTEX\n8\n' + ent.layer + '\n10\n' + r(pt.x) + '\n20\n' + r(pt.y) + '\n30\n0.0\n';
          }
          dxf += '0\nSEQEND\n8\n' + ent.layer + '\n';
          break;

        case 'TEXT':
          dxf += '0\nTEXT\n8\n' + ent.layer + '\n';
          dxf += '10\n' + r(ent.x) + '\n20\n' + r(ent.y) + '\n30\n0.0\n';
          dxf += '40\n' + r(ent.height) + '\n1\n' + ent.text + '\n';
          dxf += '72\n1\n';  // center justified
          dxf += '11\n' + r(ent.x) + '\n21\n' + r(ent.y) + '\n31\n0.0\n';
          break;
      }
    }

    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF\n';

    return dxf;
  }
}

function r(v) {
  return (Math.round(v * 1000) / 1000).toFixed(3);
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Helper: scarica stringa come file .dxf
 */
export function downloadDxf(dxfString, filename) {
  const blob = new Blob([dxfString], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'scala.dxf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
