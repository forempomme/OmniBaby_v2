import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StoreProvider, useStore, getActiveChild, formatAge, genId, authorFields } from './store.jsx';
import { ToastProvider, useToast, toTime, daysAgo } from './utils.jsx';
import { ModalStackProvider, useAndroidBack, Modal } from './Modal.jsx';
import AuthGate, { initials } from './Auth.jsx';
import { Icon } from './icons.jsx';
import JournalTab from './Journal.jsx';
import SanteTab from './Sante.jsx';
import DodoTab from './Dodo.jsx';
import OutilsTab from './Outils.jsx';
import ReglagesTab from './Reglages.jsx';
import { entryTitle } from './journal/entryTypes.js';
import { ChildSwitcherSheet, TestChildForm, TestModeBanner } from './ChildManager.jsx';
import { loadTimerState, saveTimerState, switchSide, teteeFromTimer, syncTimerNotif, initTimerNotifActions, adoptNativeTimerState, onAppResume, setTimerNotifPolicy } from './timer.js';
import { startLiveTimer, stopLiveTimer } from './liveTimer.js';
import { syncSleepNotif, readNativeWakes, wakeFields } from './sleepNotif.js';

const TABS = [
  { key: 'journal', label: 'Journal', icon: 'book' },
  { key: 'sante', label: 'Santé', icon: 'activity' },
  { key: 'dodo', label: 'Dodo', icon: 'moon' },
  { key: 'outils', label: 'Outils', icon: 'grid' },
];

// ----------------------------------------------------------------------
// Activité des parents — 7 derniers jours
// ----------------------------------------------------------------------
const ACTIVITY_TYPES = [
  { k: 'tous', l: 'Tout' },
  { k: 'biberon', l: 'Repas' },
  { k: 'couche', l: 'Changes' },
  { k: 'sommeil', l: 'Sommeil' },
  { k: 'mesure', l: 'Mesures' },
  { k: 'temperature', l: 'Fièvre' },
];

function ActivityReport({ open, onClose, firebaseUser, store }) {
  const [filterType, setFilterType] = useState('tous');
  const [filterWho, setFilterWho] = useState('tous');
  const userUid = firebaseUser?.uid;
  const userName = firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Moi';

  // Hooks avant tout return conditionnel (sinon crash à l'ouverture)
  const allItems = useMemo(() => {
    if (!open) return [];
    const since = daysAgo(7).getTime();
    const items = [];
    const childOf = (id) => store.children.find((c) => c.id === id);
    // Le profil test n'apparaît jamais dans l'activité
    const testIds = new Set(store.children.filter((c) => c.isTest).map((c) => c.id));
    for (const e of store.entries || []) {
      if (testIds.has(e.childId)) continue;
      if (!e.createdBy && !e.updatedBy) continue;
      const child = childOf(e.childId);
      items.push({
        date: e.updatedAt || e.createdAt || e.date,
        typeKey: e.type,
        label: entryTitle(e),
        action: e.updatedBy ? 'edited' : 'added',
        author: e.updatedByName || e.createdByName || userName,
        isMe: (e.updatedBy || e.createdBy) === userUid,
        child: child?.nom,
      });
    }
    for (const m of store.mesures || []) {
      if (testIds.has(m.childId)) continue;
      if (!m.createdBy) continue;
      items.push({
        date: m.createdAt || m.date,
        typeKey: 'mesure',
        label: `${m.type === 'poids' ? 'Poids' : m.type === 'taille' ? 'Taille' : 'Périmètre crânien'} · ${m.valeur} ${m.type === 'poids' ? 'kg' : 'cm'}`,
        action: 'added',
        author: m.createdByName || userName,
        isMe: m.createdBy === userUid,
        child: childOf(m.childId)?.nom,
      });
    }
    for (const t of store.temperatures || []) {
      if (testIds.has(t.childId)) continue;
      if (!t.createdBy) continue;
      items.push({
        date: t.createdAt || t.date,
        typeKey: 'temperature',
        label: `Température · ${t.valeur} °C`,
        action: 'added',
        author: t.createdByName || userName,
        isMe: t.createdBy === userUid,
        child: childOf(t.childId)?.nom,
      });
    }
    return items.filter((i) => toTime(i.date) >= since).sort((a, b) => toTime(b.date) - toTime(a.date));
  }, [open, store.entries, store.mesures, store.temperatures, store.children, userUid, userName]);

  if (!open) return null;

  const fmtWhen = (iso) => {
    const d = new Date(iso);
    const diffH = Math.floor((Date.now() - d.getTime()) / 3600000);
    if (diffH < 1) return '< 1 h';
    if (diffH < 24) return `${diffH} h`;
    if (diffH < 48) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  };

  const otherAuthors = [...new Set(allItems.filter((i) => !i.isMe).map((i) => i.author))];
  const whoFilters = [{ k: 'tous', l: 'Tous' }, { k: 'me', l: userName }, ...otherAuthors.map((a) => ({ k: a, l: a }))];
  const shown = allItems
    .filter((i) => filterType === 'tous' || i.typeKey === filterType)
    .filter((i) => filterWho === 'tous' || (filterWho === 'me' ? i.isMe : i.author === filterWho))
    .slice(0, 80);

  return (
    <Modal open onClose={onClose} title="Activité — 7 derniers jours" icon="👥">
      <div className="activity-stats">
        <div><strong>{allItems.length}</strong><span>Total</span></div>
        <div className="me"><strong>{allItems.filter((i) => i.isMe).length}</strong><span>{userName}</span></div>
        {otherAuthors.map((a) => (
          <div key={a} className="other"><strong>{allItems.filter((i) => i.author === a && !i.isMe).length}</strong><span>{a}</span></div>
        ))}
      </div>
      <div className="chip-row" style={{ marginBottom: 6 }}>
        {ACTIVITY_TYPES.map((f) => (
          <button key={f.k} className={`chip ${filterType === f.k ? 'active' : ''}`} onClick={() => setFilterType(f.k)}>{f.l}</button>
        ))}
      </div>
      <div className="chip-row">
        {whoFilters.map((f) => (
          <button key={f.k} className={`chip ${filterWho === f.k ? 'active' : ''}`} onClick={() => setFilterWho(f.k)}>{f.l}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="empty-state">
          <div className="desc">
            {allItems.length === 0
              ? 'Aucune saisie signée sur 7 jours. Les entrées faites avec un compte connecté apparaissent ici.'
              : 'Aucun résultat pour ce filtre.'}
          </div>
        </div>
      ) : shown.map((item, i) => (
        <div key={i} className="activity-row">
          <span className={`activity-dot ${item.isMe ? 'me' : 'other'}`}>{initials(item.author)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="activity-label">{item.label}{item.child && store.children.length > 1 ? ` · ${item.child}` : ''}</span>
            <span className="activity-meta">{item.action === 'added' ? 'Ajouté' : 'Modifié'} par {item.author}</span>
          </span>
          <span className="activity-when">{fmtWhen(item.date)}</span>
        </div>
      ))}
    </Modal>
  );
}

// ----------------------------------------------------------------------
function SkeletonLoader() {
  return (
    <div className="skeleton-list">
      <div className="skeleton-stamp-row">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-stamp" />)}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton-entry">
          <div className="skeleton skeleton-entry-icon" />
          <div className="skeleton-entry-body">
            <div className="skeleton skeleton-entry-title" />
            <div className="skeleton skeleton-entry-sub" />
          </div>
          <div className="skeleton skeleton-entry-time" />
        </div>
      ))}
    </div>
  );
}

// Prochain 7 h du matin (fin de la « nuit »)
function nextMorning() {
  const d = new Date();
  if (d.getHours() >= 7) d.setDate(d.getDate() + 1);
  d.setHours(7, 0, 0, 0);
  return d.getTime();
}

// Thème : 'light' | 'dark' | 'night'
function computeTheme(settings, now = new Date()) {
  const { dark, darkHour, nightMode, nightHour, nightSnoozeUntil } = settings || {};
  const hour = now.getHours();
  if (nightMode === true) return 'night';
  if (nightMode == null) {
    const nh = nightHour ?? 22;
    const snoozed = nightSnoozeUntil && now.getTime() < nightSnoozeUntil;
    if ((hour >= nh || hour < 7) && !snoozed) return 'night';
  }
  if (dark == null) {
    const dh = darkHour ?? 21;
    return hour >= dh || hour < 7 ? 'dark' : 'light';
  }
  return dark ? 'dark' : 'light';
}

const SYNC_TEXT = { synced: 'Synchronisé', syncing: 'Synchro…', error: 'Erreur', offline: 'Hors-ligne' };

function AppShell() {
  const { store, update, firebaseUser, syncStatus, session } = useStore();
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState('journal');
  const [childSwitcherOpen, setChildSwitcherOpen] = useState(false);
  const [testFormOpen, setTestFormOpen] = useState(false);
  const [journalIntent, setJournalIntent] = useState(null);
  const [openToolKey, setOpenToolKey] = useState(null);
  const [openDodoForm, setOpenDodoForm] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(() => {
    try { return !!JSON.parse(localStorage.getItem('omnibaby_minuteur_v1') || 'null'); } catch (e) { return false; }
  });
  const [theme, setTheme] = useState(() => computeTheme(store.settings));
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const lastErrorToast = useRef(0);

  const activeChild = getActiveChild(store);
  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';
  const testMode = !!activeChild?.isTest;
  const { showExitHint } = useAndroidBack({ activeTab, setActiveTab, defaultTab: 'journal' });

  // Squelette pendant la première synchro (4 s maximum, même en cas d'erreur)
  useEffect(() => {
    if (syncStatus !== 'syncing') {
      const t = setTimeout(() => setIsFirstLoad(false), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setIsFirstLoad(false), 4000);
    return () => clearTimeout(t);
  }, [syncStatus]);

  // Pastille sur l'onglet Outils tant qu'une tétée est chronométrée
  useEffect(() => {
    const h = (e) => setTimerRunning(!!e.detail?.active);
    window.addEventListener('omnibaby-timer', h);
    return () => window.removeEventListener('omnibaby-timer', h);
  }, []);

  // ── Chronos partagés avec l'autre parent (tétée en cours, sommeil) ──
  const partageOn = store.settings?.notifs?.partage !== false;
  const myUid = firebaseUser?.uid;
  useEffect(() => {
    const policy = (st) => partageOn || !st.startedBy || st.startedBy === myUid;
    setTimerNotifPolicy(policy);
    const st = loadTimerState();
    syncTimerNotif(st && policy(st) ? st : null);
  }, [partageOn, myUid]);
  useEffect(() => {
    if (!store.familyId || !myUid) { stopLiveTimer(); return undefined; }
    startLiveTimer(store.familyId, {
      onError: () => showToast('Tétée partagée indisponible : publie les nouvelles règles Firebase (voir README)', '⚠️', { duration: 8000 }),
    });
    return () => stopLiveTimer();
  }, [store.familyId, myUid]);

  // Sommeil en cours (le plus récent) → notification chrono + « Réveil »
  const sleeping = useMemo(() => (store.entries || [])
    .filter((e) => e.type === 'sommeil' && e.enCours)
    .sort((a, b) => toTime(b.debut || b.date) - toTime(a.debut || a.date))[0] || null, [store.entries]);
  useEffect(() => {
    const show = sleeping && (partageOn || !sleeping.createdBy || sleeping.createdBy === myUid);
    const child = sleeping && store.children.find((c) => c.id === sleeping.childId);
    syncSleepNotif(show ? sleeping : null, child?.nom);
  }, [sleeping, partageOn, myUid, store.children]);

  // Réveils notés depuis la notification (écran verrouillé) → entrée terminée
  const endSleep = (entryId, wakeAt) => {
    let done = false;
    update((draft) => {
      const e = draft.entries.find((x) => String(x.id) === String(entryId));
      if (e && e.enCours) { Object.assign(e, wakeFields(e, wakeAt), authorFields(firebaseUser, 'updated')); done = true; }
      return draft;
    });
    return done;
  };
  const wakesRef = useRef(null);
  wakesRef.current = async () => {
    const wakes = await readNativeWakes();
    const n = wakes.filter((w) => endSleep(w.entryId, w.wakeAt)).length;
    if (n) showToast(n > 1 ? `${n} réveils enregistrés` : 'Réveil enregistré', '✅');
  };
  // Pendant un chrono : relire régulièrement ce qu'Android a pu noter
  // (bouton touché dans le volet alors que l'appli reste ouverte)
  useEffect(() => {
    if (!sleeping && !timerRunning) return undefined;
    const t = setInterval(() => { wakesRef.current?.(); adoptNativeTimerState(); }, 10000);
    return () => clearInterval(t);
  }, [!!sleeping, timerRunning]);

  // Boutons de la notification « Tétée en cours ». Le gestionnaire passe
  // par une ref pour toujours voir l'enfant actif et le compte courants.
  const timerActionRef = useRef(null);
  timerActionRef.current = async (action, extra) => {
    // Sommeil : « Réveil » sans le code Android, ou toucher la notification
    if (action === 'wake') {
      if (extra?.entryId != null && canEdit && endSleep(extra.entryId, Date.now())) showToast('Réveil enregistré', '✅');
      return;
    }
    if (action === 'openSleep') { setActiveTab('dodo'); return; }
    // Un changement de côté a pu être fait depuis la notification
    await adoptNativeTimerState();
    const state = loadTimerState();
    if (!state) return;
    if (action === 'switch') {
      saveTimerState(switchSide(state));
      return;
    }
    const childId = state.childId || activeChild?.id;
    if (action === 'finish' && childId && canEdit) {
      const entry = { id: genId(), childId, ...teteeFromTimer(state), ...authorFields(firebaseUser, 'created') };
      update((draft) => { draft.entries.push(entry); return draft; });
      saveTimerState(null);
      setToolReturnTab(null);
      setOpenToolKey(null);
      setActiveTab('journal');
      showToast(`Tétée enregistrée — ${entry.duree} min · ${entry.cote === 'deux' ? 'les deux côtés' : entry.cote}`, '✅');
      return;
    }
    // Toucher la notification (ou Terminer sans enfant / droits) : ouvre le minuteur
    openMinuteur(null);
  };
  useEffect(() => {
    let off = () => {};
    let alive = true;
    initTimerNotifActions((a, extra) => timerActionRef.current?.(a, extra)).then((fn) => { if (alive) off = fn; else fn(); });
    // Au lancement : reprendre un changement de côté fait depuis la
    // notification, sinon remettre la notification en place (ex. après
    // redémarrage du téléphone)
    adoptNativeTimerState().then((adopted) => { if (!adopted) syncTimerNotif(loadTimerState()); });
    wakesRef.current?.();
    let offResume = () => {};
    onAppResume(() => { adoptNativeTimerState(); wakesRef.current?.(); }).then((fn) => { if (alive) offResume = fn; else fn(); });
    return () => { alive = false; off(); offResume(); };
  }, []);

  // Minuteur ouvert depuis le Journal : sa fermeture ramène au Journal
  const [toolReturnTab, setToolReturnTab] = useState(null);
  const openMinuteur = (returnTab) => {
    setToolReturnTab(returnTab);
    setActiveTab('outils');
    setOpenToolKey('minuteur');
  };
  const setToolKey = (k) => {
    setOpenToolKey(k);
    if (k === null && toolReturnTab) { setActiveTab(toolReturnTab); setToolReturnTab(null); }
  };
  // « Nouveau tire-lait » depuis le Stock de lait → formulaire du Journal
  useEffect(() => {
    const h = (e) => {
      setToolReturnTab(null);
      setOpenToolKey(null);
      setActiveTab('journal');
      setJournalIntent({ kind: 'new', prefill: e.detail?.prefill || null });
    };
    window.addEventListener('omnibaby-new-entry', h);
    return () => window.removeEventListener('omnibaby-new-entry', h);
  }, []);

  useEffect(() => {
    const h = () => openMinuteur(activeTab === 'outils' ? null : activeTab);
    window.addEventListener('omnibaby-open-minuteur', h);
    return () => window.removeEventListener('omnibaby-open-minuteur', h);
  }, [activeTab]);

  // Erreurs d'écriture Firestore → message visible (au plus 1 / 30 s)
  useEffect(() => {
    const handler = (e) => {
      console.warn('[Firebase sync error]', e.detail);
      if (Date.now() - lastErrorToast.current < 30000) return;
      lastErrorToast.current = Date.now();
      showToast("Synchro impossible pour l'instant — la saisie reste sur ce téléphone", '⚠️');
    };
    window.addEventListener('firebase-sync-error', handler);
    return () => window.removeEventListener('firebase-sync-error', handler);
  }, [showToast]);

  // Notification du minuteur impossible → message visible (au plus 1 / 20 s)
  const lastNotifToast = useRef(0);
  useEffect(() => {
    const handler = (e) => {
      if (Date.now() - lastNotifToast.current < 20000) return;
      lastNotifToast.current = Date.now();
      showToast(`Notification tétée impossible (${e.detail?.message || 'erreur inconnue'})`, '⚠️', { duration: 8000 });
    };
    window.addEventListener('omnibaby-notif-error', handler);
    return () => window.removeEventListener('omnibaby-notif-error', handler);
  }, [showToast]);

  // Thème appliqué au document, recalculé chaque minute
  useEffect(() => {
    const apply = () => {
      const t = computeTheme(store.settings);
      document.documentElement.setAttribute('data-theme', t);
      setTheme(t);
    };
    apply();
    const interval = setInterval(apply, 60 * 1000);
    return () => clearInterval(interval);
  }, [store.settings]);

  const stopNight = () => update((d) => {
    if (d.settings.nightMode === true) d.settings.nightMode = false;
    else d.settings.nightSnoozeUntil = nextMorning();
    return d;
  });

  // Minuteur terminé : l'entrée est déjà enregistrée par le minuteur.
  // « Modifier » demande l'ouverture de cette entrée dans le Journal.
  const handleTimerFinish = (entry) => {
    setTimerRunning(false);
    setActiveTab('journal');
    if (entry?.edit && entry.id) setJournalIntent({ kind: 'edit', entryId: entry.id });
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'journal': return <JournalTab intent={journalIntent} clearIntent={() => setJournalIntent(null)} />;
      case 'sante': return <SanteTab />;
      case 'dodo': return <DodoTab openFormExternal={openDodoForm} setOpenFormExternal={setOpenDodoForm} />;
      case 'outils':
        return (
          <OutilsTab
            openToolKey={openToolKey}
            setOpenToolKey={setToolKey}
            onTimerFinish={handleTimerFinish}
          />
        );
      case 'reglages':
        return <ReglagesTab onOpenFamille={() => { setActiveTab('outils'); setOpenToolKey('famille'); }} />;
      default: return null;
    }
  };

  // Bouton + : seulement s'il y a un bébé et le droit d'écrire
  const fabAction = !activeChild || !canEdit ? null
    : activeTab === 'journal' ? () => setJournalIntent({ kind: 'new', prefill: null })
    : activeTab === 'dodo' ? () => setOpenDodoForm(true)
    : null;

  const userName = firebaseUser?.displayName || firebaseUser?.email?.split('@')[0];

  return (
    <div className={`app-shell ${testMode ? 'test-mode' : ''}`}>
      <header className="app-topbar">
        <div className="app-topbar-left">
          {activeTab === 'reglages' ? (
            <div className="app-topbar-title">Réglages</div>
          ) : (
            <button className="topbar-child" onClick={() => setChildSwitcherOpen(true)}
              aria-label={activeChild ? `Enfant actif : ${activeChild.nom}. Changer d'enfant` : "Choisir l'enfant"}>
              <span className="app-topbar-title">OmniBaby</span>
              {activeChild && (
                <span className="app-topbar-sub">
                  {activeChild.isTest && <span className="test-badge">TEST</span>}
                  <span className="topbar-child-name">
                    {activeChild.nom}{activeChild.birthdate ? ` · ${formatAge(activeChild.birthdate)}` : ''}
                  </span>
                  <Icon name="chevronDown" size={14} strokeWidth={2.4} />
                </span>
              )}
            </button>
          )}
        </div>
        <div className="topbar-actions">
          {theme === 'night' && (
            <button className="night-mode-badge" onClick={stopNight} aria-label="Mode nuit actif. Toucher pour l'arrêter jusqu'à demain matin.">
              <Icon name="moon" size={14} /> Nuit
            </button>
          )}

          {firebaseUser && !testMode && (
            <button className="user-pill" onClick={() => setActivityOpen(true)} aria-label="Activité des parents">
              <span className="user-pill-avatar">{initials(userName)}</span>
              <span className="user-pill-text">
                <span className="user-pill-name">{userName}</span>
                <span className="user-pill-status"><span className={`sync-dot ${syncStatus}`} />{SYNC_TEXT[syncStatus] || SYNC_TEXT.offline}</span>
              </span>
            </button>
          )}

          <button
            className={`topbar-icon-btn ${activeTab === 'reglages' ? 'on' : ''}`}
            onClick={() => setActiveTab(activeTab === 'reglages' ? 'journal' : 'reglages')}
            aria-label={activeTab === 'reglages' ? 'Fermer les réglages' : 'Réglages'}
          >
            <Icon name={activeTab === 'reglages' ? 'x' : 'gear'} size={20} />
          </button>
        </div>
      </header>

      {testMode && activeTab !== 'reglages' && <TestModeBanner />}

      <main className="app-content">
        {isFirstLoad && store.familyId && firebaseUser ? (
          <SkeletonLoader />
        ) : (
          <div key={activeTab} className="tab-content-enter">{renderTab()}</div>
        )}
      </main>

      {fabAction && (
        <button className="fab" onClick={fabAction} aria-label={activeTab === 'dodo' ? 'Ajouter un sommeil' : 'Nouvelle entrée'}>
          <Icon name="plus" size={26} strokeWidth={2.5} />
        </button>
      )}

      <nav className="app-tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            aria-current={activeTab === t.key ? 'page' : undefined}
          >
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
            {t.key === 'outils' && timerRunning && <span className="tab-dot" />}
          </button>
        ))}
      </nav>

      <ChildSwitcherSheet open={childSwitcherOpen} onClose={() => setChildSwitcherOpen(false)}
        onCreateTest={() => setTestFormOpen(true)} canEdit={canEdit} />
      <TestChildForm open={testFormOpen} onClose={() => setTestFormOpen(false)} />
      <ActivityReport open={activityOpen} onClose={() => setActivityOpen(false)} firebaseUser={firebaseUser} store={store} />
      {showExitHint && <div className="exit-hint">Appuie à nouveau pour quitter</div>}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <ModalStackProvider>
          <AuthGate>
            <AppShell />
          </AuthGate>
        </ModalStackProvider>
      </ToastProvider>
    </StoreProvider>
  );
}
