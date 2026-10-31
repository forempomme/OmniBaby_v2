import React, { useState, useMemo, useRef } from 'react';
import { useStore, getActiveChild, ageInMonths, authorFields } from '../store.jsx';
import { toISODateTime, toISODate, toLocalDT, useToast } from '../utils.jsx';
import { Modal } from '../Modal.jsx';
import { ENTRY_TYPES, STOOL_COLORS, stoolColor } from './entryTypes.js';
import { Icon } from '../icons.jsx';
import { loadTimerState, startTeteeTimer, suggestedSide, timerMeta } from '../timer.js';
import { scheduleLaitNotif } from '../tools/StockLait.jsx';

const COUCHE_OPTIONS = [
  { key: 'pipi', label: 'Pipi' },
  { key: 'selles', label: 'Selles' },
  { key: 'mixte', label: 'Les deux' },
  { key: 'seche', label: 'Sèche' },
];

const RANGEMENTS = [
  { key: 'frigo', label: 'Frigo' },
  { key: 'congel', label: 'Congélateur' },
  { key: 'donne', label: 'Donné tout de suite' },
];

const COTES = [
  { key: 'gauche', label: 'Gauche' },
  { key: 'droit', label: 'Droit' },
  { key: 'deux', label: 'Les deux' },
];

// Datetime-local (heure locale) → ISO UTC stocké
function toStoredDate(localValue) {
  const d = new Date(localValue);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function Pills({ options, value, onChange }) {
  return (
    <div className="pill-group">
      {options.map((o) => (
        <button key={o.key} className={`pill-choice ${value === o.key ? 'selected' : ''}`} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// afterSide : bloc inséré après le choix du côté (bouton chrono de tétée)
function FeedingFields({ f, set, showVitD, idSuffix, afterSide = null }) {
  return (
    <>
      <div className="field">
        <label>Mode</label>
        <Pills options={[{ key: 'biberon', label: 'Biberon' }, { key: 'sein', label: 'Tétée' }]} value={f.mode} onChange={(v) => set('mode', v)} />
      </div>
      {f.mode === 'biberon' ? (
        <div className="field">
          <label>Quantité (ml)</label>
          <input type="number" inputMode="numeric" value={f.quantite} onChange={(e) => set('quantite', e.target.value)} placeholder="120" />
        </div>
      ) : (
        <div className="field">
          <label>Côté</label>
          <Pills options={COTES} value={f.cote} onChange={(v) => set('cote', v)} />
        </div>
      )}
      {f.mode === 'sein' && afterSide}
      <div className="field">
        <label>Durée (minutes, optionnel)</label>
        <input type="number" inputMode="numeric" value={f.duree} onChange={(e) => set('duree', e.target.value)} placeholder="15" />
      </div>
      {showVitD && (
        <label className="check-row" htmlFor={`vitD-${idSuffix}`}>
          <input type="checkbox" id={`vitD-${idSuffix}`} checked={!!f.vitamineD} onChange={(e) => set('vitamineD', e.target.checked)} />
          Vitamine D donnée
        </label>
      )}
    </>
  );
}

// Couleur des selles + alerte si décolorées
function StoolPicker({ f, set, child }) {
  if (f.contenu !== 'selles' && f.contenu !== 'mixte') return null;
  const picked = stoolColor(f.couleur);
  const swatch = (c) => (
    <button key={c.key} className={`stool-sw ${f.couleur === c.key ? 'on' : ''} ${c.pale ? 'pale' : ''}`}
      style={{ background: c.hex, color: c.ink }} aria-pressed={f.couleur === c.key}
      aria-label={`Selles ${c.label}`} onClick={() => set('couleur', f.couleur === c.key ? '' : c.key)}>
      {c.label}
    </button>
  );
  return (
    <div className="field">
      <label>Couleur des selles (facultatif)</label>
      <div className="stool-group">Habituelles</div>
      <div className="stool-grid">{STOOL_COLORS.filter((c) => !c.pale).map(swatch)}</div>
      <div className="stool-group">Décolorées — à signaler</div>
      <div className="stool-grid">{STOOL_COLORS.filter((c) => c.pale).map(swatch)}</div>
      {picked?.pale && (
        <>
          <div className="alert-box danger mt-8">
            <Icon name="alert" size={20} />
            <span><strong>Selles décolorées : à montrer rapidement à un médecin</strong>, sans attendre la prochaine visite. Prends une photo de la couche.</span>
          </div>
          {child?.medecinTel && (
            <div className="call-row">
              <a className="btn btn-danger-solid btn-sm" href={`tel:${child.medecinTel.replace(/\s/g, '')}`}>
                <Icon name="phone" size={16} /> {child.medecinNom || 'Médecin'}
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function applyFields(base, type, f) {
  const out = { ...base };
  if (type === 'biberon') {
    out.mode = f.mode;
    if (f.mode === 'biberon') { out.quantite = Number(f.quantite) || 0; delete out.cote; }
    else { out.cote = f.cote; delete out.quantite; }
    if (f.duree) out.duree = Number(f.duree); else delete out.duree;
    out.vitamineD = !!f.vitamineD;
  } else if (type === 'couche') {
    out.contenu = f.contenu;
    if ((f.contenu === 'selles' || f.contenu === 'mixte') && f.couleur) out.couleur = f.couleur;
    else delete out.couleur;
  } else if (type === 'tirelait') {
    out.cote = f.cote;
    out.quantite = Number(f.quantite) || 0;
    if (f.duree) out.duree = Number(f.duree); else delete out.duree;
    out.rangement = f.rangement || 'frigo';
  } else if (type === 'autre') {
    out.note = f.note;
  }
  return out;
}

// ----------------------------------------------------------------------
// Nouvelle entrée. Le sommeil a son propre formulaire (début / fin /
// en cours) : la pastille « Sommeil » appelle onPickSommeil.
// ----------------------------------------------------------------------
export function EntryForm({ open, onClose, prefill, onPickSommeil }) {
  const { store, update, nextId, firebaseUser } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const defaultMl = store.settings?.defaultBiberonMl || '';
  // Côté proposé : l'inverse de la dernière tétée de cet enfant
  const lastCote = useMemo(() => {
    const feeds = (store.entries || [])
      .filter((e) => e.childId === activeChild?.id && e.type === 'biberon' && e.mode === 'sein')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return feeds[0]?.cote;
  }, [store.entries, activeChild?.id]);
  const [timerRunning, setTimerRunning] = useState(() => !!loadTimerState());

  const initial = useMemo(() => ({
    type: prefill?.type && prefill.type !== 'sommeil' ? prefill.type : 'biberon',
    datetime: prefill?.datetime || toISODateTime(),
    mode: prefill?.mode || 'biberon',
    quantite: prefill?.quantite ?? defaultMl,
    cote: prefill?.cote || suggestedSide(lastCote),
    duree: prefill?.duree ?? '',
    vitamineD: !!prefill?.vitamineD,
    contenu: prefill?.contenu || 'pipi',
    couleur: '',
    note: '',
    rangement: prefill?.rangement || 'frigo',
  }), [prefill, defaultMl, open, lastCote]);

  const [f, setF] = useState(initial);
  const initialRef = useRef(initial);
  React.useEffect(() => {
    if (open) { setF(initial); initialRef.current = initial; setTimerRunning(!!loadTimerState()); }
  }, [open, initial]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify({ ...f, datetime: '' }) !== JSON.stringify({ ...initialRef.current, datetime: '' });

  const showVitD = useMemo(() => {
    const ageM = activeChild ? ageInMonths(activeChild.birthdate) : null;
    return ageM == null || ageM < 24;
  }, [activeChild]);

  // Tétée : même chrono que Outils → Minuteur (notification comprise)
  const chronoMode = f.type === 'biberon' && f.mode === 'sein';
  const launchChrono = () => {
    if (!activeChild) { showToast('Crée d’abord le profil de bébé', '⚠️'); return; }
    onClose();
    startTeteeTimer(f.cote === 'droit' ? 'droit' : 'gauche', timerMeta(activeChild, firebaseUser));
  };
  const dateField = (
    <div className="field">
      <label>Date et heure</label>
      <input type="datetime-local" value={f.datetime} onChange={(e) => set('datetime', e.target.value)} />
    </div>
  );
  const chronoBlock = (
    <>
      <button className="btn btn-primary btn-block" onClick={launchChrono}>
        {timerRunning ? 'Ouvrir le chrono en cours' : `▶ Lancer le chrono — côté ${f.cote === 'droit' ? 'droit' : 'gauche'}`}
      </button>
      <div className="chrono-sep">tétée déjà terminée ?</div>
      {dateField}
    </>
  );

  const handleSubmit = () => {
    if (!activeChild) { showToast('Crée d’abord le profil de bébé', '⚠️'); return; }
    if (f.type === 'biberon' && f.mode === 'biberon' && !(Number(f.quantite) > 0)) {
      showToast('Indique la quantité en ml', '⚠️'); return;
    }
    if (f.type === 'autre' && !f.note.trim()) { showToast('Écris une note', '⚠️'); return; }
    if (f.type === 'tirelait' && !(Number(f.quantite) > 0)) { showToast('Indique la quantité tirée en ml', '⚠️'); return; }
    const entry = applyFields({
      id: nextId(),
      childId: activeChild.id,
      type: f.type,
      date: toStoredDate(f.datetime),
      ...authorFields(firebaseUser, 'created'),
    }, f.type, f);

    // Tire-lait rangé : un pot entre dans le stock (Outils → Stock de lait)
    const pot = entry.type === 'tirelait' && entry.rangement !== 'donne' ? {
      id: nextId(), childId: activeChild.id, date: entry.date, quantite: entry.quantite, cote: entry.cote,
      lieu: entry.rangement === 'congel' ? 'congel' : 'frigo', depuis: entry.date, sessionId: entry.id,
      ...authorFields(firebaseUser, 'created'),
    } : null;
    update((draft) => {
      draft.entries.push(entry);
      if (pot) draft.lait = (draft.lait || []).concat(pot);
      if (entry.type === 'biberon' && entry.vitamineD) {
        const c = draft.children.find((x) => x.id === activeChild.id);
        if (c) c.lastVitDDate = toISODate(new Date(entry.date));
      }
      return draft;
    });
    if (pot) scheduleLaitNotif(pot, store.settings?.notifs?.lait !== false);
    showToast(pot ? `Tire-lait enregistré · ${pot.quantite} ml ${pot.lieu === 'congel' ? 'au congélateur' : 'au frigo'}` : 'Entrée enregistrée', '✅');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle entrée" icon="📓" dirty={dirty}>
      <div className="field">
        <label>Type</label>
        <div className="pill-group">
          {Object.entries(ENTRY_TYPES).map(([key, def]) => (
            <button
              key={key}
              className={`pill-choice ${f.type === key ? 'selected' : ''}`}
              onClick={() => (key === 'sommeil' ? onPickSommeil && onPickSommeil() : set('type', key))}
            >
              {def.label}
            </button>
          ))}
        </div>
      </div>

      {!chronoMode && dateField}

      {f.type === 'biberon' && <FeedingFields f={f} set={set} showVitD={showVitD} idSuffix="new" afterSide={chronoBlock} />}

      {f.type === 'couche' && (
        <div className="field">
          <label>Contenu</label>
          <Pills options={COUCHE_OPTIONS} value={f.contenu} onChange={(v) => set('contenu', v)} />
        </div>
      )}
      {f.type === 'couche' && <StoolPicker f={f} set={set} child={activeChild} />}

      {f.type === 'tirelait' && (
        <>
          <div className="field">
            <label>Côté</label>
            <Pills options={COTES} value={f.cote} onChange={(v) => set('cote', v)} />
          </div>
          <div className="field-row">
            <div className="field flex-1">
              <label>Quantité (ml)</label>
              <input type="number" inputMode="numeric" value={f.quantite} onChange={(e) => set('quantite', e.target.value)} placeholder="150" />
            </div>
            <div className="field flex-1">
              <label>Durée (min)</label>
              <input type="number" inputMode="numeric" value={f.duree} onChange={(e) => set('duree', e.target.value)} placeholder="20" />
            </div>
          </div>
          <div className="field">
            <label>Rangement</label>
            <Pills options={RANGEMENTS} value={f.rangement} onChange={(v) => set('rangement', v)} />
          </div>
        </>
      )}


      {f.type === 'autre' && (
        <div className="field">
          <label>Note</label>
          <textarea rows={3} value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Décris l'événement…" />
        </div>
      )}

      <button className={`btn ${chronoMode ? 'btn-outline' : 'btn-primary'} btn-block mt-16`} onClick={handleSubmit}>
        {chronoMode ? 'Enregistrer sans chrono' : 'Enregistrer'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Modification d'une entrée (hors sommeil, qui passe par SommeilForm)
// ----------------------------------------------------------------------
export function EditEntryModal({ entry, onClose }) {
  const { store, update, firebaseUser } = useStore();
  const showToast = useToast();
  const def = ENTRY_TYPES[entry.type] || ENTRY_TYPES.autre;
  const child = store.children.find((c) => c.id === entry.childId) || getActiveChild(store);
  const [f, setF] = useState(() => ({
    datetime: toLocalDT(entry.date) || toISODateTime(),
    mode: entry.mode || 'biberon',
    quantite: entry.quantite ?? '',
    cote: entry.cote || 'gauche',
    duree: entry.duree ?? '',
    vitamineD: !!entry.vitamineD,
    contenu: entry.contenu || 'pipi',
    couleur: entry.couleur || '',
    rangement: entry.rangement || 'frigo',
    note: entry.note || '',
  }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const handleSave = () => {
    update((draft) => {
      const idx = draft.entries.findIndex((e) => e.id === entry.id);
      if (idx === -1) return draft;
      draft.entries[idx] = applyFields({
        ...draft.entries[idx],
        date: toStoredDate(f.datetime),
        ...authorFields(firebaseUser, 'updated'),
      }, entry.type, f);
      return draft;
    });
    showToast('Entrée modifiée', '✅');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Modifier — ${def.label}`} icon={def.icon}>
      <div className="field">
        <label>Date et heure</label>
        <input type="datetime-local" value={f.datetime} onChange={(e) => set('datetime', e.target.value)} />
      </div>

      {entry.type === 'biberon' && <FeedingFields f={f} set={set} showVitD idSuffix="edit" />}

      {entry.type === 'couche' && (
        <div className="field">
          <label>Contenu</label>
          <Pills options={COUCHE_OPTIONS} value={f.contenu} onChange={(v) => set('contenu', v)} />
        </div>
      )}
      {entry.type === 'couche' && <StoolPicker f={f} set={set} child={child} />}

      {entry.type === 'tirelait' && (
        <>
          <div className="field">
            <label>Côté</label>
            <Pills options={COTES} value={f.cote} onChange={(v) => set('cote', v)} />
          </div>
          <div className="field-row">
            <div className="field flex-1">
              <label>Quantité (ml)</label>
              <input type="number" inputMode="numeric" value={f.quantite} onChange={(e) => set('quantite', e.target.value)} placeholder="150" />
            </div>
            <div className="field flex-1">
              <label>Durée (min)</label>
              <input type="number" inputMode="numeric" value={f.duree} onChange={(e) => set('duree', e.target.value)} placeholder="20" />
            </div>
          </div>
          
        </>
      )}


      {entry.type === 'autre' && (
        <div className="field">
          <label>Note</label>
          <textarea rows={3} value={f.note} onChange={(e) => set('note', e.target.value)} />
        </div>
      )}

      <button className="btn btn-primary btn-block mt-16" onClick={handleSave}>Enregistrer</button>
    </Modal>
  );
}
