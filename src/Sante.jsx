import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild, ageInMonths, authorFields } from './store.jsx';
import {
  toISODate,
  formatDateFR,
  SwipeToDelete,
  useToast,
  Accordion,
  fireConfetti,
  exportPDF,
  scheduleNotif,
  requestNotifPermission,
} from './utils.jsx';
import { Modal } from './Modal.jsx';
import NoChildState from './NoChildState.jsx';
import { Icon } from './icons.jsx';
import {
  WEIGHT_LMS,
  HEIGHT_LMS,
  HEAD_LMS,
  PERCENTILE_Z,
  getLMS,
  lmsValue,
  estimatePercentile,
  VACCINS_CALENDRIER,
} from './data/who-growth.js';

// ----------------------------------------------------------------------
// Mesure type definitions
// ----------------------------------------------------------------------
const MESURE_TYPES = {
  poids: { label: 'Poids', icon: '⚖️', unit: 'kg', step: 0.01, table: WEIGHT_LMS, color: '#C96F4A' },
  taille: { label: 'Taille', icon: '📏', unit: 'cm', step: 0.1, table: HEIGHT_LMS, color: '#7C9885' },
  perimetre: { label: 'Périmètre crânien', icon: '🧠', unit: 'cm', step: 0.1, table: HEAD_LMS, color: '#6E97A8' },
};

// ----------------------------------------------------------------------
// Vitamin D card
// ----------------------------------------------------------------------
function VitaminDCard({ child, canEdit }) {
  const { update } = useStore();
  const showToast = useToast();
  const ageM = ageInMonths(child.birthdate);

  if (ageM != null && ageM >= 24) return null;

  const lastDate = child.lastVitDDate;
  const today = toISODate();
  const givenToday = lastDate === today;

  let statusText, statusColor;
  if (!lastDate) {
    statusText = 'Aucune prise enregistrée';
    statusColor = 'var(--text-soft)';
  } else if (givenToday) {
    statusText = "Donnée aujourd'hui ✓";
    statusColor = 'var(--accent-sage)';
  } else {
    const days = Math.floor((new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
    statusText = `Dernière prise il y a ${days} jour${days > 1 ? 's' : ''}`;
    statusColor = days > 2 ? 'var(--danger)' : 'var(--text-soft)';
  }

  const handleManualGive = () => {
    update((draft) => {
      const c = draft.children.find((c) => c.id === child.id);
      if (c) c.lastVitDDate = today;
      return draft;
    });
    showToast('Vitamine D enregistrée', '💊');
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 4 }}>Vitamine D</div>
      <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
        Recommandée jusqu'à 24 mois (OMS / Santé publique France).
      </div>
      <div className="flex-between">
        <span style={{ color: statusColor, fontWeight: 600, fontSize: '0.88rem' }}>{statusText}</span>
        {canEdit && !givenToday && (
          <button className="btn btn-secondary btn-sm" onClick={handleManualGive}>
            Donnée aujourd'hui
          </button>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Feeding type advice card
// ----------------------------------------------------------------------
function FeedingAdviceCard({ child }) {
  const ageM = ageInMonths(child.birthdate);
  if (ageM == null) return null;

  let advice = '';
  if (child.alimentation === 'allaitement') {
    if (ageM < 6) advice = "Allaitement exclusif recommandé jusqu'à 6 mois, avec poursuite possible au-delà en complément de la diversification.";
    else advice = "Allaitement en complément de la diversification alimentaire, aussi longtemps que souhaité par la mère et l'enfant.";
  } else if (child.alimentation === 'mixte') {
    advice = "Alimentation mixte (lait maternel + lait infantile) : poursuivre selon les besoins, en adaptant le type de lait à l'âge.";
  } else {
    if (ageM < 6) advice = "Lait infantile 1er âge recommandé jusqu'à 6 mois.";
    else if (ageM < 12) advice = 'Transition vers le lait 2e âge (suite) recommandée entre 6 et 12 mois.';
    else if (ageM < 36) advice = "Lait de croissance recommandé entre 1 et 3 ans, en complément d'une alimentation diversifiée.";
    else advice = 'Lait de vache entier ou produits laitiers adaptés peuvent être introduits.';
  }

  const typeLaitLabels = { maternel: 'Lait maternel', '1er_age': 'Lait 1er âge', '2e_age': 'Lait 2e âge', croissance: 'Lait de croissance' };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 4 }}>Alimentation</div>
      <div className="flex-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <span className="chip active" style={{ cursor: 'default' }}>
          {child.alimentation === 'allaitement' ? 'Allaitement' : child.alimentation === 'mixte' ? 'Mixte' : 'Lait infantile'}
        </span>
        {child.typeLait && (
          <span className="chip" style={{ cursor: 'default' }}>{typeLaitLabels[child.typeLait] || child.typeLait}</span>
        )}
      </div>
      <div className="muted mt-8" style={{ fontSize: '0.85rem' }}>{advice}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Add measure modal
// ----------------------------------------------------------------------
function MesureForm({ open, onClose, type, child }) {
  const { update, nextId, firebaseUser } = useStore();
  const showToast = useToast();
  const def = MESURE_TYPES[type];
  const [date, setDate] = useState(toISODate());
  const [valeur, setValeur] = useState('');

  React.useEffect(() => {
    if (open) {
      setDate(toISODate());
      setValeur('');
    }
  }, [open, type]);

  const handleSubmit = () => {
    const v = parseFloat(String(valeur).replace(',', '.'));
    if (!v || v <= 0) {
      showToast('Entre une valeur valide', '⚠️');
      return;
    }
    const id = nextId();
    update((draft) => {
      draft.mesures.push({ id, childId: child.id, type, date, valeur: v, ...authorFields(firebaseUser, 'created') });
      return draft;
    });
    showToast('Mesure enregistrée', '✅');
    onClose();
  };

  if (!def) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Nouvelle mesure — ${def.label}`} icon={def.icon}>
      <div className="field">
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>{def.label} ({def.unit})</label>
        <input
          type="number"
          inputMode="decimal"
          step={def.step}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder={type === 'poids' ? '5.4' : type === 'taille' ? '58.5' : '40.2'}
        />
      </div>
      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>Enregistrer ✓</button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// WHO growth chart (SVG)
// ----------------------------------------------------------------------
function ageInDaysAt(birthdate, date) {
  if (!birthdate) return 0;
  const b = new Date(birthdate);
  const d = new Date(date);
  return Math.max(0, Math.floor((d - b) / (1000 * 60 * 60 * 24)));
}

function GrowthChart({ type, child, mesures }) {
  const def = MESURE_TYPES[type];
  const sexe = child.sexe === 'garcon' ? 'garcon' : 'fille';

  const W = 320;
  const H = 200;
  const PAD_L = 36;
  const PAD_R = 10;
  const PAD_T = 14;
  const PAD_B = 24;
  const maxAge = 36;

  const childPoints = useMemo(() => {
    return mesures
      .filter((m) => m.type === type)
      .map((m) => ({ ageM: ageInDaysAt(child.birthdate, m.date) / 30.4375, valeur: m.valeur, date: m.date }))
      .filter((p) => p.ageM >= 0 && p.ageM <= maxAge)
      .sort((a, b) => a.ageM - b.ageM);
  }, [mesures, type, child.birthdate]);

  // Y range based on percentile curves across full age range + child data
  const { yMin, yMax } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (let m = 0; m <= maxAge; m++) {
      const lms = getLMS(def.table, sexe, m);
      const v3 = lmsValue(lms, PERCENTILE_Z.p3);
      const v97 = lmsValue(lms, PERCENTILE_Z.p97);
      if (v3 < min) min = v3;
      if (v97 > max) max = v97;
    }
    for (const p of childPoints) {
      if (p.valeur < min) min = p.valeur;
      if (p.valeur > max) max = p.valeur;
    }
    const margin = (max - min) * 0.08;
    return { yMin: Math.max(0, min - margin), yMax: max + margin };
  }, [def, sexe, childPoints]);

  const xScale = (ageM) => PAD_L + (ageM / maxAge) * (W - PAD_L - PAD_R);
  const yScale = (val) => H - PAD_B - ((val - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const percentileKeys = ['p3', 'p15', 'p50', 'p85', 'p97'];
  const curves = useMemo(() => {
    const result = {};
    for (const pk of percentileKeys) {
      const pts = [];
      for (let m = 0; m <= maxAge; m++) {
        const lms = getLMS(def.table, sexe, m);
        pts.push([xScale(m), yScale(lmsValue(lms, PERCENTILE_Z[pk]))]);
      }
      result[pk] = pts.map((p) => p.join(',')).join(' ');
    }
    return result;
  }, [def, sexe, yMin, yMax]);

  const childPath = childPoints.map((p) => `${xScale(p.ageM)},${yScale(p.valeur)}`).join(' ');

  const lastPoint = childPoints[childPoints.length - 1];
  const percentile = lastPoint ? estimatePercentile(def.table, sexe, lastPoint.ageM, lastPoint.valeur) : null;

  const xTicks = [0, 6, 12, 18, 24, 30, 36];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <polyline points={curves.p97} fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3" />
        <polyline points={curves.p85} fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="2,2" />
        <polyline points={curves.p50} fill="none" stroke={def.color} strokeWidth="1.5" opacity="0.5" />
        <polyline points={curves.p15} fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="2,2" />
        <polyline points={curves.p3} fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3" />

        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--text-faint)" strokeWidth="1" />
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="var(--text-faint)" strokeWidth="1" />
        {xTicks.map((t) => (
          <text key={t} x={xScale(t)} y={H - 6} fontSize="8" fill="var(--text-faint)" textAnchor="middle">{t}m</text>
        ))}
        <text x={2} y={yScale(yMax)} fontSize="8" fill="var(--text-faint)">{yMax.toFixed(1)}</text>
        <text x={2} y={yScale(yMin) + 4} fontSize="8" fill="var(--text-faint)">{yMin.toFixed(1)}</text>

        {childPoints.length > 0 && (
          <polyline points={childPath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {childPoints.map((p, i) => (
          <circle key={i} cx={xScale(p.ageM)} cy={yScale(p.valeur)} r="3" fill="var(--primary)" />
        ))}
      </svg>
      <div className="flex-between mt-8" style={{ fontSize: '0.78rem' }}>
        <span className="muted">Courbes OMS — percentiles 3/15/50/85/97</span>
        {percentile != null && (
          <span style={{ fontWeight: 700, color: 'var(--primary-deep)' }}>≈ {percentile}e percentile</span>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Measure section: chart + history list
// ----------------------------------------------------------------------
function MesureSection({ type, child, mesures, canEdit }) {
  const { update } = useStore();
  const showToast = useToast();
  const def = MESURE_TYPES[type];
  const [formOpen, setFormOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const typeMesures = useMemo(
    () => mesures.filter((m) => m.type === type).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [mesures, type]
  );

  const handleDelete = (id) => {
    update((draft) => {
      draft.mesures = draft.mesures.filter((m) => m.id !== id);
      return draft;
    });
    showToast('Mesure supprimée', '🗑️');
  };

  return (
    <div>
      {canEdit && (
        <div className="flex-between">
          <span className="muted" style={{ fontSize: '.8rem' }}>
            {typeMesures[0] ? `Dernière : ${typeMesures[0].valeur} ${def.unit} le ${formatDateFR(typeMesures[0].date)}` : ''}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setFormOpen(true)}>＋ Ajouter</button>
        </div>
      )}

      {typeMesures.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <div className="desc">Aucune mesure enregistrée. Ajoute la première pour voir la courbe.</div>
        </div>
      ) : (
        <>
          <div className="mt-16">
            <GrowthChart type={type} child={child} mesures={mesures} />
          </div>
          <button className="btn btn-ghost btn-sm mt-8" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? "▲ Masquer l'historique" : `▼ Historique (${typeMesures.length})`}
          </button>
          {showHistory && (
            <div className="entry-list mt-8">
              {typeMesures.map((m) => (
                <SwipeToDelete key={m.id} onDelete={() => canEdit && handleDelete(m.id)} disabled={!canEdit}>
                  <div className="entry-body">
                    <div className="entry-title">{m.valeur} {def.unit}</div>
                    <div className="entry-sub">{formatDateFR(m.date)}</div>
                  </div>
                </SwipeToDelete>
              ))}
            </div>
          )}
        </>
      )}

      <MesureForm open={formOpen} onClose={() => setFormOpen(false)} type={type} child={child} />
    </div>
  );
}

// ----------------------------------------------------------------------
// Vaccination record
// ----------------------------------------------------------------------
function VaccinSection({ child, vaccins, canEdit }) {
  const { store, update, nextId } = useStore();
  const showToast = useToast();
  const [showAll, setShowAll] = useState(false);
  const notifsOn = store.settings?.notifs?.vaccin !== false;
  const ageM = ageInMonths(child.birthdate) ?? 0;

  const statusFor = (vaccinId) => vaccins.find((v) => v.vaccinId === vaccinId);

  // Rappel 7 jours avant le prochain vaccin du calendrier
  const scheduleNextVaccin = async (child, vaccins) => {
    if (!child?.birthdate) return;
    const granted = await requestNotifPermission();
    if (!granted) return;
    const ageNow = ageInMonths(child.birthdate) ?? 0;
    const doneIds = new Set(vaccins.filter(v => v.status === 'done').map(v => v.vaccinId));
    const next = VACCINS_CALENDRIER
      .filter(v => !doneIds.has(v.id) && v.ageMonths > ageNow)
      .sort((a, b) => a.ageMonths - b.ageMonths)[0];
    if (!next) return;
    // Calculer la date du prochain vaccin
    const birthDate = new Date(child.birthdate);
    const notifDate = new Date(birthDate);
    notifDate.setMonth(notifDate.getMonth() + next.ageMonths);
    // Notifier 7 jours avant
    notifDate.setDate(notifDate.getDate() - 7);
    if (notifDate > new Date()) {
      await scheduleNotif({
        id: `vaccin_next_${child.id}`,
        title: `Vaccin à prévoir — ${child.nom}`,
        body: `${next.nom} prévu vers ${next.age}. Pensez à prendre rendez-vous.`,
        at: notifDate.toISOString(),
      });
    }
  };

  const toggleDone = (vaccinDef) => {
    const existing = statusFor(vaccinDef.id);
    const record = existing ? null : {
      id: nextId(),
      childId: child.id,
      vaccinId: vaccinDef.id,
      name: vaccinDef.nom,
      status: 'done',
      date: toISODate(),
    };
    update((draft) => {
      if (existing) draft.vaccins = draft.vaccins.filter((v) => v.id !== existing.id);
      else draft.vaccins.push(record);
      return draft;
    });
    if (!existing) {
      fireConfetti();
      if (notifsOn) scheduleNextVaccin(child, vaccins.concat(record));
    }
    showToast(existing ? 'Marqué non fait' : 'Vaccin enregistré', existing ? '↩️' : '💉');
  };

  const visibleVaccins = showAll
    ? VACCINS_CALENDRIER
    : VACCINS_CALENDRIER.filter((v) => statusFor(v.id) || v.ageMonths <= ageM + 2);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Recommandés' : 'Tout afficher'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 10 }}>
        Calendrier vaccinal France 2024 — à confirmer avec le pédiatre.
      </div>
      <div className="entry-list">
        {visibleVaccins.map((v) => {
          const done = statusFor(v.id);
          return (
            <div key={v.id} className="swipe-content" style={{ cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && toggleDone(v)}>
              <div className="entry-icon" style={{ background: done ? 'var(--accent-sage-soft)' : 'var(--surface-2)', color: done ? 'var(--accent-sage)' : 'var(--text-faint)' }}>
                <Icon name={done ? 'check' : 'plus'} size={done ? 20 : 18} />
              </div>
              <div className="entry-body">
                <div className="entry-title" style={{ fontSize: '0.85rem' }}>{v.nom}</div>
                <div className="entry-sub">{v.age}{done ? ` · fait le ${formatDateFR(done.date)}` : ''}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Santé tab
// ----------------------------------------------------------------------
export default function SanteTab() {
  const { store, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const childMesures = useMemo(
    () => filterByActiveChild(store.mesures, store.activeChildId),
    [store.mesures, store.activeChildId]
  );
  const childVaccins = useMemo(
    () => filterByActiveChild(store.vaccins, store.activeChildId),
    [store.vaccins, store.activeChildId]
  );

  if (!activeChild) return <NoChildState />;

  const count = (type) => childMesures.filter((m) => m.type === type).length || null;
  const ageM = ageInMonths(activeChild.birthdate);

  const handlePDF = async () => {
    try { await exportPDF(store, activeChild); }
    catch (e) { showToast('Erreur PDF : ' + e.message, '⚠️'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={handlePDF}>Résumé PDF pour le pédiatre</button>
      </div>
      <Accordion icon="💊" title={ageM != null && ageM >= 24 ? 'Alimentation' : 'Vitamine D & alimentation'} defaultOpen stateKey="sante.vitd">
        <VitaminDCard child={activeChild} canEdit={canEdit} />
        <FeedingAdviceCard child={activeChild} />
      </Accordion>
      <Accordion icon="⚖️" title="Poids" badge={count('poids')} defaultOpen stateKey="sante.poids">
        <MesureSection type="poids" child={activeChild} mesures={childMesures} canEdit={canEdit} />
      </Accordion>
      <Accordion icon="📏" title="Taille" badge={count('taille')} stateKey="sante.taille">
        <MesureSection type="taille" child={activeChild} mesures={childMesures} canEdit={canEdit} />
      </Accordion>
      <Accordion icon="🧠" title="Périmètre crânien" badge={count('perimetre')} stateKey="sante.perimetre">
        <MesureSection type="perimetre" child={activeChild} mesures={childMesures} canEdit={canEdit} />
      </Accordion>
      <Accordion icon="💉" title="Carnet de vaccination" badge={childVaccins.length || null}
        badgeColor="var(--accent-sage)" stateKey="sante.vaccins">
        <VaccinSection child={activeChild} vaccins={childVaccins} canEdit={canEdit} />
      </Accordion>
    </div>
  );
}
