import React, { useMemo, useState } from 'react';
import { useStore, genId, formatAge } from './store.jsx';
import { useToast, cancelNotif, formatDateFR, toISODate } from './utils.jsx';
import { Modal } from './Modal.jsx';
import { Icon } from './icons.jsx';
import { useFullHistory, HistoryNotice } from './HistoryNotice.jsx';
import {
  childDataCounts, totalCount, tableLabel, removeChild, removeChildData,
  findOrphans, removeOrphans, birthdateForAge, generateSampleData,
} from './children.js';

// Prénom(s) des autres parents connectés, pour les textes « visible chez Marie »
function useOtherParents() {
  const { store, firebaseUser } = useStore();
  return (store.members || [])
    .filter((m) => m.uid !== firebaseUser?.uid)
    .map((m) => m.displayName || m.email?.split('@')[0])
    .filter(Boolean);
}

function testVisibilityText(store, others) {
  if (!store.familyId) return 'sur ce téléphone (pas de synchro)';
  if (others.length) return `visible aussi chez ${others.join(' et ')}`;
  return 'synchronisé avec la famille';
}

function TestBadge() {
  return <span className="test-badge">TEST</span>;
}

// ----------------------------------------------------------------------
// Bandeau sous la barre du haut quand le profil test est actif
// ----------------------------------------------------------------------
export function TestModeBanner() {
  const { store, update } = useStore();
  const others = useOtherParents();
  const real = store.children.find((c) => !c.isTest);
  return (
    <div className="test-banner" role="status">
      <Icon name="flask" size={18} />
      <span><strong>Profil test</strong> · séparé{real ? ` de ${real.nom}` : ''}, {testVisibilityText(store, others)}</span>
      {real && (
        <button className="test-banner-btn" onClick={() => update((d) => { d.activeChildId = real.id; return d; })}>
          Revenir à {real.nom}
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Choix de l'enfant actif (tap sur le nom en haut)
// ----------------------------------------------------------------------
export function ChildSwitcherSheet({ open, onClose, onCreateTest, canEdit }) {
  const { store, update } = useStore();
  const others = useOtherParents();
  const hasTest = store.children.some((c) => c.isTest);

  const select = (id) => {
    update((d) => { d.activeChildId = id; return d; });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Quel enfant ?">
      <div className="child-pick-list">
        {store.children.map((c) => {
          const active = c.id === store.activeChildId;
          const n = totalCount(childDataCounts(store, c.id));
          return (
            <button key={c.id} className={`child-pick ${c.isTest ? 'is-test' : ''} ${active ? 'on' : ''}`}
              onClick={() => select(c.id)} aria-current={active ? 'true' : undefined}>
              <span className="child-pick-avatar">
                {c.isTest ? <Icon name="flask" size={20} /> : (c.nom || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="child-pick-body">
                <span className="child-pick-name">{c.nom} {c.isTest && <TestBadge />}</span>
                <span className="child-pick-sub">
                  {formatAge(c.birthdate)} · {n} donnée{n > 1 ? 's' : ''}
                  {store.familyId ? ' · synchronisé' : ''}
                </span>
              </span>
              {active && <Icon name="check" size={20} className="child-pick-check" />}
            </button>
          );
        })}
      </div>
      {canEdit && !hasTest && (
        <button className="dashed-btn" onClick={() => { onClose(); onCreateTest(); }}>
          <Icon name="plus" size={18} strokeWidth={2.4} /> Créer un profil test
        </button>
      )}
      <p className="sheet-note">
        Chaque téléphone a son enfant actif{others.length ? ` : basculer ici ne change rien chez ${others.join(' et ')}` : ''}.
      </p>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Création du profil test
// ----------------------------------------------------------------------
const TEST_AGES = [
  { m: 0, label: 'Naissance' },
  { m: 4, label: '4 mois' },
  { m: 9, label: '9 mois' },
  { m: 18, label: '18 mois' },
];

export function TestChildForm({ open, onClose }) {
  const { store, update } = useStore();
  const showToast = useToast();
  const others = useOtherParents();
  const [nom, setNom] = useState('Bébé test');
  const [months, setMonths] = useState(4);
  const [sexe, setSexe] = useState('fille');
  const [sample, setSample] = useState(true);

  React.useEffect(() => {
    if (open) { setNom('Bébé test'); setMonths(4); setSexe('fille'); setSample(true); }
  }, [open]);

  const real = store.children.find((c) => !c.isTest);

  const create = () => {
    const child = {
      id: genId(), nom: nom.trim() || 'Bébé test', emoji: '🧪', sexe,
      birthdate: birthdateForAge(months),
      alimentation: real?.alimentation || 'mixte', typeLait: real?.typeLait || '1er_age',
      allergies: '', groupeSanguin: '', medecinNom: '', medecinTel: '',
      contactUrgenceNom: '', contactUrgenceTel: '', notesMedicales: '', lastVitDDate: null,
      isTest: true,
    };
    const data = sample ? generateSampleData(child, months) : { entries: [], mesures: [] };
    update((d) => {
      d.children.push(child);
      d.entries.push(...data.entries);
      d.mesures.push(...data.mesures);
      d.activeChildId = child.id;
      return d;
    });
    const n = data.entries.length + data.mesures.length;
    showToast(n ? `Profil test créé · ${n} données d'exemple` : 'Profil test créé', '🧪');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouveau profil test">
      <div className="info-box warn">
        <Icon name="info" size={18} />
        <span>
          {store.familyId
            ? `Synchronisé : ${others.length ? others.join(' et ') + ' le voi' + (others.length > 1 ? 'ent' : 't') : 'la famille le voit'} aussi, avec le badge TEST.`
            : 'Pas de synchro active : il reste sur ce téléphone.'}
          {real ? ` Il n'entre jamais dans les stats, le PDF ou l'activité de ${real.nom}.` : ''}
        </span>
      </div>
      <div className="field">
        <label htmlFor="test-nom">Prénom</label>
        <input id="test-nom" type="text" value={nom} onChange={(e) => setNom(e.target.value)} />
      </div>
      <div className="field">
        <label>Âge simulé (repères OMS, vaccins, diversification)</label>
        <div className="choice-grid cols-4">
          {TEST_AGES.map((a) => (
            <button key={a.m} className={`choice ${months === a.m ? 'on' : ''}`} aria-pressed={months === a.m} onClick={() => setMonths(a.m)}>{a.label}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Sexe (courbes OMS)</label>
        <div className="choice-grid cols-2">
          <button className={`choice ${sexe === 'fille' ? 'on' : ''}`} aria-pressed={sexe === 'fille'} onClick={() => setSexe('fille')}>Fille</button>
          <button className={`choice ${sexe === 'garcon' ? 'on' : ''}`} aria-pressed={sexe === 'garcon'} onClick={() => setSexe('garcon')}>Garçon</button>
        </div>
      </div>
      <div className="flex-between toggle-row">
        <div>
          <div style={{ fontWeight: 600, fontSize: '.9rem' }}>Remplir avec 7 jours d'exemple</div>
          <div className="muted" style={{ fontSize: '.76rem', marginTop: 2 }}>
            ≈ 70 entrées fictives + 6 mesures : stats, courbes et PDF remplis tout de suite
          </div>
        </div>
        <button className={`switch ${sample ? 'on' : 'off'}`} role="switch" aria-checked={sample}
          aria-label="Remplir avec 7 jours d'exemple" onClick={() => setSample((v) => !v)} />
      </div>
      <button className="btn btn-primary btn-block mt-16" onClick={create}>Créer et passer dessus</button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Vider / supprimer un enfant (suppression complète, partout)
// mode : 'delete' | 'clear'
// ----------------------------------------------------------------------
export function DeleteChildModal({ child, mode = 'delete', onClose }) {
  const { store, update } = useStore();
  const showToast = useToast();
  // Toutes les données de l'enfant, y compris au-delà de 60 jours,
  // sinon les plus anciennes resteraient dans Firebase
  const history = useFullHistory(!!child);
  const others = useOtherParents();
  const [typed, setTyped] = useState('');
  const counts = useMemo(() => (child ? childDataCounts(store, child.id) : {}), [store, child]);
  if (!child) return null;

  const n = totalCount(counts);
  const clear = mode === 'clear';
  // Vrai enfant : on retape son prénom (suppression définitive pour toute la famille)
  const needTyping = !child.isTest && !clear;
  const ok = !needTyping || typed.trim().toLowerCase() === child.nom.trim().toLowerCase();
  const otherKids = store.children.filter((c) => c.id !== child.id).map((c) => c.nom);
  const where = store.familyId
    ? `partout : ici, dans Firebase${others.length ? ` et chez ${others.join(' et ')}` : ''}`
    : 'de ce téléphone';

  const run = () => {
    let notifIds = [];
    update((d) => {
      notifIds = clear ? removeChildData(d, child.id) : removeChild(d, child.id);
      return d;
    });
    notifIds.forEach((id) => cancelNotif(id));
    showToast(clear ? `${child.nom} vidé · ${n} données effacées` : `${child.nom} supprimé · ${n} données effacées`, '🗑️');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={clear ? `Vider « ${child.nom} » ?` : `Supprimer « ${child.nom} » ?`}>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: '.9rem' }}>
        {clear
          ? `Toutes ses données sont effacées ${where}. Le profil est conservé.`
          : `Le profil et toutes ses données sont effacés ${where}.`}
      </p>
      {n > 0 ? (
        <div className="count-grid">
          {Object.entries(counts).map(([t, c]) => (
            <div key={t} className="count-cell"><strong>{c}</strong><span>{tableLabel(t, c).replace(/^\d+ /, '')}</span></div>
          ))}
        </div>
      ) : (
        <div className="muted" style={{ fontSize: '.85rem', marginBottom: 12 }}>Aucune donnée enregistrée pour ce profil.</div>
      )}
      {otherKids.length > 0 && (
        <div className="info-box ok">
          <Icon name="check" size={18} />
          <span>Rien ne change pour <strong>{otherKids.join(', ')}</strong> : seules les données rattachées à « {child.nom} » sont effacées.</span>
        </div>
      )}
      {needTyping && (
        <div className="field mt-8">
          <label htmlFor="confirm-name">Pour confirmer, tape « {child.nom} »</label>
          <input id="confirm-name" type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      )}
      {history !== 'complete' && <HistoryNotice />}
      <button className="btn btn-block btn-danger-solid mt-8" disabled={!ok || history === 'loading'} onClick={run}>
        {clear ? `Effacer ${n} donnée${n > 1 ? 's' : ''}` : child.isTest ? 'Supprimer le profil test' : `Supprimer ${child.nom} définitivement`}
      </button>
      <button className="btn btn-outline btn-block mt-8" onClick={onClose}>Annuler</button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Réglages → Sauvegarde : données orphelines
// ----------------------------------------------------------------------
export function OrphanSection() {
  const { store, update, syncStatus, firebaseUser, loadHistory, getStore } = useStore();
  const [busy, setBusy] = useState(false);
  const showToast = useToast();
  const [result, setResult] = useState(null); // null | groups[]
  const [confirm, setConfirm] = useState(false);
  const [analysedAt, setAnalysedAt] = useState(null);
  const waiting = !!store.familyId && !!firebaseUser && syncStatus !== 'synced';

  // Analyse sur tout l'historique (pas seulement les 60 derniers jours)
  const analyse = async () => {
    setBusy(true);
    const complete = await loadHistory();
    setBusy(false);
    setResult(findOrphans(getStore()));
    setAnalysedAt(new Date());
    setConfirm(false);
    if (!complete) showToast('Historique ancien indisponible : analyse partielle', '⚠️');
  };

  const total = (result || []).reduce((s, g) => s + g.items.length, 0);

  const purge = () => {
    const groups = result;
    update((d) => { removeOrphans(d, groups); return d; });
    groups.forEach((g) => g.items.forEach((i) => {
      if (i.table === 'rappels') cancelNotif(i.id);
      if (i.table === 'medicaments') cancelNotif(`medoc_${i.id}`);
    }));
    showToast(`${total} données orphelines supprimées`, '🧹');
    setResult([]);
    setConfirm(false);
  };

  const range = (g) => {
    if (!g.first) return 'date inconnue';
    const a = formatDateFR(toISODate(new Date(g.first)));
    const b = formatDateFR(toISODate(new Date(g.last)));
    return a === b ? `le ${a}` : `du ${a} au ${b}`;
  };

  return (
    <div className="orphan-section">
      <div className="flex-between" style={{ gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '.9rem' }}>Données orphelines</div>
          <div className="muted" style={{ fontSize: '.76rem', marginTop: 2 }}>Rattachées à un enfant qui n'existe plus</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={analyse} disabled={waiting || busy}>
          {busy ? 'Chargement…' : result ? 'Réanalyser' : 'Analyser'}
        </button>
      </div>
      {waiting && <div className="muted" style={{ fontSize: '.76rem', marginTop: 8 }}>Attends la fin de la synchro pour analyser (sinon un enfant pas encore reçu serait pris pour un enfant supprimé).</div>}

      {result && result.length === 0 && (
        <div className="info-box ok mt-8"><Icon name="check" size={18} /><span>Aucune donnée orpheline.</span></div>
      )}

      {result && result.length > 0 && (
        <div className="orphan-box mt-8">
          <div className="orphan-total"><strong>{total}</strong> donnée{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}{store.familyId ? ' dans Firebase' : ''}</div>
          {result.map((g, i) => (
            <div key={g.childId} className="orphan-row">
              <span><strong>Enfant supprimé n° {i + 1}</strong><br /><span className="muted">{range(g)}</span></span>
              <span className="orphan-counts">{Object.entries(g.counts).map(([t, c]) => <span key={t}>{tableLabel(t, c)}</span>)}</span>
            </div>
          ))}
          {!confirm ? (
            <button className="btn btn-block btn-danger-solid mt-8" onClick={() => setConfirm(true)}>
              Supprimer ces {total} données
            </button>
          ) : (
            <div className="mt-8 row-8">
              <button className="btn btn-outline btn-sm flex-1" onClick={() => setConfirm(false)}>Annuler</button>
              <button className="btn btn-danger-solid btn-sm flex-1" onClick={purge}>Confirmer</button>
            </div>
          )}
        </div>
      )}
      {analysedAt && (
        <div className="muted" style={{ fontSize: '.72rem', marginTop: 8 }}>
          Analyse de {analysedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} sur toutes les données {store.familyId ? 'de la famille reçues de Firebase' : 'de ce téléphone'}.
          Les profils existants ne sont pas concernés.
        </div>
      )}
    </div>
  );
}
