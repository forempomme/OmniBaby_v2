// ----------------------------------------------------------------------
// PDF « Résumé pédiatrique » — A4, une page dans le cas courant.
// Chargé à la demande depuis utils.exportPDF (jsPDF + polices ≈ 500 ko).
//
// Police : Poppins embarquée (TTF) → accents, « ° », « — », « · » corrects.
// Aucun emoji dans le PDF : aucune police PDF standard ne les contient.
// ----------------------------------------------------------------------
import { jsPDF } from 'jspdf';
import poppinsRegularUrl from './assets/fonts/Poppins-Regular.ttf?url';
import poppinsBoldUrl from './assets/fonts/Poppins-Bold.ttf?url';
import {
  WEIGHT_LMS, HEIGHT_LMS, HEAD_LMS, PERCENTILE_Z,
  getLMS, lmsValue, estimatePercentile, VACCINS_CALENDRIER,
} from './data/who-growth.js';
import { shareFileNative, toISODate } from './utils.jsx';
import { stoolColor } from './journal/entryTypes.js';

// ── Couleurs (maquette validée) ─────────────────────────────────────
const C = {
  header: [169, 83, 47],
  ink: [43, 35, 32],
  soft: [107, 92, 84],
  title: [138, 69, 40],
  accent: [201, 111, 74],
  rule: [241, 230, 221],
  cellBg: [251, 244, 238],
  cellBorder: [234, 217, 203],
  dangerBg: [245, 218, 211],
  danger: [142, 58, 40],
  okBg: [220, 230, 223],
  ok: [47, 90, 60],
  warnBg: [246, 226, 196],
  warn: [122, 84, 24],
  band: [240, 228, 218],
  p50: [201, 182, 168],
  dashed: [217, 198, 184],
};

const W = 210;
const M = 13;            // marge
const RIGHT = W - M;
const BOTTOM = 278;      // au-delà : nouvelle page

// ── Utilitaires ─────────────────────────────────────────────────────
const nb = (s) => String(s).replace(/[  ]/g, ' ');
const fmt = (n, d = 0) => nb(Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
};
const fmtShort = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const fmtHours = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
};
const forChild = (list, child) => (list || []).filter((e) => e.childId == null || e.childId === child.id);
const ageMonthsAt = (birthdate, date) =>
  Math.max(0, (new Date(date) - new Date(birthdate)) / (86400000 * 30.4375));

function ageLabel(birthdate) {
  if (!birthdate) return '';
  const months = Math.floor(ageMonthsAt(birthdate, new Date()));
  if (months < 1) {
    const days = Math.floor((new Date() - new Date(birthdate)) / 86400000);
    return `${days} jour${days > 1 ? 's' : ''}`;
  }
  if (months < 24) return `${months} mois`;
  const y = Math.floor(months / 12);
  return `${y} an${y > 1 ? 's' : ''}${months % 12 ? ` ${months % 12} mois` : ''}`;
}

async function fetchBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Police introuvable (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

async function loadFonts(doc) {
  const [regular, bold] = await Promise.all([fetchBase64(poppinsRegularUrl), fetchBase64(poppinsBoldUrl)]);
  doc.addFileToVFS('Poppins-Regular.ttf', regular);
  doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');
  doc.addFileToVFS('Poppins-Bold.ttf', bold);
  doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');
}

// Document A4 avec Poppins chargée (réutilisé par la fiche de garde)
// Les emoji saisis par l'utilisateur (« 🥜 arachide ») n'existent dans
// aucune police PDF : ils sont retirés plutôt que d'afficher « Ø=Ü ».
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;
export function pdfSafe(text) {
  return String(text ?? '').replace(EMOJI_RE, '').replace(/[\u202f]/g, ' ').replace(/ {2,}/g, ' ');
}

export async function createPdfDoc() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadFonts(doc);
  const rawText = doc.text.bind(doc);
  doc.text = (text, ...rest) => rawText(Array.isArray(text) ? text.map(pdfSafe) : pdfSafe(text), ...rest);
  const rawSplit = doc.splitTextToSize.bind(doc);
  doc.splitTextToSize = (text, ...rest) => rawSplit(pdfSafe(text), ...rest);
  return doc;
}

export async function sharePdf(doc, filename) {
  await shareFileNative(filename, 'application/pdf', doc.output('datauristring').split(',')[1]);
}

// ── Calculs ─────────────────────────────────────────────────────────
export function computeWeek(store, child, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const inPeriod = (v) => { const t = new Date(v).getTime(); return t >= start.getTime() && t <= now.getTime(); };

  const entries = forChild(store.entries, child).filter((e) => inPeriod(e.debut || e.date));
  const feeds = entries.filter((e) => e.type === 'biberon');
  const bottles = feeds.filter((e) => e.mode !== 'sein');
  const breast = feeds.filter((e) => e.mode === 'sein');
  const milk = bottles.reduce((s, e) => s + (Number(e.quantite) || 0), 0);
  const breastMin = breast.reduce((s, e) => s + (Number(e.duree) || 0), 0);
  const diapers = entries.filter((e) => e.type === 'couche').length;
  const paleStools = entries.filter((e) => e.type === 'couche' && stoolColor(e.couleur)?.pale).length;
  const sleepMin = entries.filter((e) => e.type === 'sommeil' && !e.enCours)
    .reduce((s, e) => s + (Number(e.duree) || 0), 0);
  const temps = forChild(store.temperatures, child).filter((t) => inPeriod(t.date));
  const maxTemp = temps.length ? Math.max(...temps.map((t) => Number(t.valeur) || 0)) : null;

  const rows = [];
  if (feeds.length) rows.push(['Biberons et tétées', fmt(feeds.length), fmt(feeds.length / 7, 1)]);
  if (milk) rows.push(['Lait au biberon', `${fmt(milk)} ml`, `${fmt(milk / 7)} ml`]);
  if (breastMin) rows.push(['Tétées (durée saisie)', fmtHours(breastMin), fmtHours(breastMin / 7)]);
  if (diapers) rows.push(['Changes', fmt(diapers), fmt(diapers / 7, 1)]);
  if (paleStools) rows.push(['Selles décolorées signalées', fmt(paleStools), 'à vérifier']);
  if (sleepMin) rows.push(['Sommeil (nuits + siestes saisies)', fmtHours(sleepMin), fmtHours(sleepMin / 7)]);
  if (temps.length) rows.push(['Températures relevées', fmt(temps.length), `max ${fmt(maxTemp, 1)} °C`]);
  return { start, end: now, rows };
}

const GROWTH = [
  { key: 'poids', label: 'Poids', unit: 'kg', table: WEIGHT_LMS, dec: 2 },
  { key: 'taille', label: 'Taille', unit: 'cm', table: HEIGHT_LMS, dec: 1 },
  { key: 'perimetre', label: 'Périmètre crânien', unit: 'cm', table: HEAD_LMS, dec: 1 },
];

export function computeGrowth(store, child) {
  const sexe = child.sexe === 'garcon' ? 'garcon' : 'fille';
  const mesures = forChild(store.mesures, child);
  return GROWTH.map((g) => {
    const list = mesures.filter((m) => m.type === g.key && Number(m.valeur) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!list.length) return null;
    const first = list[0];
    const last = list[list.length - 1];
    const age = child.birthdate ? ageMonthsAt(child.birthdate, last.date) : null;
    const pct = age != null && age <= 36 ? estimatePercentile(g.table, sexe, age, Number(last.valeur)) : null;
    const diff = Number(last.valeur) - Number(first.valeur);
    return {
      ...g,
      list,
      last,
      value: `${fmt(last.valeur, g.dec)} ${g.unit}`,
      date: fmtDate(last.date),
      evolution: list.length > 1 ? `${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff), g.dec)} ${g.unit}` : '—',
      pct,
    };
  }).filter(Boolean);
}

// ── Dessin ──────────────────────────────────────────────────────────
function makePainter(doc) {
  const font = (style = 'normal', size = 9, color = C.ink) => {
    doc.setFont('Poppins', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const fit = (text, maxW) => {
    const s = String(text ?? '');
    if (doc.getTextWidth(s) <= maxW) return s;
    let t = s;
    while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
    return t + '…';
  };
  return { font, fit };
}

function drawCheck(doc, x, y, color) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.line(x, y - 1.2, x + 1, y - 0.2);
  doc.line(x + 1, y - 0.2, x + 2.8, y - 2.4);
}

function pctStyle(p) {
  if (p >= 15 && p <= 85) return [C.okBg, C.ok];
  if (p >= 3 && p <= 97) return [C.warnBg, C.warn];
  return [C.dangerBg, C.danger];
}

function drawWeightSpark(doc, child, list, x, y, w, h) {
  const sexe = child.sexe === 'garcon' ? 'garcon' : 'fille';
  const pts = list.map((m) => ({ a: ageMonthsAt(child.birthdate, m.date), v: Number(m.valeur) }))
    .filter((p) => p.a <= 36);
  if (!pts.length) return false;
  const aMax = Math.min(36, Math.max(3, Math.ceil(Math.max(...pts.map((p) => p.a)) + 1)));
  const steps = 24;
  const curve = (z) => Array.from({ length: steps + 1 }, (_, i) => {
    const a = (aMax * i) / steps;
    return { a, v: lmsValue(getLMS(WEIGHT_LMS, sexe, a), z) };
  });
  const p15 = curve(PERCENTILE_Z.p15);
  const p50 = curve(PERCENTILE_Z.p50);
  const p85 = curve(PERCENTILE_Z.p85);
  const vMin = Math.min(...p15.map((p) => p.v), ...pts.map((p) => p.v)) * 0.95;
  const vMax = Math.max(...p85.map((p) => p.v), ...pts.map((p) => p.v)) * 1.03;
  const X = (a) => x + (a / aMax) * w;
  const Y = (v) => y + h - ((v - vMin) / (vMax - vMin)) * h;

  // Bande P15–P85
  const poly = [...p85.map((p) => [X(p.a), Y(p.v)]), ...p15.slice().reverse().map((p) => [X(p.a), Y(p.v)])];
  const deltas = [];
  for (let i = 1; i < poly.length; i++) deltas.push([poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]]);
  doc.setFillColor(...C.band);
  doc.lines(deltas, poly[0][0], poly[0][1], [1, 1], 'F', true);

  // P50 en pointillé
  doc.setDrawColor(...C.p50);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1, 1], 0);
  for (let i = 1; i < p50.length; i++) doc.line(X(p50[i - 1].a), Y(p50[i - 1].v), X(p50[i].a), Y(p50[i].v));
  doc.setLineDashPattern([], 0);

  // Courbe de l'enfant
  doc.setDrawColor(...C.header);
  doc.setLineWidth(0.7);
  for (let i = 1; i < pts.length; i++) doc.line(X(pts[i - 1].a), Y(pts[i - 1].v), X(pts[i].a), Y(pts[i].v));
  doc.setFillColor(...C.header);
  const lastP = pts[pts.length - 1];
  doc.circle(X(lastP.a), Y(lastP.v), 0.9, 'F');
  return true;
}

// ── Export principal ────────────────────────────────────────────────
export async function exportPediatricPDF(store, child) {
  const doc = await createPdfDoc();
  const { font, fit } = makePainter(doc);
  const now = new Date();
  const week = computeWeek(store, child, now);
  const growth = computeGrowth(store, child);
  let y = 0;

  const newPage = () => { doc.addPage(); y = 16; };
  const ensure = (h) => { if (y + h > BOTTOM) newPage(); };
  const section = (title, minHeight = 20) => {
    ensure(minHeight);
    font('bold', 10.5, C.title);
    doc.text(title, M, y);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.5);
    doc.line(M, y + 1.8, RIGHT, y + 1.8);
    y += 7.5;
  };

  // ── En-tête ──
  doc.setFillColor(...C.header);
  doc.rect(0, 0, W, 24, 'F');
  font('bold', 19, [255, 255, 255]);
  doc.text('Résumé pédiatrique', M, 12.5);
  font('normal', 8.5, [255, 255, 255]);
  doc.text(`OmniBaby · période du ${fmtShort(week.start)} au ${now.toLocaleDateString('fr-FR')}`, M, 19);
  doc.text(`Généré le ${now.toLocaleDateString('fr-FR')}`, RIGHT, 19, { align: 'right' });
  y = 30;

  // ── Fiche enfant (4 cases) ──
  const cellW = (RIGHT - M) / 4;
  const cellH = 14;
  const allergies = (child.allergies || '').trim();
  const cells = [
    ['ENFANT', child.nom || '—', false],
    [child.sexe === 'garcon' ? 'NÉ LE' : 'NÉE LE', child.birthdate ? `${fmtDate(child.birthdate)} · ${ageLabel(child.birthdate)}` : '—', false],
    ['SEXE · GROUPE', `${child.sexe === 'garcon' ? 'Garçon' : 'Fille'} · ${child.groupeSanguin || '?'}`, false],
    ['ALLERGIES', allergies || 'Non renseignées', !!allergies],
  ];
  cells.forEach(([label, value, alert], i) => {
    const cx = M + i * cellW;
    doc.setFillColor(...(alert ? C.dangerBg : C.cellBg));
    doc.rect(cx, y, cellW, cellH, 'F');
    font('bold', 6.5, alert ? C.danger : C.soft);
    doc.text(label, cx + 3, y + 5);
    font(i === 0 || alert ? 'bold' : 'normal', 9.5, alert ? C.danger : C.ink);
    doc.text(fit(value, cellW - 6), cx + 3, y + 10.5);
  });
  doc.setDrawColor(...C.cellBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, RIGHT - M, cellH, 2, 2, 'S');
  y += cellH + 5;

  const contacts = [];
  if (child.medecinNom) contacts.push(`Médecin : ${child.medecinNom}${child.medecinTel ? ' · ' + child.medecinTel : ''}`);
  if (child.contactUrgenceNom) contacts.push(`Urgence : ${child.contactUrgenceNom}${child.contactUrgenceTel ? ' · ' + child.contactUrgenceTel : ''}`);
  if (contacts.length) {
    font('normal', 8.5, C.soft);
    doc.text(fit(contacts.join('    '), RIGHT - M), M, y);
    y += 6;
  }
  y += 2;

  // ── Tableau 7 jours ──
  section('Alimentation, changes et sommeil — 7 jours', 30);
  if (!week.rows.length) {
    font('normal', 9, C.soft);
    doc.text('Aucune saisie sur les 7 derniers jours.', M, y);
    y += 8;
  } else {
    const colTotal = 150;
    font('normal', 8.5, C.soft);
    doc.text('Indicateur', M, y);
    doc.text('Total', colTotal, y, { align: 'right' });
    doc.text('Moyenne / jour', RIGHT, y, { align: 'right' });
    y += 2.2;
    week.rows.forEach(([label, total, avg]) => {
      doc.setDrawColor(...C.rule);
      doc.setLineWidth(0.3);
      doc.line(M, y, RIGHT, y);
      y += 5;
      font('normal', 9, C.ink);
      doc.text(label, M, y);
      doc.text(total, colTotal, y, { align: 'right' });
      font('bold', 9, C.ink);
      doc.text(avg, RIGHT, y, { align: 'right' });
      y += 2.2;
    });
    y += 6;
  }

  // ── Croissance ──
  section('Croissance (courbes OMS)', 40);
  if (!growth.length) {
    font('normal', 9, C.soft);
    doc.text('Aucune mesure enregistrée.', M, y);
    y += 8;
  } else {
    const sparkW = 58;
    const tableRight = RIGHT - sparkW - 6;
    const colLast = M + 66;
    const colEvo = M + 92;
    const top = y;
    font('normal', 8.5, C.soft);
    doc.text('Mesure', M, y);
    doc.text('Dernière', colLast, y, { align: 'right' });
    doc.text('Évolution', colEvo, y, { align: 'right' });
    doc.text('Percentile', tableRight, y, { align: 'right' });
    y += 2.2;
    growth.forEach((g) => {
      doc.setDrawColor(...C.rule);
      doc.setLineWidth(0.3);
      doc.line(M, y, tableRight, y);
      y += 5;
      font('normal', 9, C.ink);
      doc.text(g.label, M, y);
      font('normal', 6.5, C.soft);
      doc.text(g.date, M + 30, y);
      font('bold', 9, C.ink);
      doc.text(g.value, colLast, y, { align: 'right' });
      font('normal', 9, C.ink);
      doc.text(g.evolution, colEvo, y, { align: 'right' });
      if (g.pct != null) {
        const label = `P${g.pct}`;
        const [bg, fg] = pctStyle(g.pct);
        font('bold', 8, fg);
        const bw = doc.getTextWidth(label) + 4;
        doc.setFillColor(...bg);
        doc.roundedRect(tableRight - bw, y - 3.4, bw, 4.6, 2.3, 2.3, 'F');
        doc.text(label, tableRight - 2, y, { align: 'right' });
      } else {
        font('normal', 9, C.soft);
        doc.text('—', tableRight, y, { align: 'right' });
      }
      y += 2.2;
    });
    const tableBottom = y;

    const poids = growth.find((g) => g.key === 'poids');
    if (poids && child.birthdate) {
      const sx = RIGHT - sparkW;
      const drawn = drawWeightSpark(doc, child, poids.list, sx, top - 2, sparkW, 20);
      if (drawn) {
        font('normal', 6.5, C.soft);
        doc.text('Poids · bande P15–P85, pointillé = P50', sx, top + 22);
      }
      y = Math.max(tableBottom, top + 24);
    }
    font('normal', 6.5, C.soft);
    doc.text('Évolution depuis la première mesure saisie. Percentile estimé (standards OMS 0–36 mois).', M, y + 3.5);
    y += 10;
  }

  // ── Vaccinations ──
  section('Vaccinations', 24);
  const done = forChild(store.vaccins, child).filter((v) => v.status !== 'todo')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const shortName = (n) => String(n || '').replace(/\s*\([^)]*\)/g, '');
  if (!done.length) {
    font('normal', 9, C.soft);
    doc.text('Aucune vaccination cochée dans l’appli.', M, y);
    y += 6;
  } else {
    const colW = (RIGHT - M) / 2;
    for (let i = 0; i < done.length; i += 2) {
      ensure(6);
      [done[i], done[i + 1]].forEach((v, j) => {
        if (!v) return;
        const cx = M + j * colW;
        drawCheck(doc, cx, y, C.ok);
        font('normal', 8.5, C.ink);
        doc.text(fit(`${shortName(v.name)} · ${fmtDate(v.date)}`, colW - 7), cx + 4.5, y);
      });
      y += 5;
    }
  }
  if (child.birthdate) {
    const ageM = Math.floor(ageMonthsAt(child.birthdate, now));
    const doneIds = new Set(done.map((v) => v.vaccinId));
    const next = VACCINS_CALENDRIER.filter((v) => !doneIds.has(v.id) && v.ageMonths >= ageM)
      .sort((a, b) => a.ageMonths - b.ageMonths)[0];
    const missing = VACCINS_CALENDRIER.filter((v) => !doneIds.has(v.id) && v.ageMonths < ageM && v.ageMonths > 0).length;
    if (next) {
      ensure(6);
      font('bold', 8.5, C.title);
      doc.text(fit(`À venir : ${shortName(next.nom)} — ${next.age}`, RIGHT - M), M, y + 1);
      y += 5.5;
    }
    if (missing) {
      font('normal', 8, C.soft);
      doc.text(`${missing} vaccin${missing > 1 ? 's' : ''} prévu${missing > 1 ? 's' : ''} avant cet âge non coché${missing > 1 ? 's' : ''} dans l’appli (à vérifier dans le carnet).`, M, y + 1);
      y += 5;
    }
  }
  y += 5;

  // ── Notes médicales ──
  if ((child.notesMedicales || '').trim()) {
    section('Notes médicales', 16);
    font('normal', 9, C.ink);
    doc.splitTextToSize(child.notesMedicales.trim(), RIGHT - M).forEach((line) => {
      ensure(5);
      doc.text(line, M, y);
      y += 4.6;
    });
    y += 5;
  }

  // ── Questions pour la consultation ──
  section('Questions pour la consultation', 34);
  const boxH = 24;
  doc.setDrawColor(...C.dashed);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1], 0);
  doc.roundedRect(M, y - 2, RIGHT - M, boxH, 2, 2, 'S');
  for (let i = 1; i <= 3; i++) doc.line(M + 4, y - 2 + i * 6, RIGHT - 4, y - 2 + i * 6);
  doc.setLineDashPattern([], 0);
  font('normal', 7, C.soft);
  doc.text('À compléter avant le rendez-vous', M + 4, y + boxH - 4);
  y += boxH + 4;

  // ── Pied de page ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.cellBorder);
    doc.setLineWidth(0.3);
    doc.line(M, 284, RIGHT, 284);
    font('normal', 7, C.soft);
    doc.text('Données saisies par les parents dans OmniBaby · ne remplace pas un avis médical', M, 289);
    doc.text(`Page ${i} / ${pages}`, RIGHT, 289, { align: 'right' });
  }

  const safeName = String(child.nom || 'bebe').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const filename = `OmniBaby-resume-${safeName}-${toISODate(now)}.pdf`;
  await sharePdf(doc, filename);
}
