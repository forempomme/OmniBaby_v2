import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild, ageInMonths, genId } from './store.jsx';
import {
  toISODate, toISODateTime, formatTimeFR, formatDateFR,
  groupByDay, dayLabel, daysAgo, isToday, useToast,
} from './utils.jsx';
import { Modal } from './Modal.jsx';

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
  { key: 'excellent', label: 'Excellent', icon: '😴' },
  { key: 'bon',       label: 'Bon',       icon: '🙂' },
  { key: 'agite',     label: 'Agité',     icon: '😣' },
  { key: 'difficile', label: 'Difficile', icon: '😢' },
];

const HUMEURS = ['Calme', 'Souriant', 'Grognon', 'Pleurs'];

export function formatDuration(minutes) {
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

function toLocalDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ----------------------------------------------------------------------
// Formulaire sommeil — partagé entre Dodo et Journal
// Supporte "sommeil en cours" : début sans fin
// ----------------------------------------------------------------------
export function SommeilForm({ open, onClose, child, editing, onSaved }) {
  const { update, store } = useStore();
  const showToast = useToast();
  const firebaseUser = store.users ? undefined : undefined; // sera lu via useStore

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
      setDebut(toLocalDT(new Date().toISOString()));
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

    const entry = {
      id: editing?.id || genId(),
      childId: child?.id,
      type: 'sommeil',
      sousType: type,          // 'nuit' | 'sieste'
      date: debut,             // heure de début (= date pour le Journal)
      debut,
      fin: enCours ? null : (fin || null),
      duree: enCours ? null : dureeCalc,
      enCours,                 // true = sommeil commencé mais pas encore terminé
      qualite,
      humeurReveil: enCours ? null : humeurReveil,
      note: note.trim() || null,
      createdAt: editing ? (editing.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    update((draft) => {
      if (editing) {
        const idx = draft.entries.findIndex((e) => e.id === editing.id);
        if (idx !== -1) draft.entries[idx] = entry;
        else draft.entries.push(entry);
      } else {
        draft.entries.push(entry);
      }
      return draft;
    });

    showToast(
      enCours ? 'Sommeil démarré 🌙' : editing ? 'Sommeil modifié' : 'Sommeil enregistré',
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
          <button className={`pill-choice ${type==='nuit'?'selected':''}`} onClick={() => setType('nuit')}>🌃 Nuit</button>
          <button className={`pill-choice ${type==='sieste'?'selected':''}`} onClick={() => setType('sieste')}>☀️ Sieste</button>
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
          <div style={{ fontWeight:600, fontSize:'.86rem' }}>Sommeil en cours</div>
          <div className="muted" style={{ fontSize:'.72rem', marginTop:2 }}>
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
                onClick={() => setQualite(q.key)}>{q.icon} {q.label}</button>
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
        {enCours ? '🌙 Démarrer le sommeil' : editing ? 'Enregistrer ✓' : 'Enregistrer ✓'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Résumé du jour
// ----------------------------------------------------------------------
function TodaySummaryCard({ entries, child }) {
  const ageM = ageInMonths(child?.birthdate);
  const reco = getRecoForAge(ageM);

  const todaySleeps = entries.filter((e) => isToday(e.debut || e.date));
  const totalMin = todaySleeps.reduce((s, e) => s + (e.duree || 0), 0);
  const nuits = todaySleeps.filter((e) => e.sousType === 'nuit').length;
  const siestes = todaySleeps.filter((e) => e.sousType !== 'nuit').length;
  const enCours = entries.find((e) => e.enCours);

  const totalH = totalMin / 60;
  const [recoMin, recoMax] = reco.total;
  let statusColor = 'var(--text-soft)', statusLabel = '—';
  if (totalMin > 0) {
    if (totalH < recoMin) { statusColor = 'var(--accent-sun)'; statusLabel = 'En dessous des repères'; }
    else if (totalH > recoMax) { statusColor = 'var(--accent-sky)'; statusLabel = 'Au-dessus des repères'; }
    else { statusColor = 'var(--accent-sage)'; statusLabel = 'Dans les repères'; }
  }

  return (
    <div className="card appear">
      <div className="section-title" style={{ marginBottom: 6 }}>🌙 Aujourd'hui</div>

      {/* Badge sommeil en cours */}
      {enCours && (
        <div style={{
          display:'flex', alignItems:'center', gap:8, marginBottom:10,
          background:'var(--accent-sky-soft)', borderRadius:'var(--radius-md)',
          padding:'8px 12px', border:'1px solid var(--accent-sky)',
        }}>
          <span style={{ fontSize:'1rem', animation:'pulse 2s infinite' }}>🌙</span>
          <div>
            <div style={{ fontWeight:700, fontSize:'.82rem', color:'var(--accent-sky)' }}>Sommeil en cours</div>
            <div style={{ fontSize:'.72rem', color:'var(--text-soft)' }}>
              Depuis {formatTimeFR(enCours.debut || enCours.date)}
              {' · '}
              {formatDuration(Math.floor((new Date() - new Date(enCours.debut || enCours.date)) / 60000))} écoulées
            </div>
          </div>
        </div>
      )}

      <div className="stamp-row">
        <div className="stamp" style={{ cursor:'default' }}>
          <span className="stamp-icon">⏱️</span>
          <span className="stamp-value">{formatDuration(totalMin)}</span>
          <span className="stamp-label">Total</span>
        </div>
        <div className="stamp" style={{ cursor:'default' }}>
          <span className="stamp-icon">🌃</span>
          <span className="stamp-value">{nuits}</span>
          <span className="stamp-label">Nuit(s)</span>
        </div>
        <div className="stamp" style={{ cursor:'default' }}>
          <span className="stamp-icon">☀️</span>
          <span className="stamp-value">{siestes}</span>
          <span className="stamp-label">Sieste(s)</span>
        </div>
      </div>
      <div className="flex-between mt-8" style={{ fontSize:'.82rem' }}>
        <span className="muted">Repère {reco.label} : {recoMin}-{recoMax} h/j, {reco.naps}</span>
        {totalMin > 0 && <span style={{ color:statusColor, fontWeight:700 }}>{statusLabel}</span>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Graphique 7 jours
// ----------------------------------------------------------------------
function WeeklyChart({ entries }) {
  const days = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const iso = toISODate(d);
      const total = entries
        .filter((e) => toISODate(new Date(e.debut || e.date)) === iso)
        .reduce((s, e) => s + (e.duree || 0), 0);
      result.push({
        iso,
        label: d.toLocaleDateString('fr-FR', { weekday:'short' }).slice(0,1).toUpperCase(),
        hours: total / 60,
      });
    }
    return result;
  }, [entries]);

  const maxHours = Math.max(16, ...days.map((d) => d.hours));

  return (
    <div className="card appear">
      <div className="section-title" style={{ marginBottom:10 }}>📊 7 derniers jours</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:100 }}>
        {days.map((d) => (
          <div key={d.iso} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div style={{
              width:'100%', maxWidth:28,
              background: d.hours > 0 ? 'var(--accent-sky)' : 'var(--border)',
              borderRadius:6,
              height:`${Math.max(4, (d.hours / maxHours) * 80)}px`,
            }} title={`${d.hours.toFixed(1)} h`} />
            <span style={{ fontSize:'.68rem', color:'var(--text-soft)', fontWeight:600 }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Item sommeil dans la liste
// ----------------------------------------------------------------------
function SommeilItem({ entry, onEdit, onDelete, onTerminer }) {
  const [confirmDel, setConfirmDel] = React.useState(false);
  const qualDef = QUALITES.find((q) => q.key === entry.qualite) || QUALITES[1];
  const typeIcon = entry.sousType === 'nuit' ? '🌃' : '☀️';
  const typeLabel = entry.sousType === 'nuit' ? 'Nuit' : 'Sieste';

  if (confirmDel) {
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'9px 12px',
        background:'var(--danger-soft)', border:'1.5px solid var(--danger)',
        borderRadius:'var(--radius-md)', marginBottom:6,
      }}>
        <span style={{ flex:1, fontSize:'.82rem', color:'var(--danger)', fontWeight:600 }}>
          Supprimer ce sommeil ?
        </span>
        <button onPointerDown={() => setConfirmDel(false)} style={{ padding:'4px 10px', borderRadius:'var(--radius-pill)', border:'1px solid var(--border)', background:'var(--surface)', fontWeight:600, fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
        <button onPointerDown={onDelete} style={{ padding:'4px 10px', borderRadius:'var(--radius-pill)', border:'none', background:'var(--danger)', color:'#fff', fontWeight:700, fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit' }}>Confirmer</button>
      </div>
    );
  }

  return (
    <div style={{
      position:'relative', borderRadius:'var(--radius-md)', marginBottom:6, userSelect:'none',
    }}>
      {/* Zone corbeille */}
      <div style={{
        position:'absolute', top:0, right:0, bottom:0, width:72,
        background:'var(--danger)', borderRadius:'var(--radius-md)',
        display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
      }}>
        <button onPointerDown={() => setConfirmDel(true)} style={{
          width:'100%', height:'100%', background:'none', border:'none',
          color:'#fff', cursor:'pointer', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:3,
        }}>
          <span style={{ fontSize:'1.1rem' }}>🗑️</span>
          <span style={{ fontSize:'.58rem', fontWeight:700 }}>Suppr.</span>
        </button>
      </div>

      {/* Contenu */}
      <SommeilItemContent
        entry={entry} qualDef={qualDef} typeIcon={typeIcon} typeLabel={typeLabel}
        onEdit={onEdit} onTerminer={onTerminer}
      />
    </div>
  );
}

function SommeilItemContent({ entry, qualDef, typeIcon, typeLabel, onEdit, onTerminer }) {
  const [offsetX, setOffsetX] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const startX = React.useRef(null);
  const isDragging = React.useRef(false);
  const ACTION_W = 72;

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; isDragging.current = false; };
  const onTouchMove = (e) => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx > 8) { if (revealed) { setRevealed(false); setOffsetX(0); } return; }
    if (dx < -5) { isDragging.current = true; e.preventDefault(); setOffsetX(Math.max(-ACTION_W, dx)); }
  };
  const onTouchEnd = () => {
    if (revealed) return;
    isDragging.current = false;
    startX.current = null;
    if (offsetX < -36) { setRevealed(true); setOffsetX(-ACTION_W); }
    else { setOffsetX(0); }
  };

  return (
    <div
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onClick={() => revealed ? (setRevealed(false), setOffsetX(0)) : onEdit()}
      style={{
        transform:`translateX(${offsetX}px)`,
        transition: isDragging.current ? 'none' : 'transform .18s ease',
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-md)', padding:'10px 12px',
        display:'flex', alignItems:'center', gap:11,
        position:'relative', zIndex:1, cursor:'pointer', willChange:'transform',
      }}
    >
      <div className="entry-icon" style={{ background:'var(--accent-sky-soft)', color:'var(--accent-sky)', fontSize:'1.1rem' }}>
        {typeIcon}
      </div>
      <div className="entry-body" style={{ flex:1, minWidth:0 }}>
        <div className="entry-title" style={{ display:'flex', alignItems:'center', gap:6 }}>
          {typeLabel}
          {entry.duree && <span style={{ color:'var(--accent-sky)', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.8rem' }}>{formatDuration(entry.duree)}</span>}
          {entry.enCours && (
            <span style={{ fontSize:'.65rem', background:'var(--accent-sky-soft)', color:'var(--accent-sky)', padding:'1px 6px', borderRadius:'var(--radius-pill)', fontWeight:700 }}>
              En cours
            </span>
          )}
        </div>
        <div className="entry-sub">
          {entry.enCours
            ? `Depuis ${formatTimeFR(entry.debut || entry.date)}`
            : `${qualDef.icon} ${qualDef.label}${entry.humeurReveil ? ` · Réveil : ${entry.humeurReveil}` : ''}`}
          {entry.note && <span> · {entry.note}</span>}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div className="entry-time">{formatTimeFR(entry.debut || entry.date)}</div>
        {entry.fin && !entry.enCours && (
          <div style={{ fontSize:'.65rem', color:'var(--text-faint)' }}>→ {formatTimeFR(entry.fin)}</div>
        )}
        {/* Bouton "Terminer" si en cours */}
        {entry.enCours && onTerminer && (
          <button
            onPointerDown={(e) => { e.stopPropagation(); onTerminer(entry); }}
            style={{
              marginTop:4, padding:'3px 8px', borderRadius:'var(--radius-pill)',
              background:'var(--accent-sage)', color:'#fff', border:'none',
              fontSize:'.65rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit',
            }}
          >
            ☀️ Terminer
          </button>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main DodoTab
// ----------------------------------------------------------------------
export default function DodoTab({ openFormExternal, setOpenFormExternal }) {
  const { store, update, session } = useStore();
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
      .sort((a, b) => ((a.debut||a.date) < (b.debut||b.date) ? 1 : -1)),
    [store.entries, store.activeChildId]
  );

  const periodFiltered = useMemo(() => {
    if (period === 'today') return childSleeps.filter((s) => isToday(s.debut || s.date));
    if (period === '7days') {
      const cutoff = daysAgo(7);
      return childSleeps.filter((s) => new Date(s.debut || s.date) >= cutoff);
    }
    return childSleeps;
  }, [childSleeps, period]);

  // Normaliser le champ date pour groupByDay (qui attend item[dateField])
  const normalizedPeriod = useMemo(() =>
    periodFiltered.map(e => ({ ...e, _groupDate: (e.debut || e.date || '').slice(0, 10) })),
    [periodFiltered]
  );
  const grouped = useMemo(() =>
    groupByDay(normalizedPeriod, '_groupDate'),
    [normalizedPeriod]
  );

  const handleDelete = (id) => {
    update((draft) => { draft.entries = draft.entries.filter((e) => e.id !== id); return draft; });
    showToast('Sommeil supprimé', '🗑️');
  };

  // Terminer un sommeil en cours — ouvrir le formulaire pré-rempli
  const handleTerminer = (entry) => {
    setEditing({
      ...entry,
      fin: toLocalDT(new Date().toISOString()),
      enCours: false,
    });
    setFormOpen(true);
  };

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour suivre son sommeil.</div>
      </div>
    );
  }

  return (
    <div>
      <TodaySummaryCard entries={childSleeps} child={activeChild} />
      <WeeklyChart entries={childSleeps} />

      <div className="flex-between mt-16">
        <div className="section-title" style={{ marginBottom:0 }}>🗂️ Historique</div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            ＋ Ajouter
          </button>
        )}
      </div>

      <div className="chip-row mt-8">
        <button className={`chip ${period==='today'?'active':''}`} onClick={() => setPeriod('today')}>Aujourd'hui</button>
        <button className={`chip ${period==='7days'?'active':''}`} onClick={() => setPeriod('7days')}>7 jours</button>
        <button className={`chip ${period==='all'?'active':''}`} onClick={() => setPeriod('all')}>Tout</button>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🌙</div>
          <div className="title">Rien à afficher</div>
          <div className="desc">Aucune période de sommeil enregistrée. Touche "Ajouter" pour commencer.</div>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day}>
            <div className="day-group-label" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>{dayLabel(day)}</span>
              <span style={{ fontSize:'.65rem', color:'var(--text-faint)', fontWeight:600, fontFamily:'var(--font-mono)' }}>
                {items.length} session{items.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="entry-list">
              {items.map((s) => (
                <SommeilItem
                  key={s.id}
                  entry={s}
                  onEdit={() => canEdit && (setEditing(s), setFormOpen(true))}
                  onDelete={() => canEdit && handleDelete(s.id)}
                  onTerminer={canEdit ? handleTerminer : null}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <SommeilForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        child={activeChild}
        editing={editing}
      />
    </div>
  );
}

