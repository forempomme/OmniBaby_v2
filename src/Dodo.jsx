import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild, ageInMonths, genId, authorFields } from './store.jsx';
import {
  toISODate, toISODateTime, toLocalDT, toTime, formatTimeFR, formatElapsed,
  groupByDay, dayLabel, daysAgo, isToday, useToast,
} from './utils.jsx';
import { Modal } from './Modal.jsx';
import NoChildState from './NoChildState.jsx';
import EntryItem from './journal/EntryItem.jsx';
import { Stamp, useNow } from './journal/TodayOverview.jsx';
import { formatMinutes } from './journal/entryTypes.js';
import { HistoryNotice } from './HistoryNotice.jsx';
import { sleepKindAt } from './sleepNotif.js';

import { Icon, UiIcon } from './icons.jsx';
// ----------------------------------------------------------------------
// Recommandations de sommeil OMS
// ----------------------------------------------------------------------
const SLEEP_RECOS = [
  { maxMonths: 3,        label: '0-3 mois',  total: [14, 17], naps: '4-5 siestes' },
  { maxMonths: 6,        label: '4-6 mois',  total: [12, 15], naps: '3-4 siestes' },
  { maxMonths: 12,       label: '7-12 mois', total: [12, 15], naps: '2-3 siestes' },
  { maxMonths: 24,       label: '1-2 ans',   total: [11, 14], naps: '1-2 siestes' },
  { maxMonths: 36,       label: '2-3 ans',   total: [10, 13], naps: '1 sieste' },
  { maxMonths: Infinity, label: '3 ans et +',total: [10, 13], naps: 'sieste optionnelle' },
];

function getRecoForAge(ageM) {
  if (ageM == null) return SLEEP_RECOS[0];
  return SLEEP_RECOS.find((r) => ageM <= r.maxMonths) || SLEEP_RECOS[SLEEP_RECOS.length - 1];
}

const QUALITES = [
  { key: 'excellent', label: 'Excellent' },
  { key: 'bon',       label: 'Bon' },
  { key: 'agite',     label: 'Agité' },
  { key: 'difficile', label: 'Difficile' },
];

const HUMEURS = ['Calme', 'Souriant', 'Grognon', 'Pleurs'];

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function diffMinutes(start, end) {
  const diff = (new Date(end) - new Date(start)) / 60000;
  return Math.round(diff <= 0 ? diff + 24 * 60 : diff);
}

// ----------------------------------------------------------------------
// Formulaire sommeil — partagé entre Dodo et Journal
// Supporte "sommeil en cours" : début sans fin
// ----------------------------------------------------------------------
export function SommeilForm({ open, onClose, child, editing, onSaved }) {
  const { update, firebaseUser } = useStore();
  const showToast = useToast();

  const [type, setType] = useState('sieste');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [enCours, setEnCours] = useState(false); // sommeil commencé, pas encore terminé
  const [qualite, setQualite] = useState('bon');
  const [humeurReveil, setHumeurReveil] = useState('Calme');
  const [note, setNote] = useState('');

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.sousType || editing.type || 'sieste');
      setDebut(toLocalDT(editing.debut || editing.date));
      setFin(toLocalDT(editing.fin));
      setEnCours(!editing.fin);
      setQualite(editing.qualite || 'bon');
      setHumeurReveil(editing.humeurReveil || 'Calme');
      setNote(editing.note || '');
    } else {
      setType('sieste');
      setDebut(toISODateTime());
      setFin('');
      setEnCours(false);
      setQualite('bon');
      setHumeurReveil('Calme');
      setNote('');
    }
  }, [open, editing]);

  const dureeCalc = fin && !enCours ? diffMinutes(debut, fin) : null;

  const handleSubmit = () => {
    if (!debut) { showToast('Indique une heure de début', '⚠️'); return; }
    if (!enCours && fin && new Date(fin) <= new Date(debut)) {
      showToast('La fin doit être après le début', '⚠️'); return;
    }

    if (!enCours && !fin) { showToast("Indique l'heure de fin ou active « en cours »", '⚠️'); return; }
    // Stockage en ISO UTC (comme le reste du journal)
    const debutISO = new Date(debut).toISOString();
    const finISO = !enCours && fin ? new Date(fin).toISOString() : null;
    const base = editing?.id
      ? { createdBy: editing.createdBy || null, createdByName: editing.createdByName || null, createdAt: editing.createdAt || null, ...authorFields(firebaseUser, 'updated') }
      : authorFields(firebaseUser, 'created');
    const entry = {
      ...base,
      id: editing?.id || genId(),
      childId: editing?.childId || child?.id,
      type: 'sommeil',
      sousType: type,          // 'nuit' | 'sieste'
      date: debutISO,          // heure de début (= date pour le Journal)
      debut: debutISO,
      fin: finISO,
      duree: enCours ? null : dureeCalc,
      enCours,                 // true = sommeil commencé mais pas encore terminé
      qualite,
      humeurReveil: enCours ? null : humeurReveil,
      note: note.trim() || null,
    };

    update((draft) => {
      if (editing?.id) {
        const idx = draft.entries.findIndex((e) => e.id === editing.id);
        if (idx !== -1) draft.entries[idx] = entry;
        else draft.entries.push(entry);
      } else {
        draft.entries.push(entry);
      }
      return draft;
    });

    showToast(
      enCours ? 'Sommeil démarré' : editing?.id ? 'Sommeil enregistré' : 'Sommeil ajouté',
      '✅'
    );
    onSaved && onSaved(entry);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}
      title={editing ? 'Modifier le sommeil' : 'Nouveau sommeil'} icon="🌙">

      {/* Type */}
      <div className="field">
        <label>Type</label>
        <div className="pill-group">
          <button className={`pill-choice ${type==='nuit'?'selected':''}`} onClick={() => setType('nuit')}><UiIcon value="🌃" size={16} className="inline-ic" /> Nuit</button>
          <button className={`pill-choice ${type==='sieste'?'selected':''}`} onClick={() => setType('sieste')}><UiIcon value="☀️" size={16} className="inline-ic" /> Sieste</button>
        </div>
      </div>

      {/* Début */}
      <div className="field">
        <label>Heure de début</label>
        <input type="datetime-local" value={debut} onChange={(e) => setDebut(e.target.value)} />
      </div>

      {/* Sommeil en cours toggle */}
      <div className="flex-between" style={{ padding:'10px 0', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', marginBottom:12 }}>
        <div>
          <div className="set-label">Sommeil en cours</div>
          <div className="muted set-desc">
            L'enfant dort encore — la fin sera saisie au réveil
          </div>
        </div>
        <button className={`switch ${enCours?'on':'off'}`} onClick={() => setEnCours(e => !e)} />
      </div>

      {/* Fin — masquée si en cours */}
      {!enCours && (
        <>
          <div className="field">
            <label>Heure de fin</label>
            <input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} />
          </div>
          {fin && debut && (
            <div className="muted" style={{ fontSize:'.82rem', marginBottom:10, fontWeight:600, color:'var(--primary-deep)' }}>
              Durée : {formatDuration(dureeCalc)}
            </div>
          )}
        </>
      )}

      {/* Qualité — masquée si en cours */}
      {!enCours && (
        <div className="field">
          <label>Qualité</label>
          <div className="pill-group">
            {QUALITES.map((q) => (
              <button key={q.key} className={`pill-choice ${qualite===q.key?'selected':''}`}
                onClick={() => setQualite(q.key)}>{q.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Humeur au réveil — masquée si en cours */}
      {!enCours && (
        <div className="field">
          <label>Humeur au réveil</label>
          <div className="pill-group">
            {HUMEURS.map((h) => (
              <button key={h} className={`pill-choice ${humeurReveil===h?'selected':''}`}
                onClick={() => setHumeurReveil(h)}>{h}</button>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="field">
        <label>Note (optionnel)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Difficultés d'endormissement, bruits..." />
      </div>

      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        {enCours ? <><Icon name="moon" size={16} /> Démarrer le sommeil</> : 'Enregistrer'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Tampons (même style que le Journal) : sommeil en cours / éveillé,
// total du jour, repère pour l'âge
// ----------------------------------------------------------------------
export function sleepToday(entries, now = new Date()) {
  const day = toISODate(now);
  const today = entries.filter((e) => !e.enCours && toISODate(new Date(e.debut || e.date)) === day);
  return {
    minutes: today.reduce((s, e) => s + (Number(e.duree) || 0), 0),
    nuits: today.filter((e) => e.sousType === 'nuit').length,
    siestes: today.filter((e) => e.sousType !== 'nuit').length,
  };
}

function SleepOverview({ entries, child, onWake, onNew, onStart, canEdit, weekAvg }) {
  const now = useNow();
  const reco = getRecoForAge(ageInMonths(child?.birthdate));
  const [recoMin, recoMax] = reco.total;
  const sleeping = entries.find((e) => e.enCours);
  const lastSleep = entries.find((e) => !e.enCours);
  const awakeSince = lastSleep ? (lastSleep.fin || lastSleep.debut || lastSleep.date) : null;
  const t = sleepToday(entries);

  // Comparaison sur la moyenne des 7 derniers jours terminés : en cours
  // de journée, le total du jour est forcément « en dessous »
  let status = null;
  let statusColor;
  if (weekAvg != null) {
    const h = weekAvg / 60;
    if (h < recoMin) { status = 'en dessous'; statusColor = 'var(--accent-sun)'; }
    else if (h > recoMax) { status = 'au-dessus'; statusColor = 'var(--accent-sky)'; }
    else { status = 'dans le repère'; statusColor = 'var(--accent-sage)'; }
  }
  const parts = [];
  if (t.nuits) parts.push(t.nuits > 1 ? `${t.nuits} nuits` : 'nuit');
  if (t.siestes) parts.push(`${t.siestes} sieste${t.siestes > 1 ? 's' : ''}`);

  return (
    <div className="card appear today-card">
      <div className="section-title mb-0">Aujourd'hui</div>
      <div className="stamp-row mt-8">
        {sleeping ? (
          <Stamp
            type="sommeil" label="Dort" live
            value={formatElapsed(now - toTime(sleeping.debut || sleeping.date))}
            since={`depuis ${formatTimeFR(sleeping.debut || sleeping.date)}`}
            detail={canEdit ? 'Réveil ›' : null}
            onClick={() => canEdit && onWake(sleeping)}
            onLongPress={() => canEdit && onWake(sleeping)}
            ariaLabel="Sommeil en cours. Toucher pour noter le réveil."
          />
        ) : (
          <Stamp
            type="sommeil" label={lastSleep ? 'Éveillé' : 'Sommeil'}
            value={awakeSince ? formatElapsed(now - toTime(awakeSince)) : '—'}
            since={awakeSince ? `depuis ${formatTimeFR(awakeSince)}` : 'aucun'}
            detail={canEdit ? 'Endormi ›' : null}
            onClick={() => canEdit && onStart()}
            onLongPress={() => canEdit && onNew()}
            ariaLabel="Toucher pour lancer le chrono de sommeil. Appui long : formulaire."
          />
        )}
        <Stamp
          type="sommeil" icon="clock" label="Aujourd'hui"
          value={t.minutes ? formatMinutes(t.minutes) : '—'}
          since={parts.join(' + ') || 'rien de noté'}
          onClick={() => {}} onLongPress={() => {}}
          ariaLabel="Total de sommeil terminé aujourd'hui"
        />
        <Stamp
          type="sommeil" icon="target" label="Repère"
          value={`${recoMin}–${recoMax} h`}
          since={reco.label}
          detail={status ? `moy. ${formatMinutes(weekAvg)}` : null}
          detailColor={statusColor}
          onClick={() => {}} onLongPress={() => {}}
          ariaLabel={`Repère pour l'âge : ${recoMin} à ${recoMax} heures par jour, ${reco.naps}.${status ? ` Moyenne sur 7 jours ${status}.` : ''}`}
        />
      </div>
      <div className="muted fs-78">
        Repère indicatif {reco.label} : {reco.naps}.{status ? ` Moyenne des 7 derniers jours ${status === 'dans le repère' ? 'dans le repère' : `${status} du repère`}.` : ''} Chaque bébé est différent.
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 7 derniers jours (sommeil rattaché au jour de son début)
// ----------------------------------------------------------------------
export function weeklySleep(entries, now = new Date()) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = toISODate(d);
    const minutes = entries
      .filter((e) => !e.enCours && toISODate(new Date(e.debut || e.date)) === iso)
      .reduce((s, e) => s + (Number(e.duree) || 0), 0);
    days.push({ iso, today: i === 0, label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 1).toUpperCase(), minutes });
  }
  // Moyenne des jours terminés avec au moins un sommeil (aujourd'hui exclu)
  const done = days.filter((d) => !d.today && d.minutes > 0);
  const avg = done.length ? Math.round(done.reduce((s, d) => s + d.minutes, 0) / done.length) : null;
  return { days, avg };
}

function WeeklyChart({ week }) {
  const { days, avg } = week;
  const max = Math.max(16 * 60, ...days.map((d) => d.minutes));
  return (
    <div className="card appear">
      <div className="flex-between" style={{ alignItems: 'baseline', marginBottom: 10 }}>
        <div className="section-title mb-0">7 derniers jours</div>
        {avg != null && <span className="muted fs-78">moyenne {formatMinutes(avg)}</span>}
      </div>
      <div className="sleep-bars">
        {days.map((d) => (
          <div key={d.iso} className="sleep-col">
            <div className={`sleep-bar ${d.today ? 'today' : ''} ${d.minutes ? '' : 'empty'}`}
              style={{ height: `${Math.max(4, (d.minutes / max) * 80)}px` }}
              title={d.minutes ? formatMinutes(d.minutes) : 'rien'} />
            <span>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main DodoTab
// ----------------------------------------------------------------------
export default function DodoTab({ openFormExternal, setOpenFormExternal }) {
  const { store, update, session, firebaseUser } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [period, setPeriod] = useState('today');

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  // FAB externe depuis App.jsx
  React.useEffect(() => {
    if (openFormExternal) {
      setEditing(null); setFormOpen(true);
      setOpenFormExternal && setOpenFormExternal(false);
    }
  }, [openFormExternal]);

  // Lire les sommeils depuis store.entries (type === 'sommeil')
  const childSleeps = useMemo(() =>
    filterByActiveChild(store.entries || [], store.activeChildId)
      .filter((e) => e.type === 'sommeil')
      .sort((a, b) => toTime(b.debut || b.date) - toTime(a.debut || a.date)),
    [store.entries, store.activeChildId]
  );

  const periodFiltered = useMemo(() => {
    if (period === 'today') return childSleeps.filter((s) => isToday(s.debut || s.date));
    if (period === '7days') {
      const cutoff = daysAgo(7);
      return childSleeps.filter((s) => toTime(s.debut || s.date) >= cutoff.getTime());
    }
    return childSleeps;
  }, [childSleeps, period]);

  // Normaliser le champ date pour groupByDay (qui attend item[dateField])
  const normalizedPeriod = useMemo(() =>
    periodFiltered.map(e => ({ ...e, _groupDate: e.debut || e.date })),
    [periodFiltered]
  );
  const grouped = useMemo(() =>
    groupByDay(normalizedPeriod, '_groupDate'),
    [normalizedPeriod]
  );

  const week = useMemo(() => weeklySleep(childSleeps), [childSleeps]);

  const handleDelete = (id) => {
    update((draft) => { draft.entries = draft.entries.filter((e) => e.id !== id); return draft; });
    showToast('Sommeil supprimé', '🗑️');
  };

  // Réveil : formulaire pré-rempli avec fin = maintenant
  const wake = (entry) => {
    setEditing({ ...entry, fin: toISODateTime(), enCours: false });
    setFormOpen(true);
  };
  const openNew = () => { setEditing(null); setFormOpen(true); };

  // « Endormi » : sommeil en cours lancé en 1 tap (nuit entre 19 h et 7 h),
  // avec notification chrono + « Réveil » (voir sleepNotif.js)
  const startSleep = () => {
    const nowD = new Date();
    const iso = nowD.toISOString();
    const entry = {
      id: genId(), childId: activeChild.id, type: 'sommeil', sousType: sleepKindAt(nowD),
      date: iso, debut: iso, fin: null, duree: null, enCours: true,
      ...authorFields(firebaseUser, 'created'),
    };
    update((draft) => { draft.entries.push(entry); return draft; });
    showToast(`${entry.sousType === 'nuit' ? 'Nuit' : 'Sieste'} démarrée`, '🌙', {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => update((draft) => { draft.entries = draft.entries.filter((e) => e.id !== entry.id); return draft; }),
      },
    });
  };

  if (!activeChild) return <NoChildState />;

  return (
    <div>
      <SleepOverview entries={childSleeps} child={activeChild} onWake={wake} onNew={openNew} onStart={startSleep} canEdit={canEdit} weekAvg={week.avg} />
      <WeeklyChart week={week} />

      <div className="period-bar">
        <div className="period-chips">
          {[['today', "Aujourd'hui"], ['7days', '7 jours'], ['all', 'Tout']].map(([k, l]) => (
            <button key={k} className={`chip ${period === k ? 'active' : ''}`} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="title">Rien à afficher</div>
          <div className="desc">Aucun sommeil sur cette période. Touche le bouton + pour en noter un.</div>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day}>
            <div className="day-group-label">
              <span>{dayLabel(day)}</span>
              <span className="day-count">{items.length} sommeil{items.length > 1 ? 's' : ''}</span>
            </div>
            <div className="entry-list">
              {items.map((s) => (
                <EntryItem
                  key={s.id}
                  entry={s}
                  onEdit={() => canEdit && (s.enCours ? wake(s) : (setEditing(s), setFormOpen(true)))}
                  onDelete={() => canEdit && handleDelete(s.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {period === 'all' && <HistoryNotice variant="card" />}

      <SommeilForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        child={activeChild}
        editing={editing}
      />
    </div>
  );
}

