/**
 * Main - Orchestrazione UI configuratore scale.
 */
import { calculateStair } from './stairCalculator.js';
import { StairRenderer } from './stairRenderer.js';
import { DxfExporter, downloadDxf } from './dxfExporter.js';

// ─── STATE ───────────────────────────────────────────────────

let selectedType = null;
let calculatedData = null;

// ─── DOM ─────────────────────────────────────────────────────

const typePicker = document.getElementById('typePicker');
const configurator = document.getElementById('configurator');
const configTitle = document.getElementById('configTitle');
const configSubtitle = document.getElementById('configSubtitle');
const backBtn = document.getElementById('backBtn');
const calculateBtn = document.getElementById('calculateBtn');
const exportDxfBtn = document.getElementById('exportDxfBtn');
const summarySection = document.getElementById('summarySection');
const summaryContent = document.getElementById('summaryContent');
const canvas = document.getElementById('previewCanvas');

// Conditional sections
const lengthGroup2 = document.getElementById('lengthGroup2');
const lengthGroup3 = document.getElementById('lengthGroup3');
const numStepsGroup2 = document.getElementById('numStepsGroup2');
const numStepsGroup3 = document.getElementById('numStepsGroup3');
const landingSection = document.getElementById('landingSection');
const landingDepth2Group = document.getElementById('landingDepth2Group');
const winderSection = document.getElementById('winderSection');
const gapGroup = document.getElementById('gapGroup');
const riserThicknessGroup = document.getElementById('riserThicknessGroup');
const hasRiserEl = document.getElementById('hasRiser');

let renderer = null;

// ─── TYPE PICKER ─────────────────────────────────────────────

const TYPE_NAMES = {
  'straight': 'Scala Dritta',
  'l-landing': 'Scala a L con pianerottolo',
  'l-winder': 'Scala a L con gradini a ventaglio',
  'u-landing': 'Scala a U con pianerottolo',
  'u-winder': 'Scala a U con gradini a ventaglio',
  'three-flight': 'Scala a 3 rampe con 2 pianerottoli',
};

document.querySelectorAll('.type-card').forEach(card => {
  card.addEventListener('click', () => {
    selectedType = card.dataset.type;
    openConfigurator(selectedType);
  });
});

function openConfigurator(type) {
  typePicker.style.display = 'none';
  configurator.style.display = 'flex';
  configTitle.textContent = TYPE_NAMES[type] || 'Configuratore';
  configSubtitle.textContent = 'Inserisci i parametri e premi Calcola';

  // Mostra/nascondi campi in base al tipo
  const hasSecondRamp = type !== 'straight';
  const hasThirdRamp = type === 'three-flight';
  const hasLanding = type === 'l-landing' || type === 'u-landing' || type === 'three-flight';
  const hasWinder = type === 'l-winder' || type === 'u-winder';
  const hasGap = type === 'u-landing' || type === 'u-winder' || type === 'three-flight';
  const hasLanding2 = type === 'three-flight';

  lengthGroup2.style.display = hasSecondRamp ? '' : 'none';
  lengthGroup3.style.display = hasThirdRamp ? '' : 'none';
  numStepsGroup2.style.display = hasSecondRamp ? '' : 'none';
  numStepsGroup3.style.display = hasThirdRamp ? '' : 'none';
  landingSection.style.display = hasLanding ? '' : 'none';
  landingDepth2Group.style.display = hasLanding2 ? '' : 'none';
  winderSection.style.display = hasWinder ? '' : 'none';
  gapGroup.style.display = hasGap ? '' : 'none';

  // Init renderer
  if (!renderer) {
    renderer = new StairRenderer(canvas);
  }

  summarySection.style.display = 'none';
  calculatedData = null;
}

backBtn.addEventListener('click', () => {
  configurator.style.display = 'none';
  typePicker.style.display = '';
  selectedType = null;
  calculatedData = null;
});

// ─── VIEW BUTTONS ────────────────────────────────────────────

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (renderer) renderer.setView(btn.dataset.view);
  });
});

// ─── RISER TOGGLE ────────────────────────────────────────────

hasRiserEl.addEventListener('change', () => {
  riserThicknessGroup.style.display = hasRiserEl.checked ? '' : 'none';
});

// ─── CALCULATE ───────────────────────────────────────────────

calculateBtn.addEventListener('click', () => {
  calculate();
});

exportDxfBtn.addEventListener('click', () => {
  if (!calculatedData) calculate();
  exportDxf();
});

function getVal(id) {
  return parseFloat(document.getElementById(id).value) || 0;
}

function calculate() {
  const config = {
    type: selectedType,
    totalHeight: getVal('totalHeight'),
    stairWidth: getVal('stairWidth'),
    slabThickness: getVal('slabThickness'),
    rampLength1: getVal('rampLength1'),
    rampLength2: getVal('rampLength2'),
    rampLength3: getVal('rampLength3'),
    numSteps1: getVal('numSteps1'),
    numSteps2: getVal('numSteps2'),
    numSteps3: getVal('numSteps3'),
    stepThickness: getVal('stepThickness'),
    nosing: getVal('nosing'),
    hasRiser: hasRiserEl.checked,
    riserThickness: getVal('riserThickness'),
    landingDepth: getVal('landingDepth'),
    landingDepth2: getVal('landingDepth2'),
    numWinders: getVal('numWinders'),
    innerRadius: getVal('innerRadius'),
    gapBetween: getVal('gapBetween'),
    structureType: document.getElementById('structureType').value,
    stringerWidth: getVal('stringerWidth'),
    stringerHeight: getVal('stringerHeight'),
    useBlondel: document.getElementById('useBlondel').checked,
  };

  calculatedData = calculateStair(config);
  renderer.setData(calculatedData);
  showSummary(calculatedData);
}

function showSummary(data) {
  summarySection.style.display = '';

  let html = '<table><thead><tr><th>Rampa</th><th>N. alzate</th><th>Alzata (cm)</th><th>Pedata (cm)</th><th>Sviluppo (cm)</th><th>Pendenza</th></tr></thead><tbody>';

  for (let i = 0; i < data.ramps.length; i++) {
    const r = data.ramps[i];
    let extra = '';
    if (r.blondelValue !== undefined) {
      const cls = r.blondelOk ? 'blondel-ok' : 'blondel-warning';
      extra = `<br><span class="${cls}">2a+p = ${r.blondelValue}</span>`;
    }
    html += `<tr>
      <td>${i + 1}</td>
      <td>${r.numSteps}</td>
      <td>${r.riserHeight}</td>
      <td>${r.treadDepth}</td>
      <td>${r.totalRun}${extra}</td>
      <td>${r.slopeAngle}°</td>
    </tr>`;
  }

  if (data.winders.length > 0) {
    for (let i = 0; i < data.winders.length; i++) {
      const w = data.winders[i];
      html += `<tr style="color:#e94560;">
        <td>Spicchi</td>
        <td>${w.numWinders}</td>
        <td>${w.riserHeight}</td>
        <td>-</td>
        <td>-</td>
        <td>${w.turnAngle}°</td>
      </tr>`;
    }
  }

  html += '</tbody></table>';

  html += `<p style="margin-top:10px;">
    Altezza totale: <strong>${data.totalHeight} cm</strong> |
    Larghezza: <strong>${data.stairWidth} cm</strong>
  </p>`;

  if (data.warnings.length > 0) {
    html += '<div style="margin-top:10px;">';
    for (const w of data.warnings) {
      html += `<div class="warning-text">⚠ ${w}</div>`;
    }
    html += '</div>';
  }

  summaryContent.innerHTML = html;
}

// ─── EXPORT DXF ──────────────────────────────────────────────

function exportDxf() {
  const exporter = new DxfExporter();
  const dxf = exporter.generate(calculatedData, {
    exportPlan: document.getElementById('exportPlan').checked,
    exportSide: document.getElementById('exportSide').checked,
    exportFront: document.getElementById('exportFront').checked,
  });
  const typeName = (TYPE_NAMES[selectedType] || 'scala').replace(/\s+/g, '_');
  downloadDxf(dxf, `scala_${typeName}.dxf`);
}
