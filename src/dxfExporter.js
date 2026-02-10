/**
 * Export DXF - formato AC1009 (R12) per massima compatibilità AutoCAD.
 * Unità: centimetri.
 */

export class DxfExporter {
  constructor() {
    this.entities = [];
  }

  generate(data, options) {
    this.entities = [];
    const { exportPlan, exportSide, exportFront } = options;
    let ox = 0;

    if (exportPlan) {
      this._planView(data, 0, 0);
      ox = this._maxX() + 200;
    }

    if (exportSide) {
      this._sideView(data, ox, 0);
      ox += this._sideWidth(data) + 200;
    }

    if (exportFront) {
      this._frontView(data, ox, 0);
    }

    return this._build();
  }

  // ─── PIANTA ─────────────────────────────────────────────────

  _planView(data, ox, oy) {
    const pg = data.planGeometry;
    if (!pg) return;

    // Pianerottoli
    for (const l of pg.landings) {
      this._polyline('PIANEROTTOLO', l.corners.map(p => [ox + p.x, oy + p.y]), true);
    }

    // Winders
    for (const wg of pg.winders) {
      for (const ws of wg.steps) {
        this._polyline('SPICCHIO', [
          [ox + ws.innerStart.x, oy + ws.innerStart.y],
          [ox + ws.outerStart.x, oy + ws.outerStart.y],
          [ox + ws.outerEnd.x, oy + ws.outerEnd.y],
          [ox + ws.innerEnd.x, oy + ws.innerEnd.y],
        ], true);
        const cx = (ws.innerStart.x + ws.outerEnd.x) / 2;
        const cy = (ws.innerStart.y + ws.outerEnd.y) / 2;
        this._text('TESTI', ox + cx, oy + cy, String(ws.label), 3);
      }
    }

    // Rampe
    for (const ramp of pg.ramps) {
      this._polyline('CONTORNO', ramp.outline.map(p => [ox + p.x, oy + p.y]), true);
      for (const s of ramp.steps) {
        this._line('GRADINI', ox + s.x3, oy + s.y3, ox + s.x4, oy + s.y4);
        const cx = (s.x1 + s.x4) / 2;
        const cy = (s.y1 + s.y4) / 2;
        this._text('TESTI', ox + cx, oy + cy, String(s.label), 2.5);
      }
      // Freccia direzione
      const d = ramp.direction;
      this._line('FRECCIA', ox + d.startX, oy + d.startY, ox + d.endX, oy + d.endY);
    }

    this._text('TESTI', ox, oy - 10, 'PIANTA', 5);
  }

  // ─── VISTA LATERALE ─────────────────────────────────────────

  _sideView(data, ox, oy) {
    const sp = data.sideProfile;
    if (!sp) return;

    // Profilo gradini
    for (const seg of sp.segments) {
      const layer = seg.type === 'riser' || seg.type === 'winder-riser' ? 'ALZATE' :
                    seg.type === 'landing' ? 'PIANEROTTOLO' :
                    seg.type.startsWith('winder') ? 'SPICCHIO' : 'PEDATE';
      this._line(layer, ox + seg.x1, oy + seg.z1, ox + seg.x2, oy + seg.z2);
    }

    // Pavimento
    this._line('SOLAIO', ox - 20, oy, ox + sp.totalRun + 40, oy);

    // Solaio arrivo
    const sT = data.slabThickness || 25;
    this._polyline('SOLAIO', [
      [ox + sp.totalRun - 30, oy + sp.totalRise],
      [ox + sp.totalRun + 60, oy + sp.totalRise],
      [ox + sp.totalRun + 60, oy + sp.totalRise + sT],
      [ox + sp.totalRun - 30, oy + sp.totalRise + sT],
    ], true);

    // Quota altezza
    this._dimV('QUOTATURE', ox + sp.totalRun + 40, oy, oy + sp.totalRise, `H=${data.totalHeight}`);
    // Quota sviluppo
    this._dimH('QUOTATURE', ox, ox + sp.totalRun, oy - 15, `L=${r2(sp.totalRun)}`);
    // Quota singola alzata e pedata (prima rampa)
    if (data.ramps.length > 0) {
      const rm = data.ramps[0];
      this._dimV('QUOTATURE', ox - 10, oy, oy + rm.riserHeight, `a=${rm.riserHeight}`);
      this._dimH('QUOTATURE', ox, ox + rm.treadDepth, oy + rm.riserHeight - 8, `p=${rm.treadDepth}`);
    }

    this._text('TESTI', ox, oy + sp.totalRise + sT + 15, 'VISTA LATERALE', 5);
  }

  // ─── VISTA FRONTALE ─────────────────────────────────────────

  _frontView(data, ox, oy) {
    const W = data.stairWidth;
    const H = data.totalHeight;

    this._polyline('SEZIONE', [
      [ox, oy], [ox + W, oy], [ox + W, oy + H], [ox, oy + H],
    ], true);

    // Gradini tratteggiati
    if (data.ramps.length > 0) {
      const rm = data.ramps[0];
      let z = 0;
      for (let i = 0; i < rm.numSteps; i++) {
        z += rm.riserHeight;
        if (z >= H) break;
        this._line('GRADINI', ox, oy + z, ox + W, oy + z);
      }
    }

    this._dimH('QUOTATURE', ox, ox + W, oy - 10, `L=${W}`);
    this._dimV('QUOTATURE', ox + W + 10, oy, oy + H, `H=${H}`);
    this._text('TESTI', ox, oy + H + 15, 'VISTA FRONTALE', 5);
  }

  // ─── PRIMITIVES ─────────────────────────────────────────────

  _line(layer, x1, y1, x2, y2) {
    this.entities.push({ t: 'L', layer, x1, y1, x2, y2 });
  }

  _polyline(layer, pts, closed) {
    this.entities.push({ t: 'P', layer, pts, closed });
  }

  _text(layer, x, y, text, h) {
    this.entities.push({ t: 'T', layer, x, y, text, h: h || 3 });
  }

  _dimH(layer, x1, x2, y, label) {
    this._line(layer, x1, y, x2, y);
    this._line(layer, x1, y - 3, x1, y + 3);
    this._line(layer, x2, y - 3, x2, y + 3);
    // Frecce
    this._line(layer, x1, y, x1 + 2.5, y + 1.2);
    this._line(layer, x1, y, x1 + 2.5, y - 1.2);
    this._line(layer, x2, y, x2 - 2.5, y + 1.2);
    this._line(layer, x2, y, x2 - 2.5, y - 1.2);
    this._text(layer, (x1 + x2) / 2, y + 4, label, 2.5);
  }

  _dimV(layer, x, y1, y2, label) {
    this._line(layer, x, y1, x, y2);
    this._line(layer, x - 3, y1, x + 3, y1);
    this._line(layer, x - 3, y2, x + 3, y2);
    this._line(layer, x, y1, x - 1.2, y1 + 2.5);
    this._line(layer, x, y1, x + 1.2, y1 + 2.5);
    this._line(layer, x, y2, x - 1.2, y2 - 2.5);
    this._line(layer, x, y2, x + 1.2, y2 - 2.5);
    this._text(layer, x + 5, (y1 + y2) / 2, label, 2.5);
  }

  // ─── UTILS ──────────────────────────────────────────────────

  _maxX() {
    let mx = 0;
    for (const e of this.entities) {
      if (e.t === 'L') mx = Math.max(mx, e.x1, e.x2);
      if (e.t === 'P') for (const p of e.pts) mx = Math.max(mx, p[0]);
      if (e.t === 'T') mx = Math.max(mx, e.x);
    }
    return mx;
  }

  _sideWidth(data) {
    return (data.sideProfile ? data.sideProfile.totalRun : 0) + 100;
  }

  // ─── DXF BUILD ──────────────────────────────────────────────

  _build() {
    const layers = [
      { n: '0', c: 7 },
      { n: 'CONTORNO', c: 3 },
      { n: 'GRADINI', c: 5 },
      { n: 'PIANEROTTOLO', c: 2 },
      { n: 'SPICCHIO', c: 1 },
      { n: 'ALZATE', c: 1 },
      { n: 'PEDATE', c: 5 },
      { n: 'SOLAIO', c: 8 },
      { n: 'SEZIONE', c: 4 },
      { n: 'QUOTATURE', c: 8 },
      { n: 'FRECCIA', c: 8 },
      { n: 'TESTI', c: 7 },
    ];

    let d = '';

    // HEADER
    d += '0\nSECTION\n2\nHEADER\n';
    d += '9\n$ACADVER\n1\nAC1009\n';
    d += '9\n$INSUNITS\n70\n5\n';
    d += '0\nENDSEC\n';

    // TABLES
    d += '0\nSECTION\n2\nTABLES\n';

    // LTYPE
    d += '0\nTABLE\n2\nLTYPE\n70\n1\n';
    d += '0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n';
    d += '0\nENDTAB\n';

    // LAYER
    d += '0\nTABLE\n2\nLAYER\n70\n' + layers.length + '\n';
    for (const l of layers) {
      d += '0\nLAYER\n2\n' + l.n + '\n70\n0\n62\n' + l.c + '\n6\nCONTINUOUS\n';
    }
    d += '0\nENDTAB\n';

    // STYLE
    d += '0\nTABLE\n2\nSTYLE\n70\n1\n';
    d += '0\nSTYLE\n2\nSTANDARD\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n2.5\n3\ntxt\n4\n\n';
    d += '0\nENDTAB\n';

    d += '0\nENDSEC\n';

    // ENTITIES
    d += '0\nSECTION\n2\nENTITIES\n';

    for (const e of this.entities) {
      if (e.t === 'L') {
        d += '0\nLINE\n8\n' + e.layer + '\n';
        d += '10\n' + f(e.x1) + '\n20\n' + f(e.y1) + '\n30\n0.0\n';
        d += '11\n' + f(e.x2) + '\n21\n' + f(e.y2) + '\n31\n0.0\n';
      }
      else if (e.t === 'P') {
        d += '0\nPOLYLINE\n8\n' + e.layer + '\n66\n1\n70\n' + (e.closed ? '1' : '0') + '\n';
        for (const p of e.pts) {
          d += '0\nVERTEX\n8\n' + e.layer + '\n10\n' + f(p[0]) + '\n20\n' + f(p[1]) + '\n30\n0.0\n';
        }
        d += '0\nSEQEND\n8\n' + e.layer + '\n';
      }
      else if (e.t === 'T') {
        d += '0\nTEXT\n8\n' + e.layer + '\n';
        d += '10\n' + f(e.x) + '\n20\n' + f(e.y) + '\n30\n0.0\n';
        d += '40\n' + f(e.h) + '\n1\n' + e.text + '\n';
      }
    }

    d += '0\nENDSEC\n';
    d += '0\nEOF\n';

    return d;
  }
}

function f(v) {
  return (Math.round(v * 1000) / 1000).toFixed(3);
}

function r2(v) {
  return Math.round(v * 100) / 100;
}

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
