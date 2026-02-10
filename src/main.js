/**
 * Main - Orchestrazione UI del configuratore scale.
 */
import { calculateRamp, calculateFullStair } from './stairCalculator.js';
import { StairRenderer } from './stairRenderer.js';
import { DxfExporter, downloadDxf } from './dxfExporter.js';

// ─── STATE ───────────────────────────────────────────────────

const state = {
  stairType: 'linear',
  stairWidth: 100,
  slabThickness: 25,
  useBlondel: false,
  ramps: [
    { height: 300, riserHeight: 17, treadDepth: 28 },
  ],
  connections: [],
  exportPlan: true,
  exportSide: true,
  exportFront: false,
  exportDimensions: true,
  calculatedData: null,
};

// ─── DOM REFS ────────────────────────────────────────────────

const stairTypeEl = document.getElementById('stairType');
const stairWidthEl = document.getElementById('stairWidth');
const slabThicknessEl = document.getElementById('slabThickness');
const useBlondelEl = document.getElementById('useBlondel');
const rampsList = document.getElementById('rampsList');
const connectionsList = document.getElementById('connectionsList');
const addRampBtn = document.getElementById('addRampBtn');
const calculateBtn = document.getElementById('calculateBtn');
const exportDxfBtn = document.getElementById('exportDxfBtn');
const summarySection = document.getElementById('summarySection');
const summaryContent = document.getElementById('summaryContent');
const canvas = document.getElementById('previewCanvas');

const exportPlanEl = document.getElementById('exportPlan');
const exportSideEl = document.getElementById('exportSide');
const exportFrontEl = document.getElementById('exportFront');
const exportDimensionsEl = document.getElementById('exportDimensions');

const viewBtns = document.querySelectorAll('.view-btn');

// ─── RENDERER ────────────────────────────────────────────────

const renderer = new StairRenderer(canvas);

// ─── EVENT LISTENERS ─────────────────────────────────────────

stairTypeEl.addEventListener('change', (e) => {
  state.stairType = e.target.value;
  updateConnectionsForType();
  renderUI();
});

stairWidthEl.addEventListener('input', (e) => {
  state.stairWidth = parseFloat(e.target.value) || 100;
});

slabThicknessEl.addEventListener('input', (e) => {
  state.slabThickness = parseFloat(e.target.value) || 25;
});

useBlondelEl.addEventListener('change', (e) => {
  state.useBlondel = e.target.checked;
  renderUI();
});

addRampBtn.addEventListener('click', () => {
  state.ramps.push({ height: 300, riserHeight: 17, treadDepth: 28 });
  // Aggiungi connessione tra le rampe
  if (state.ramps.length > 1 && state.connections.length < state.ramps.length - 1) {
    state.connections.push({
      type: 'landing',
      depth: 100,
      turnAngle: getTurnAngleForType(),
      gap: 10,
      numWinders: 3,
      innerRadius: 10,
    });
  }
  renderUI();
});

calculateBtn.addEventListener('click', () => {
  calculate();
});

exportDxfBtn.addEventListener('click', () => {
  exportDxf();
});

viewBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    viewBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderer.setView(btn.dataset.view);
  });
});

// ─── UI RENDERING ────────────────────────────────────────────

function renderUI() {
  renderRamps();
  renderConnections();
}

function renderRamps() {
  rampsList.innerHTML = '';

  state.ramps.forEach((ramp, i) => {
    const card = document.createElement('div');
    card.className = 'ramp-card';

    let blondelHtml = '';
    if (state.useBlondel) {
      const result = calculateRamp({
        height: ramp.height,
        riserHeight: ramp.riserHeight,
        treadDepth: ramp.treadDepth,
        width: state.stairWidth,
        useBlondel: true,
      });
      if (result.blondelValue !== null) {
        const cls = result.blondelOk ? 'blondel-ok' : 'blondel-warning';
        const icon = result.blondelOk ? 'OK' : 'ATTENZIONE';
        blondelHtml = `<div class="${cls}">${icon}: 2a+p = ${result.blondelValue} (ideale: 62÷64)</div>`;
      }
    }

    card.innerHTML = `
      <div class="ramp-card-header">
        <h3>Rampa ${i + 1}</h3>
        ${state.ramps.length > 1 ? `<button class="btn-remove" data-index="${i}">&times;</button>` : ''}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Altezza (cm)</label>
          <input type="number" class="ramp-height" data-index="${i}" value="${ramp.height}" min="10" step="1">
        </div>
        <div class="form-group">
          <label>Alzata (cm)</label>
          <input type="number" class="ramp-riser" data-index="${i}" value="${ramp.riserHeight}" min="10" max="25" step="0.5">
        </div>
      </div>
      <div class="form-group">
        <label>Pedata (cm)</label>
        <input type="number" class="ramp-tread" data-index="${i}" value="${ramp.treadDepth}" min="15" max="45" step="0.5">
      </div>
      ${blondelHtml}
    `;

    rampsList.appendChild(card);
  });

  // Event listeners per i campi rampa
  document.querySelectorAll('.ramp-height').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.ramps[idx].height = parseFloat(e.target.value) || 300;
      if (state.useBlondel) renderRamps();
    });
  });

  document.querySelectorAll('.ramp-riser').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.ramps[idx].riserHeight = parseFloat(e.target.value) || 17;
      if (state.useBlondel) renderRamps();
    });
  });

  document.querySelectorAll('.ramp-tread').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.ramps[idx].treadDepth = parseFloat(e.target.value) || 28;
      if (state.useBlondel) renderRamps();
    });
  });

  document.querySelectorAll('.btn-remove').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.ramps.splice(idx, 1);
      // Rimuovi connessione associata
      if (state.connections.length >= idx && idx > 0) {
        state.connections.splice(idx - 1, 1);
      } else if (state.connections.length > 0 && idx === 0) {
        state.connections.splice(0, 1);
      }
      renderUI();
    });
  });
}

function renderConnections() {
  connectionsList.innerHTML = '';

  if (state.connections.length === 0) {
    connectionsList.innerHTML = '<p style="color:#666;font-size:0.8rem;">Aggiungi una seconda rampa per configurare pianerottoli o spicchi.</p>';
    return;
  }

  state.connections.forEach((conn, i) => {
    const card = document.createElement('div');
    card.className = 'connection-card';

    card.innerHTML = `
      <h3>Connessione ${i + 1} (tra Rampa ${i + 1} e ${i + 2})</h3>
      <div class="form-group">
        <label>Tipo</label>
        <select class="conn-type" data-index="${i}">
          <option value="landing" ${conn.type === 'landing' ? 'selected' : ''}>Pianerottolo</option>
          <option value="winder" ${conn.type === 'winder' ? 'selected' : ''}>Gradini a spicchio</option>
        </select>
      </div>
      ${conn.type === 'landing' ? `
        <div class="form-row">
          <div class="form-group">
            <label>Profondità pianerottolo (cm)</label>
            <input type="number" class="conn-depth" data-index="${i}" value="${conn.depth}" min="60" step="1">
          </div>
        </div>
        <div class="form-group">
          <label>Angolo di rotazione</label>
          <select class="conn-turn" data-index="${i}">
            <option value="0" ${conn.turnAngle === 0 ? 'selected' : ''}>0° (in linea)</option>
            <option value="90" ${conn.turnAngle === 90 ? 'selected' : ''}>90° (a L)</option>
            <option value="180" ${conn.turnAngle === 180 ? 'selected' : ''}>180° (a U)</option>
          </select>
        </div>
        ${conn.turnAngle === 180 ? `
          <div class="form-group">
            <label>Distanza tra rampe (cm)</label>
            <input type="number" class="conn-gap" data-index="${i}" value="${conn.gap || 10}" min="0" step="1">
          </div>
        ` : ''}
      ` : `
        <div class="form-row">
          <div class="form-group">
            <label>N. gradini a spicchio</label>
            <input type="number" class="conn-winders" data-index="${i}" value="${conn.numWinders}" min="2" max="8" step="1">
          </div>
          <div class="form-group">
            <label>Angolo totale (°)</label>
            <select class="conn-winder-angle" data-index="${i}">
              <option value="90" ${conn.turnAngle === 90 ? 'selected' : ''}>90°</option>
              <option value="180" ${conn.turnAngle === 180 ? 'selected' : ''}>180°</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Raggio interno (cm)</label>
          <input type="number" class="conn-radius" data-index="${i}" value="${conn.innerRadius || 10}" min="0" step="1">
        </div>
      `}
    `;

    connectionsList.appendChild(card);
  });

  // Event listeners per connessioni
  document.querySelectorAll('.conn-type').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.connections[idx].type = e.target.value;
      renderConnections();
    });
  });

  document.querySelectorAll('.conn-depth').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.connections[idx].depth = parseFloat(e.target.value) || 100;
    });
  });

  document.querySelectorAll('.conn-turn').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.connections[idx].turnAngle = parseInt(e.target.value);
      renderConnections();
    });
  });

  document.querySelectorAll('.conn-gap').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.connections[idx].gap = parseFloat(e.target.value) || 10;
    });
  });

  document.querySelectorAll('.conn-winders').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.connections[idx].numWinders = parseInt(e.target.value) || 3;
    });
  });

  document.querySelectorAll('.conn-winder-angle').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.connections[idx].turnAngle = parseInt(e.target.value);
    });
  });

  document.querySelectorAll('.conn-radius').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.connections[idx].innerRadius = parseFloat(e.target.value) || 10;
    });
  });
}

function getTurnAngleForType() {
  switch (state.stairType) {
    case 'u-shape': return 180;
    case 'l-shape': return 90;
    default: return 0;
  }
}

function updateConnectionsForType() {
  const turnAngle = getTurnAngleForType();
  state.connections.forEach(conn => {
    conn.turnAngle = turnAngle;
  });
}

// ─── CALCOLO ─────────────────────────────────────────────────

function calculate() {
  const config = {
    stairType: state.stairType,
    stairWidth: state.stairWidth,
    slabThickness: state.slabThickness,
    ramps: state.ramps,
    connections: state.connections,
    useBlondel: state.useBlondel,
  };

  const data = calculateFullStair(config);
  state.calculatedData = data;

  renderer.setData(data);
  showSummary(data);
}

function showSummary(data) {
  summarySection.style.display = 'block';

  let html = '<table><thead><tr><th>Rampa</th><th>Alzate</th><th>Pedate</th><th>Alzata (cm)</th><th>Pedata (cm)</th><th>Sviluppo (cm)</th></tr></thead><tbody>';

  for (let i = 0; i < data.rampResults.length; i++) {
    const r = data.rampResults[i];
    let blondelCell = '';
    if (r.blondelValue !== null) {
      const cls = r.blondelOk ? 'blondel-ok' : 'blondel-warning';
      blondelCell = `<span class="${cls}">2a+p=${r.blondelValue}</span>`;
    }
    html += `<tr>
      <td>${i + 1}</td>
      <td>${r.numRisers}</td>
      <td>${r.numTreads}</td>
      <td>${r.actualRiser}</td>
      <td>${r.actualTread}</td>
      <td>${r.totalRun} ${blondelCell}</td>
    </tr>`;
  }

  html += '</tbody></table>';
  html += `<p style="margin-top:10px;">Altezza totale: <strong>${data.totalHeight} cm</strong> | Larghezza: <strong>${data.stairWidth} cm</strong> | Pendenza rampa 1: <strong>${data.rampResults[0].slopeAngle}°</strong></p>`;

  summaryContent.innerHTML = html;
}

// ─── EXPORT DXF ──────────────────────────────────────────────

function exportDxf() {
  if (!state.calculatedData) {
    calculate();
  }

  const exporter = new DxfExporter();
  const dxfString = exporter.generate(state.calculatedData, {
    exportPlan: exportPlanEl.checked,
    exportSide: exportSideEl.checked,
    exportFront: exportFrontEl.checked,
    exportDimensions: exportDimensionsEl.checked,
  });

  downloadDxf(dxfString, 'scala_configurata.dxf');
}

// ─── INIT ────────────────────────────────────────────────────

renderUI();
