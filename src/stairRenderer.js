/**
 * Renderer Canvas per anteprima scale.
 * Supporta pianta, vista laterale (sezione longitudinale), vista frontale.
 */

const C = {
  bg: '#0d0d1a',
  stairOutline: '#53d8fb',
  stairFill: 'rgba(83, 216, 251, 0.06)',
  stepLine: '#53d8fb',
  landing: '#ffc857',
  landingFill: 'rgba(255, 200, 87, 0.08)',
  winder: '#e94560',
  winderFill: 'rgba(233, 69, 96, 0.08)',
  dim: '#666',
  dimText: '#aaa',
  arrow: '#888',
  riserLine: '#e94560',
  slab: '#4a4a6a',
  slabFill: 'rgba(74, 74, 106, 0.25)',
  floor: '#555',
};

export class StairRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = 'plan';
    this.data = null;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.pad = 60;
    this._resize();
    window.addEventListener('resize', () => { this._resize(); });
  }

  _resize() {
    const w = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w.clientWidth * dpr;
    this.canvas.height = w.clientHeight * dpr;
    this.canvas.style.width = w.clientWidth + 'px';
    this.canvas.style.height = w.clientHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w.clientWidth;
    this.H = w.clientHeight;
    if (this.data) this.render();
  }

  setView(v) { this.view = v; if (this.data) this.render(); }
  setData(d) { this.data = d; this.render(); }

  render() {
    if (!this.data) return;
    this.ctx.fillStyle = C.bg;
    this.ctx.fillRect(0, 0, this.W, this.H);
    if (this.view === 'plan') this._plan();
    else if (this.view === 'side') this._side();
    else if (this.view === 'front') this._front();
  }

  // ─── PIANTA ────────────────────────────────────────────────

  _plan() {
    const pg = this.data.planGeometry;
    if (!pg) return;
    const bbox = this._bbox(pg);
    this._fit(bbox);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);

    // Pianerottoli
    for (const l of pg.landings) {
      this._poly(l.corners, C.landingFill, C.landing, 1.2);
      // Label
      const cx = l.corners.reduce((s, p) => s + p.x, 0) / l.corners.length;
      const cy = l.corners.reduce((s, p) => s + p.y, 0) / l.corners.length;
      this._text(cx, cy, 'P', C.landing, 10);
    }

    // Winders
    for (const wg of pg.winders) {
      for (const ws of wg.steps) {
        this._poly([ws.innerStart, ws.outerStart, ws.outerEnd, ws.innerEnd], C.winderFill, C.winder, 0.8);
        const cx = (ws.innerStart.x + ws.outerEnd.x) / 2;
        const cy = (ws.innerStart.y + ws.outerEnd.y) / 2;
        this._text(cx, cy, String(ws.label), C.winder, 8);
      }
    }

    // Rampe
    for (const ramp of pg.ramps) {
      this._poly(ramp.outline, C.stairFill, C.stairOutline, 1.5);
      // Linee gradini
      for (const s of ramp.steps) {
        ctx.beginPath();
        ctx.moveTo(s.x3, s.y3);
        ctx.lineTo(s.x4, s.y4);
        ctx.strokeStyle = C.stepLine;
        ctx.lineWidth = 0.6 / this.scale;
        ctx.stroke();
        // Numero
        const cx = (s.x1 + s.x4) / 2;
        const cy = (s.y1 + s.y4) / 2;
        this._text(cx, cy, String(s.label), C.dimText, 8);
      }
      // Freccia direzione
      const d = ramp.direction;
      ctx.beginPath();
      ctx.moveTo(d.startX, d.startY);
      ctx.lineTo(d.endX, d.endY);
      ctx.strokeStyle = C.arrow;
      ctx.lineWidth = 1 / this.scale;
      ctx.stroke();
      const a = Math.atan2(d.endY - d.startY, d.endX - d.startX);
      const al = 6 / this.scale;
      ctx.beginPath();
      ctx.moveTo(d.endX, d.endY);
      ctx.lineTo(d.endX - al * Math.cos(a - 0.4), d.endY - al * Math.sin(a - 0.4));
      ctx.moveTo(d.endX, d.endY);
      ctx.lineTo(d.endX - al * Math.cos(a + 0.4), d.endY - al * Math.sin(a + 0.4));
      ctx.stroke();
    }

    ctx.restore();
  }

  // ─── VISTA LATERALE ────────────────────────────────────────

  _side() {
    const sp = this.data.sideProfile;
    if (!sp) return;
    const ctx = this.ctx;

    let maxX = sp.totalRun + 60;
    let maxZ = sp.totalRise + (this.data.slabThickness || 25) + 20;
    this._fit({ minX: -30, minY: -(maxZ + 20), maxX: maxX, maxY: 20 });

    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, -this.scale);

    // Pavimento
    ctx.beginPath();
    ctx.moveTo(-20, 0); ctx.lineTo(maxX, 0);
    ctx.strokeStyle = C.floor; ctx.lineWidth = 1.5 / this.scale; ctx.stroke();

    // Profilo gradini
    for (const seg of sp.segments) {
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.z1);
      ctx.lineTo(seg.x2, seg.z2);
      if (seg.type === 'riser' || seg.type === 'winder-riser') {
        ctx.strokeStyle = C.riserLine;
      } else if (seg.type === 'landing') {
        ctx.strokeStyle = C.landing;
        ctx.lineWidth = 1.5 / this.scale;
      } else {
        ctx.strokeStyle = C.stairOutline;
      }
      ctx.lineWidth = 1 / this.scale;
      ctx.stroke();
    }

    // Solaio arrivo
    const slabT = this.data.slabThickness || 25;
    ctx.fillStyle = C.slabFill;
    ctx.strokeStyle = C.slab;
    ctx.lineWidth = 1 / this.scale;
    ctx.beginPath();
    ctx.rect(sp.totalRun - 30, sp.totalRise, 90, slabT);
    ctx.fill(); ctx.stroke();

    // Quotatura altezza totale
    this._dimV(ctx, sp.totalRun + 30, 0, sp.totalRise, `H=${this.data.totalHeight}`);

    // Quotatura sviluppo
    this._dimH(ctx, 0, sp.totalRun, -12, `L=${round2(sp.totalRun)}`);

    ctx.restore();
  }

  // ─── VISTA FRONTALE ────────────────────────────────────────

  _front() {
    const ctx = this.ctx;
    const W = this.data.stairWidth;
    const H = this.data.totalHeight;

    this._fit({ minX: -20, minY: -(H + 40), maxX: W + 30, maxY: 20 });
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, -this.scale);

    // Rettangolo sezione
    ctx.fillStyle = C.stairFill;
    ctx.strokeStyle = C.stairOutline;
    ctx.lineWidth = 1.5 / this.scale;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.fill(); ctx.stroke();

    // Linee alzate
    const ramp = this.data.ramps[0];
    if (ramp) {
      let z = 0;
      for (let i = 0; i < ramp.numSteps; i++) {
        z += ramp.riserHeight;
        if (z >= H) break;
        ctx.beginPath();
        ctx.moveTo(0, z); ctx.lineTo(W, z);
        ctx.strokeStyle = C.stepLine;
        ctx.lineWidth = 0.4 / this.scale;
        ctx.setLineDash([3 / this.scale, 3 / this.scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    this._dimH(ctx, 0, W, -8, `L=${W}`);
    this._dimV(ctx, W + 10, 0, H, `H=${H}`);

    ctx.restore();
  }

  // ─── HELPERS ───────────────────────────────────────────────

  _poly(pts, fill, stroke, lw) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = (lw || 1) / this.scale; ctx.stroke(); }
  }

  _text(x, y, txt, color, size) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = `${(size || 9) / this.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
  }

  _dimH(ctx, x1, x2, y, label) {
    const s = this.scale;
    ctx.beginPath();
    ctx.moveTo(x1, y); ctx.lineTo(x2, y);
    ctx.strokeStyle = C.dim; ctx.lineWidth = 0.5 / s; ctx.stroke();
    ctx.save(); ctx.scale(1, -1);
    ctx.fillStyle = C.dimText;
    ctx.font = `${8 / s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, (x1 + x2) / 2, -y + 10 / s);
    ctx.restore();
  }

  _dimV(ctx, x, y1, y2, label) {
    const s = this.scale;
    ctx.beginPath();
    ctx.moveTo(x, y1); ctx.lineTo(x, y2);
    ctx.strokeStyle = C.dim; ctx.lineWidth = 0.5 / s; ctx.stroke();
    ctx.save(); ctx.scale(1, -1);
    ctx.fillStyle = C.dimText;
    ctx.font = `${8 / s}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 4 / s, -(y1 + y2) / 2);
    ctx.restore();
  }

  _bbox(pg) {
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    const add = (x, y) => { mnx = Math.min(mnx, x); mny = Math.min(mny, y); mxx = Math.max(mxx, x); mxy = Math.max(mxy, y); };
    for (const r of pg.ramps) for (const p of r.outline) add(p.x, p.y);
    for (const l of pg.landings) for (const p of l.corners) add(p.x, p.y);
    for (const wg of pg.winders) for (const ws of wg.steps) {
      add(ws.innerStart.x, ws.innerStart.y); add(ws.outerEnd.x, ws.outerEnd.y);
      add(ws.innerEnd.x, ws.innerEnd.y); add(ws.outerStart.x, ws.outerStart.y);
    }
    return { minX: mnx - 20, minY: mny - 20, maxX: mxx + 20, maxY: mxy + 20 };
  }

  _fit(bb) {
    const bw = bb.maxX - bb.minX;
    const bh = bb.maxY - bb.minY;
    const aw = this.W - this.pad * 2;
    const ah = this.H - this.pad * 2;
    this.scale = Math.min(aw / bw, ah / bh);
    this.ox = this.pad - bb.minX * this.scale + (aw - bw * this.scale) / 2;
    this.oy = this.pad - bb.minY * this.scale + (ah - bh * this.scale) / 2;
  }
}

function round2(v) { return Math.round(v * 100) / 100; }
