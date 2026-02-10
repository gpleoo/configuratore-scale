/**
 * Modulo rendering anteprima su Canvas HTML5.
 * Supporta vista pianta, vista laterale e vista frontale.
 */

const COLORS = {
  background: '#0d0d1a',
  grid: '#1a1a2e',
  stairOutline: '#53d8fb',
  stairFill: 'rgba(83, 216, 251, 0.08)',
  stepLine: '#53d8fb',
  landing: '#ffc857',
  landingFill: 'rgba(255, 200, 87, 0.1)',
  winder: '#e94560',
  winderFill: 'rgba(233, 69, 96, 0.1)',
  dimension: '#888',
  dimensionText: '#aaa',
  arrow: '#666',
  slab: '#4a4a6a',
  slabFill: 'rgba(74, 74, 106, 0.3)',
  riserLine: '#e94560',
  nosing: '#53d8fb',
};

export class StairRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.currentView = 'plan';
    this.stairData = null;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.padding = 60;

    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _resizeCanvas() {
    const wrapper = this.canvas.parentElement;
    this.canvas.width = wrapper.clientWidth * window.devicePixelRatio;
    this.canvas.height = wrapper.clientHeight * window.devicePixelRatio;
    this.canvas.style.width = wrapper.clientWidth + 'px';
    this.canvas.style.height = wrapper.clientHeight + 'px';
    this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    this.displayWidth = wrapper.clientWidth;
    this.displayHeight = wrapper.clientHeight;
    if (this.stairData) this.render();
  }

  setView(view) {
    this.currentView = view;
    if (this.stairData) this.render();
  }

  setData(data) {
    this.stairData = data;
    this.render();
  }

  render() {
    if (!this.stairData) return;
    this._clear();

    switch (this.currentView) {
      case 'plan':
        this._renderPlan();
        break;
      case 'side':
        this._renderSide();
        break;
      case 'front':
        this._renderFront();
        break;
    }
  }

  _clear() {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);
  }

  // ─── PIANTA ────────────────────────────────────────────────

  _renderPlan() {
    const ctx = this.ctx;
    const data = this.stairData;
    if (!data.rampGeometries.length) return;

    // Calcola bounding box
    const bbox = this._getBoundingBoxPlan(data);
    this._fitToView(bbox);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    for (const rampGeo of data.rampGeometries) {
      this._drawRampPlan(rampGeo);
      if (rampGeo.connection) {
        this._drawConnectionPlan(rampGeo.connection);
      }
    }

    ctx.restore();
  }

  _drawRampPlan(geo) {
    const ctx = this.ctx;
    const { steps, width, dirX, dirY, perpX, perpY, startX, startY, totalRun } = geo;

    // Contorno rampa
    const endX = startX + dirX * totalRun;
    const endY = startY + dirY * totalRun;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX + perpX * width, endY + perpY * width);
    ctx.lineTo(startX + perpX * width, startY + perpY * width);
    ctx.closePath();
    ctx.fillStyle = COLORS.stairFill;
    ctx.fill();
    ctx.strokeStyle = COLORS.stairOutline;
    ctx.lineWidth = 1.5 / this.scale;
    ctx.stroke();

    // Linee gradini
    ctx.strokeStyle = COLORS.stepLine;
    ctx.lineWidth = 0.8 / this.scale;
    for (const step of steps) {
      ctx.beginPath();
      ctx.moveTo(step.x3, step.y3);
      ctx.lineTo(step.x4, step.y4);
      ctx.stroke();
    }

    // Freccia direzione salita
    if (steps.length > 1) {
      const midP = perpX * width * 0.5;
      const midPy = perpY * width * 0.5;
      const firstStep = steps[0];
      const lastStep = steps[steps.length - 1];
      const ax = firstStep.x1 + midP;
      const ay = firstStep.y1 + midPy;
      const bx = lastStep.x3 + midP;
      const by = lastStep.y3 + midPy;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = COLORS.arrow;
      ctx.lineWidth = 1 / this.scale;
      ctx.stroke();

      // Punta freccia
      const arrowLen = 8 / this.scale;
      const angle = Math.atan2(by - ay, bx - ax);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - arrowLen * Math.cos(angle - 0.4), by - arrowLen * Math.sin(angle - 0.4));
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - arrowLen * Math.cos(angle + 0.4), by - arrowLen * Math.sin(angle + 0.4));
      ctx.stroke();
    }

    // Numeri gradini
    ctx.fillStyle = COLORS.dimensionText;
    ctx.font = `${10 / this.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const step of steps) {
      const cx = (step.x1 + step.x4) / 2;
      const cy = (step.y1 + step.y4) / 2;
      ctx.fillText(String(step.index + 1), cx, cy);
    }
  }

  _drawConnectionPlan(conn) {
    const ctx = this.ctx;

    if (conn.type === 'landing') {
      if (conn.corners && conn.corners.length >= 4) {
        ctx.beginPath();
        ctx.moveTo(conn.corners[0].x, conn.corners[0].y);
        for (let i = 1; i < conn.corners.length; i++) {
          ctx.lineTo(conn.corners[i].x, conn.corners[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = COLORS.landingFill;
        ctx.fill();
        ctx.strokeStyle = COLORS.landing;
        ctx.lineWidth = 1.2 / this.scale;
        ctx.stroke();
      }

      // Etichetta
      ctx.fillStyle = COLORS.landing;
      ctx.font = `${9 / this.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('P', conn.x + 20 / this.scale, conn.y + 20 / this.scale);
    }

    if (conn.type === 'winder' && conn.winderSteps) {
      for (const ws of conn.winderSteps) {
        ctx.beginPath();
        ctx.moveTo(ws.innerStart.x, ws.innerStart.y);
        ctx.lineTo(ws.outerStart.x, ws.outerStart.y);
        ctx.lineTo(ws.outerEnd.x, ws.outerEnd.y);
        ctx.lineTo(ws.innerEnd.x, ws.innerEnd.y);
        ctx.closePath();
        ctx.fillStyle = COLORS.winderFill;
        ctx.fill();
        ctx.strokeStyle = COLORS.winder;
        ctx.lineWidth = 0.8 / this.scale;
        ctx.stroke();
      }
    }
  }

  // ─── VISTA LATERALE (sezione longitudinale) ────────────────

  _renderSide() {
    const ctx = this.ctx;
    const data = this.stairData;

    // Raccoglie tutti i profili laterali
    const bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const profiles = [];
    let runOffset = 0;

    for (let r = 0; r < data.rampGeometries.length; r++) {
      const ramp = data.rampResults[r];
      const geo = data.rampGeometries[r];

      // Profilo a dente di sega
      const startZ = geo.startZ;
      for (let s = 0; s < ramp.numTreads; s++) {
        const x = runOffset + s * ramp.actualTread;
        const z = startZ + s * ramp.actualRiser;
        profiles.push({ type: 'riser', x1: x, y1: z, x2: x, y2: z + ramp.actualRiser });
        profiles.push({ type: 'tread', x1: x, y1: z + ramp.actualRiser, x2: x + ramp.actualTread, y2: z + ramp.actualRiser });

        bbox.maxX = Math.max(bbox.maxX, x + ramp.actualTread);
        bbox.maxY = Math.max(bbox.maxY, z + ramp.actualRiser);
      }
      // Ultima alzata
      const lastX = runOffset + ramp.numTreads * ramp.actualTread;
      const lastZ = startZ + ramp.numTreads * ramp.actualRiser;
      profiles.push({ type: 'riser', x1: lastX, y1: lastZ, x2: lastX, y2: lastZ + ramp.actualRiser });
      bbox.maxX = Math.max(bbox.maxX, lastX);
      bbox.maxY = Math.max(bbox.maxY, lastZ + ramp.actualRiser);

      runOffset += ramp.totalRun;

      // Pianerottolo nella vista laterale = linea piatta
      if (geo.connection && geo.connection.type === 'landing') {
        const landingRun = geo.connection.depth || 100;
        profiles.push({ type: 'landing', x1: runOffset, y1: geo.startZ + ramp.totalRise, x2: runOffset + landingRun, y2: geo.startZ + ramp.totalRise });
        bbox.maxX = Math.max(bbox.maxX, runOffset + landingRun);
        runOffset += landingRun;
      } else if (geo.connection && geo.connection.type === 'winder') {
        const numW = geo.connection.numWinders || 3;
        const winderRun = 30 * numW; // stima visuale
        const baseZ = geo.startZ + ramp.totalRise;
        const rH = ramp.actualRiser;
        for (let w = 0; w < numW; w++) {
          profiles.push({ type: 'winder-riser', x1: runOffset + w * 30, y1: baseZ + w * rH, x2: runOffset + w * 30, y2: baseZ + (w + 1) * rH });
          profiles.push({ type: 'winder-tread', x1: runOffset + w * 30, y1: baseZ + (w + 1) * rH, x2: runOffset + (w + 1) * 30, y2: baseZ + (w + 1) * rH });
          bbox.maxX = Math.max(bbox.maxX, runOffset + (w + 1) * 30);
          bbox.maxY = Math.max(bbox.maxY, baseZ + (w + 1) * rH);
        }
        runOffset += winderRun;
      }
    }

    // Solaio arrivo
    if (data.slabThickness) {
      profiles.push({
        type: 'slab',
        x1: bbox.maxX - 30,
        y1: bbox.maxY,
        x2: bbox.maxX + 40,
        y2: bbox.maxY,
        thickness: data.slabThickness,
      });
    }

    // Fit to view (Y invertita perché canvas ha Y verso il basso)
    this._fitToView({ minX: bbox.minX - 20, minY: -(bbox.maxY + 40), maxX: bbox.maxX + 60, maxY: 20 });

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, -this.scale); // flip Y

    // Linea pavimento
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(bbox.maxX + 60, 0);
    ctx.strokeStyle = COLORS.slab;
    ctx.lineWidth = 1.5 / this.scale;
    ctx.stroke();

    // Profili
    for (const seg of profiles) {
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);

      if (seg.type === 'riser') {
        ctx.strokeStyle = COLORS.riserLine;
        ctx.lineWidth = 1 / this.scale;
      } else if (seg.type === 'tread') {
        ctx.strokeStyle = COLORS.stairOutline;
        ctx.lineWidth = 1.2 / this.scale;
      } else if (seg.type === 'landing') {
        ctx.strokeStyle = COLORS.landing;
        ctx.lineWidth = 1.5 / this.scale;
      } else if (seg.type.startsWith('winder')) {
        ctx.strokeStyle = COLORS.winder;
        ctx.lineWidth = 1 / this.scale;
      } else if (seg.type === 'slab') {
        // Rettangolo solaio
        ctx.strokeStyle = COLORS.slab;
        ctx.lineWidth = 1 / this.scale;
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(seg.x1, seg.y1, seg.x2 - seg.x1, seg.thickness);
        ctx.fillStyle = COLORS.slabFill;
        ctx.fill();
        ctx.strokeStyle = COLORS.slab;
      }
      ctx.stroke();
    }

    // Quotatura altezza
    this._drawDimensionVertical(ctx, bbox.maxX + 20, 0, bbox.maxY, `${data.totalHeight} cm`);

    // Quotatura sviluppo
    this._drawDimensionHorizontal(ctx, 0, bbox.maxX, -15, `${round2(runOffset)} cm`);

    ctx.restore();
  }

  // ─── VISTA FRONTALE (sezione trasversale) ──────────────────

  _renderFront() {
    const ctx = this.ctx;
    const data = this.stairData;
    if (!data.rampResults.length) return;

    const ramp = data.rampResults[0];
    const width = data.stairWidth;
    const totalH = data.totalHeight;

    const bbox = {
      minX: -10,
      minY: -(totalH + 40),
      maxX: width + 10,
      maxY: 10,
    };
    this._fitToView(bbox);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, -this.scale);

    // Contorno sezione scala
    ctx.beginPath();
    ctx.rect(0, 0, width, totalH);
    ctx.fillStyle = COLORS.stairFill;
    ctx.fill();
    ctx.strokeStyle = COLORS.stairOutline;
    ctx.lineWidth = 1.5 / this.scale;
    ctx.stroke();

    // Linee gradini tagliati
    const firstRamp = data.rampResults[0];
    let z = 0;
    for (let s = 0; s < firstRamp.numRisers; s++) {
      z += firstRamp.actualRiser;
      if (z >= totalH) break;
      ctx.beginPath();
      ctx.moveTo(0, z);
      ctx.lineTo(width, z);
      ctx.strokeStyle = COLORS.stepLine;
      ctx.lineWidth = 0.5 / this.scale;
      ctx.setLineDash([4 / this.scale, 4 / this.scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Quotatura larghezza
    this._drawDimensionHorizontal(ctx, 0, width, -8, `${width} cm`);

    // Quotatura altezza
    this._drawDimensionVertical(ctx, width + 10, 0, totalH, `${totalH} cm`);

    ctx.restore();
  }

  // ─── QUOTATURE ─────────────────────────────────────────────

  _drawDimensionHorizontal(ctx, x1, x2, y, label) {
    const arrowSize = 4 / this.scale;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.strokeStyle = COLORS.dimension;
    ctx.lineWidth = 0.6 / this.scale;
    ctx.stroke();

    // Frecce
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x1 + arrowSize, y + arrowSize / 2);
    ctx.moveTo(x1, y);
    ctx.lineTo(x1 + arrowSize, y - arrowSize / 2);
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - arrowSize, y + arrowSize / 2);
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - arrowSize, y - arrowSize / 2);
    ctx.stroke();

    // Linee di richiamo
    ctx.beginPath();
    ctx.moveTo(x1, y - 5 / this.scale);
    ctx.lineTo(x1, y + 5 / this.scale);
    ctx.moveTo(x2, y - 5 / this.scale);
    ctx.lineTo(x2, y + 5 / this.scale);
    ctx.stroke();

    // Testo
    ctx.save();
    ctx.scale(1, -1);
    ctx.fillStyle = COLORS.dimensionText;
    ctx.font = `${9 / this.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, (x1 + x2) / 2, -y + 12 / this.scale);
    ctx.restore();
  }

  _drawDimensionVertical(ctx, x, y1, y2, label) {
    const arrowSize = 4 / this.scale;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.strokeStyle = COLORS.dimension;
    ctx.lineWidth = 0.6 / this.scale;
    ctx.stroke();

    // Frecce
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x - arrowSize / 2, y1 + arrowSize);
    ctx.moveTo(x, y1);
    ctx.lineTo(x + arrowSize / 2, y1 + arrowSize);
    ctx.moveTo(x, y2);
    ctx.lineTo(x - arrowSize / 2, y2 - arrowSize);
    ctx.moveTo(x, y2);
    ctx.lineTo(x + arrowSize / 2, y2 - arrowSize);
    ctx.stroke();

    // Testo
    ctx.save();
    ctx.scale(1, -1);
    ctx.fillStyle = COLORS.dimensionText;
    ctx.font = `${9 / this.scale}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 5 / this.scale, -(y1 + y2) / 2);
    ctx.restore();
  }

  // ─── UTILITY ───────────────────────────────────────────────

  _getBoundingBoxPlan(data) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const geo of data.rampGeometries) {
      for (const step of geo.steps) {
        for (const p of [
          { x: step.x1, y: step.y1 },
          { x: step.x2, y: step.y2 },
          { x: step.x3, y: step.y3 },
          { x: step.x4, y: step.y4 },
        ]) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }

      if (geo.connection) {
        if (geo.connection.corners) {
          for (const c of geo.connection.corners) {
            minX = Math.min(minX, c.x);
            minY = Math.min(minY, c.y);
            maxX = Math.max(maxX, c.x);
            maxY = Math.max(maxY, c.y);
          }
        }
        if (geo.connection.winderSteps) {
          for (const ws of geo.connection.winderSteps) {
            for (const p of [ws.innerStart, ws.innerEnd, ws.outerStart, ws.outerEnd]) {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x);
              maxY = Math.max(maxY, p.y);
            }
          }
        }
      }
    }

    return { minX: minX - 30, minY: minY - 30, maxX: maxX + 30, maxY: maxY + 30 };
  }

  _fitToView(bbox) {
    const bboxW = bbox.maxX - bbox.minX;
    const bboxH = bbox.maxY - bbox.minY;
    const availW = this.displayWidth - this.padding * 2;
    const availH = this.displayHeight - this.padding * 2;

    this.scale = Math.min(availW / bboxW, availH / bboxH);
    this.offsetX = this.padding - bbox.minX * this.scale + (availW - bboxW * this.scale) / 2;
    this.offsetY = this.padding - bbox.minY * this.scale + (availH - bboxH * this.scale) / 2;
  }
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
