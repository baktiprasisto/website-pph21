/* ================================================================
   PajakPintar.id — app.js
   Kalkulator PPh 21 Indonesia
   Dasar hukum: UU HPP No. 7/2021, PMK-101/2016, PER-16/PJ/2016
   ================================================================ */

'use strict';

// ─── STATE ───────────────────────────────────────────────────────
let statusKawin = 'TK';
let punya_npwp  = true;
let chartD      = null;
let chartB      = null;

// ─── DATA: PTKP (PMK-101/PMK.010/2016) ──────────────────────────
const PTKP = {
  'TK/0': 54000000,  'TK/1': 58500000,  'TK/2': 63000000,  'TK/3': 67500000,
  'K/0':  58500000,  'K/1':  63000000,  'K/2':  67500000,  'K/3':  72000000,
  'K/I/0':108000000, 'K/I/1':112500000, 'K/I/2':117000000, 'K/I/3':121500000,
};

const PTKP_LABELS = {
  'TK/0':  'Tidak Kawin, 0 tanggungan',
  'TK/1':  'Tidak Kawin, 1 tanggungan',
  'TK/2':  'Tidak Kawin, 2 tanggungan',
  'TK/3':  'Tidak Kawin, 3 tanggungan',
  'K/0':   'Kawin, 0 tanggungan',
  'K/1':   'Kawin, 1 tanggungan',
  'K/2':   'Kawin, 2 tanggungan',
  'K/3':   'Kawin, 3 tanggungan',
  'K/I/0': 'Kawin + Istri Kerja, 0 tgg',
  'K/I/1': 'Kawin + Istri Kerja, 1 tgg',
  'K/I/2': 'Kawin + Istri Kerja, 2 tgg',
  'K/I/3': 'Kawin + Istri Kerja, 3 tgg',
};

// ─── DATA: TARIF PROGRESIF (UU HPP No. 7/2021, berlaku 2022) ─────
const BRACKETS = [
  { max: 60000000,   rate: 0.05, label: 's.d. Rp 60 juta' },
  { max: 190000000,  rate: 0.15, label: 'Rp 60 jt – Rp 250 juta' },
  { max: 250000000,  rate: 0.25, label: 'Rp 250 jt – Rp 500 juta' },
  { max: 4500000000, rate: 0.30, label: 'Rp 500 jt – Rp 5 miliar' },
  { max: Infinity,   rate: 0.35, label: 'Di atas Rp 5 miliar' },
];

// ─── UTILITIES ───────────────────────────────────────────────────

/** Parse Rupiah string (e.g. "10.000.000") → integer */
function parseRp(s) {
  return parseInt((s || '0').replace(/\D/g, '')) || 0;
}

/** Format integer to Rupiah string with dots */
function fmtN(n) {
  return Math.round(n).toLocaleString('id-ID');
}

/** Compact Rupiah: "Rp 2,50 M" / "Rp 500,00 jt" / "Rp 5.000" */
function fmtRp(n) {
  if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(2).replace('.', ',') + ' M';
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(2).replace('.', ',') + ' jt';
  return 'Rp ' + fmtN(n);
}

/** Full Rupiah: "Rp 10.000.000" */
function fmtRpFull(n) {
  return 'Rp ' + fmtN(n);
}

/** Format input field value as Rupiah (dots only) */
function fmtRpInput(el) {
  const v = el.value.replace(/\D/g, '');
  el.value = v ? parseInt(v).toLocaleString('id-ID') : '';
}

// ─── FORM CONTROLS ───────────────────────────────────────────────

function setStatus(s) {
  statusKawin = s;
  document.querySelectorAll('.toggle-group')[0]
    .querySelectorAll('.toggle-btn')
    .forEach((b, j) => b.classList.toggle('active', ['TK', 'K', 'K/I'][j] === s));
}

function setNpwp(v) {
  punya_npwp = v;
  document.querySelectorAll('.toggle-group')[1]
    .querySelectorAll('.toggle-btn')
    .forEach((b, j) => b.classList.toggle('active', j === (v ? 0 : 1)));
}

function updateTanggungan() {
  const v = parseInt(document.getElementById('tanggungan').value);
  document.getElementById('tanggungan-val').textContent = v + ' orang';
}

// ─── TAX CALCULATION ─────────────────────────────────────────────

/**
 * Hitung pajak progresif dari PKP
 * @param {number} pkp - Penghasilan Kena Pajak (sudah dibulatkan)
 * @param {boolean} noNpwp - Jika true, tarif +20%
 * @returns {{ total: number, layers: Array }}
 */
function calcPajak(pkp, noNpwp) {
  let sisa  = pkp;
  let total = 0;
  const layers = [];

  for (const b of BRACKETS) {
    if (sisa <= 0) break;
    const kena  = Math.min(sisa, b.max);
    const pajak = kena * b.rate;
    layers.push({ label: b.label, rate: b.rate, pkpLayer: kena, pajak });
    total += pajak;
    sisa  -= kena;
  }

  if (noNpwp) total *= 1.20;
  return { total, layers };
}

// ─── MAIN HITUNG ─────────────────────────────────────────────────
function hitungPPh() {
  // 1. Ambil input
  const gajiPerBulan     = parseRp(document.getElementById('gaji').value);
  if (!gajiPerBulan) { alert('Masukkan gaji pokok terlebih dahulu.'); return; }

  const tunjanganBulan   = parseRp(document.getElementById('tunjangan').value);
  const bonusTahunan     = parseRp(document.getElementById('bonus').value);
  const pctBpjsKes       = parseFloat(document.getElementById('bpjsKes').value)  || 0;
  const pctBpjsTK        = parseFloat(document.getElementById('bpjsTK').value)   || 0;
  const pensiunBulan     = parseRp(document.getElementById('pensiun').value);
  const tanggungan       = parseInt(document.getElementById('tanggungan').value)  || 0;

  // 2. Hitung penghasilan bruto tahunan
  const penghasilanBrutoTahunan = (gajiPerBulan + tunjanganBulan) * 12 + bonusTahunan;

  // 3. Pengurang penghasilan
  //    - Biaya jabatan: 5% dari bruto, maks Rp 6.000.000/tahun (PER-16/PJ/2016)
  const biayaJabatan    = Math.min(penghasilanBrutoTahunan * 0.05, 6000000);
  const bpjsKesTahunan  = gajiPerBulan * (pctBpjsKes / 100) * 12;
  const bpjsTKTahunan   = gajiPerBulan * (pctBpjsTK  / 100) * 12;
  const pensiunTahunan  = pensiunBulan * 12;
  const totalPotongan   = biayaJabatan + bpjsKesTahunan + bpjsTKTahunan + pensiunTahunan;

  // 4. Penghasilan Neto & PKP
  const penghasilanNeto = penghasilanBrutoTahunan - totalPotongan;
  const ptkpKey         = statusKawin + '/' + tanggungan;
  const ptkp            = PTKP[ptkpKey] || 54000000;
  const pkp             = Math.max(0, penghasilanNeto - ptkp);
  const pkpBulat        = Math.floor(pkp / 1000) * 1000; // pembulatan ribuan ke bawah

  // 5. Hitung PPh 21
  const { total: pajakTahunan, layers } = calcPajak(pkpBulat, !punya_npwp);
  const pajakBulanan = pajakTahunan / 12;
  const takehome     = gajiPerBulan
    - pajakBulanan
    - (gajiPerBulan * pctBpjsKes / 100)
    - (gajiPerBulan * pctBpjsTK  / 100)
    - pensiunBulan;

  // ── Render ───────────────────────────────────────────────────
  renderSummaryStrip(pajakBulanan, takehome, pajakTahunan, pkpBulat);
  renderPkpTable(gajiPerBulan, tunjanganBulan, bonusTahunan,
    penghasilanBrutoTahunan, biayaJabatan, bpjsKesTahunan,
    bpjsTKTahunan, pensiunTahunan, penghasilanNeto,
    ptkpKey, ptkp, pkpBulat, pajakTahunan);
  renderDonutChart(takehome * 12, pajakTahunan, bpjsKesTahunan + bpjsTKTahunan + pensiunTahunan);
  renderBracketTable(layers);
  renderPtkpTable(ptkpKey, ptkp);
  renderRekapTahunan(gajiPerBulan, tunjanganBulan, bonusTahunan,
    pajakTahunan, bpjsKesTahunan, bpjsTKTahunan, pensiunTahunan, takehome);

  // Show result
  document.getElementById('emptyState').style.display = 'none';
  const rc = document.getElementById('resultContent');
  rc.style.display = 'block';
  rc.classList.remove('fade-up');
  void rc.offsetWidth; // force reflow
  rc.classList.add('fade-up');
  setRtab('ringkasan');

  // On mobile: scroll to result
  if (window.innerWidth <= 768) {
    setTimeout(() => rc.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

// ─── RENDER HELPERS ──────────────────────────────────────────────

function renderSummaryStrip(pajakBulanan, takehome, pajakTahunan, pkpBulat) {
  document.getElementById('summaryStrip').innerHTML = `
    <div class="strip-cell">
      <div class="lbl">Pajak / Bulan</div>
      <div class="val accent">${fmtRp(pajakBulanan)}</div>
      <div class="sub">PPh 21 ditanggung</div>
    </div>
    <div class="strip-cell">
      <div class="lbl">Gaji Bersih / Bulan</div>
      <div class="val green">${fmtRp(takehome)}</div>
      <div class="sub">Setelah semua potongan</div>
    </div>
    <div class="strip-cell">
      <div class="lbl">Total Pajak / Tahun</div>
      <div class="val">${fmtRp(pajakTahunan)}</div>
      <div class="sub">PKP: ${fmtRp(pkpBulat)}</div>
    </div>
  `;
}

function renderPkpTable(gajiBln, tunjBln, bonus, bruto, biayaJab,
  bpjsKes, bpjsTK, pensiun, neto, ptkpKey, ptkp, pkp, pajak) {
  document.getElementById('pkpTable').innerHTML = `
    <tr><td class="label-cell"><span class="plus-sign">+</span>Gaji Pokok (12 bln)</td><td>${fmtRpFull(gajiBln * 12)}</td></tr>
    ${tunjBln ? `<tr><td class="label-cell"><span class="plus-sign">+</span>Tunjangan (12 bln)</td><td>${fmtRpFull(tunjBln * 12)}</td></tr>` : ''}
    ${bonus   ? `<tr><td class="label-cell"><span class="plus-sign">+</span>Bonus / THR</td><td>${fmtRpFull(bonus)}</td></tr>` : ''}
    <tr><td class="label-cell" style="font-weight:600">Penghasilan Bruto</td><td style="font-weight:700">${fmtRpFull(bruto)}</td></tr>
    <tr class="deduct"><td class="label-cell">− Biaya Jabatan (5%, maks 6 jt)</td><td>−${fmtRpFull(biayaJab)}</td></tr>
    ${bpjsKes ? `<tr class="deduct"><td class="label-cell">− Iuran BPJS Kesehatan</td><td>−${fmtRpFull(bpjsKes)}</td></tr>` : ''}
    ${bpjsTK  ? `<tr class="deduct"><td class="label-cell">− Iuran BPJS TK/JHT</td><td>−${fmtRpFull(bpjsTK)}</td></tr>` : ''}
    ${pensiun ? `<tr class="deduct"><td class="label-cell">− Iuran Pensiun</td><td>−${fmtRpFull(pensiun)}</td></tr>` : ''}
    <tr><td class="label-cell">Penghasilan Neto</td><td>${fmtRpFull(neto)}</td></tr>
    <tr class="deduct"><td class="label-cell">− PTKP (${ptkpKey})</td><td>−${fmtRpFull(ptkp)}</td></tr>
    <tr class="total-row"><td>Penghasilan Kena Pajak (PKP)</td><td>${fmtRpFull(pkp)}</td></tr>
    <tr class="total-row"><td style="color:var(--accent2)">Total PPh 21 Setahun</td><td style="color:var(--accent2)">${fmtRpFull(pajak)}</td></tr>
  `;
}

function renderDonutChart(takehomeTahunan, pajakTahunan, iuranTahunan) {
  if (chartD) chartD.destroy();
  const ctx = document.getElementById('chartDoughnut').getContext('2d');
  chartD = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Gaji Bersih (THK)', 'PPh 21', 'BPJS & Iuran'],
      datasets: [{
        data: [takehomeTahunan, pajakTahunan, iuranTahunan],
        backgroundColor: ['#2d6a4f', '#e76f51', '#b5830a'],
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      cutout: '65%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: window.innerWidth < 480 ? 'bottom' : 'right',
          labels: {
            font: { family: 'Sora', size: 11 },
            color: '#4a4a42',
            boxWidth: 10,
            padding: 14,
          },
        },
        tooltip: {
          callbacks: { label: ctx => ' ' + fmtRpFull(ctx.raw) },
        },
      },
    },
  });
}

function renderBracketTable(layers) {
  document.getElementById('bracketBody').innerHTML = layers.map(l => {
    const pct      = (l.rate * 100).toFixed(0) + '%';
    const isActive = l.pkpLayer > 0;
    return `<tr class="${isActive ? 'active-bracket' : ''}">
      <td>${l.label}</td>
      <td>${pct}${isActive ? `<span class="badge-layer">aktif</span>` : ''}</td>
      <td>${fmtRpFull(l.pkpLayer)}</td>
      <td class="tax-col">${fmtRpFull(l.pajak)}</td>
    </tr>`;
  }).join('');
}

function renderPtkpTable(activePtkpKey, ptkpVal) {
  const rows = Object.entries(PTKP).map(([k, v]) => `
    <tr class="${k === activePtkpKey ? 'active-ptkp' : ''}">
      <td>${PTKP_LABELS[k]}</td>
      <td>${fmtRpFull(v)}</td>
    </tr>
  `).join('');

  document.getElementById('ptkpTable').innerHTML = `
    <thead>
      <tr style="background:var(--ink)">
        <th style="padding:8px 10px;color:rgba(255,255,255,0.6);font-size:10px;
                   letter-spacing:.06em;text-transform:uppercase">Status PTKP</th>
        <th style="padding:8px 10px;color:rgba(255,255,255,0.6);font-size:10px;
                   letter-spacing:.06em;text-transform:uppercase;text-align:right">Jumlah PTKP</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;

  document.getElementById('ptkpSaya').textContent =
    fmtRpFull(ptkpVal) + ' (' + activePtkpKey + ')';
}

function renderRekapTahunan(gajiBln, tunjBln, bonus,
  pajakTahunan, bpjsKes, bpjsTK, pensiun, takehome) {

  const bulanLabels = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const brutoPerBln = gajiBln + tunjBln;
  const pajakPerBln = pajakTahunan / 12;

  if (chartB) chartB.destroy();
  const ctx = document.getElementById('chartBar').getContext('2d');
  chartB = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: bulanLabels,
      datasets: [
        { label: 'Gaji Bruto',   data: bulanLabels.map(() => brutoPerBln), backgroundColor: '#d8f3dc', borderRadius: 4 },
        { label: 'PPh 21',       data: bulanLabels.map(() => pajakPerBln), backgroundColor: '#e76f51', borderRadius: 4 },
        { label: 'Take Home Pay',data: bulanLabels.map(() => takehome),    backgroundColor: '#2d6a4f', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { font: { family: 'Sora', size: 11 }, color: '#4a4a42', boxWidth: 10, padding: 14 },
        },
        tooltip: {
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtRpFull(ctx.raw) },
        },
      },
      scales: {
        y: {
          grid: { color: '#eceae3' },
          ticks: { callback: v => fmtRp(v), font: { family: 'Sora', size: 10 }, color: '#8a8a80' },
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Sora', size: 10 }, color: '#8a8a80' },
        },
      },
    },
  });

  document.getElementById('rekap12Table').innerHTML = `
    <tr>
      <td class="label-cell">Gaji Bruto Setahun</td>
      <td>${fmtRpFull((gajiBln + tunjBln) * 12 + bonus)}</td>
    </tr>
    <tr class="deduct">
      <td class="label-cell">Total PPh 21 Setahun</td>
      <td style="color:var(--accent2)">−${fmtRpFull(pajakTahunan)}</td>
    </tr>
    <tr class="deduct">
      <td class="label-cell">Total BPJS &amp; Iuran Setahun</td>
      <td>−${fmtRpFull(bpjsKes + bpjsTK + pensiun)}</td>
    </tr>
    <tr class="total-row">
      <td>Take Home Pay Setahun</td>
      <td style="color:var(--accent)">${fmtRpFull(takehome * 12)}</td>
    </tr>
  `;
}

// ─── TAB SWITCHING ───────────────────────────────────────────────
function setRtab(tab) {
  const tabs = ['ringkasan', 'lapisan', 'ptkp', 'tahunan'];
  document.querySelectorAll('.rtab')
    .forEach((b, i) => b.classList.toggle('active', tabs[i] === tab));
  document.querySelectorAll('.rtab-pane')
    .forEach(p => p.classList.toggle('active', p.id === 'pane-' + tab));
}

// ─── TOOLTIP ─────────────────────────────────────────────────────
function toggleTip(e, id) {
  e.stopPropagation();
  const bubble = document.getElementById(id);
  const btn    = e.currentTarget;
  const isOpen = bubble.classList.contains('show');

  // Close all
  document.querySelectorAll('.tooltip-bubble').forEach(b => b.classList.remove('show'));
  document.querySelectorAll('.tooltip-btn').forEach(b => b.classList.remove('active'));

  if (!isOpen) {
    bubble.classList.add('show');
    btn.classList.add('active');

    // Smart position: flip left if near right edge (desktop only)
    if (window.innerWidth > 600) {
      const rect = bubble.getBoundingClientRect();
      if (rect.right > window.innerWidth - 20) {
        bubble.style.left   = 'auto';
        bubble.style.right  = '22px';
      } else {
        bubble.style.left  = '22px';
        bubble.style.right = 'auto';
      }
    }
  }
}

// Close tooltip on outside click
document.addEventListener('click', () => {
  document.querySelectorAll('.tooltip-bubble').forEach(b => b.classList.remove('show'));
  document.querySelectorAll('.tooltip-btn').forEach(b => b.classList.remove('active'));
});

// ─── INIT TOGGLE GROUPS ──────────────────────────────────────────
document.querySelectorAll('.toggle-group')[0]
  .querySelectorAll('.toggle-btn')
  .forEach((b, i) => { b.onclick = () => setStatus(['TK', 'K', 'K/I'][i]); });
document.querySelectorAll('.toggle-group')[1]
  .querySelectorAll('.toggle-btn')
  .forEach((b, i) => { b.onclick = () => setNpwp(i === 0); });