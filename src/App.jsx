import React, { useState, useEffect, useMemo } from 'react';
import { StoreProvider, useStore, getActiveChild, filterByActiveChild, formatAge } from './store.jsx';
import { ToastProvider } from './utils.jsx';
import { ModalStackProvider, useAndroidBack, Modal } from './Modal.jsx';
import AuthGate, { avatarColor } from './Auth.jsx';
import JournalTab from './Journal.jsx';
import SanteTab from './Sante.jsx';
import DodoTab from './Dodo.jsx';
import OutilsTab from './Outils.jsx';
import ReglagesTab from './Reglages.jsx';
import { APP_VERSION } from './version.js';

const TABS = [
  { key: 'journal', label: 'Journal', icon: '📓' },
  { key: 'sante', label: 'Santé', icon: '📈' },
  { key: 'dodo', label: 'Dodo', icon: '🌙' },
  { key: 'outils', label: 'Outils', icon: '🛠️' },
];

// ----------------------------------------------------------------------
// Placeholder tabs (built in later steps)
// ----------------------------------------------------------------------
function PlaceholderTab({ icon, title, desc }) {
  return (
    <div className="empty-state">
      <div className="emoji">{icon}</div>
      <div className="title">{title}</div>
      <div className="desc">{desc}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Child switcher modal
// ----------------------------------------------------------------------
function ChildSwitcher({ open, onClose }) {
  const { store, update } = useStore();

  const select = (id) => {
    update((draft) => {
      draft.activeChildId = id;
      return draft;
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Choisir un enfant" icon="👶">
      <div className="entry-list">
        {store.children.map((c) => (
          <button
            key={c.id}
            className="swipe-content"
            style={{ width: '100%', cursor: 'pointer', border: c.id === store.activeChildId ? '1.5px solid var(--primary)' : '1px solid var(--border)' }}
            onClick={() => select(c.id)}
          >
            <div className="entry-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary-deep)' }}>
              {c.emoji || '👶'}
            </div>
            <div className="entry-body">
              <div className="entry-title">{c.nom}</div>
            </div>
            {c.id === store.activeChildId && <div style={{ color: 'var(--primary)' }}>✓</div>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// App shell content (after auth)
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// Skeleton loader — affiché pendant le chargement initial Firebase
// ----------------------------------------------------------------------
function SkeletonLoader() {
  return (
    <div className="skeleton-list">
      {/* Stamps skeleton */}
      <div className="skeleton-stamp-row">
        {[1,2,3].map(i => <div key={i} className="skeleton skeleton-stamp" />)}
      </div>
      {/* Entrées skeleton */}
      {[1,2,3,4].map(i => (
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

function AppShell() {
  const { store, firebaseUser, syncStatus } = useStore();
  const [activeTab, setActiveTab] = useState('journal');
  const [childSwitcherOpen, setChildSwitcherOpen] = useState(false);
  const [openEntryForm, setOpenEntryForm] = useState(false);
  const [formPrefill, setFormPrefill] = useState(null);
  const [openToolKey, setOpenToolKey] = useState(null);
  const [openDodoForm, setOpenDodoForm] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Masquer le skeleton après le premier cycle de sync Firebase
  useEffect(() => {
    if (syncStatus === 'synced' || syncStatus === 'offline') {
      // Délai court pour laisser le rendu se stabiliser
      const t = setTimeout(() => setIsFirstLoad(false), 300);
      return () => clearTimeout(t);
    }
  }, [syncStatus]);

  const activeChild = getActiveChild(store);
  const { showExitHint } = useAndroidBack({ activeTab, setActiveTab, defaultTab: 'journal' });

  // Reminder vitamine D
  const childEntries = useMemo(
    () => filterByActiveChild(store.entries || [], store.activeChildId),
    [store.entries, store.activeChildId]
  );
  const showVitDReminder = useMemo(() => {
    if (!activeChild?.birthdate) return false;
    const ageM = Math.floor((new Date() - new Date(activeChild.birthdate)) / (1000 * 60 * 60 * 24 * 30.44));
    if (ageM >= 24) return false;
    const today = new Date().toISOString().slice(0, 10);
    return !childEntries.some((e) => e.type === 'biberon' && e.vitamineD && e.date?.slice(0, 10) === today);
  }, [childEntries, activeChild]);

  // Thème auto
  useEffect(() => {
    const applyTheme = () => {
      let dark;
      if (store.settings?.dark === null || store.settings?.dark === undefined) {
        const hour = new Date().getHours();
        dark = hour >= 21 || hour < 7;
      } else {
        dark = !!store.settings.dark;
      }
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    };
    applyTheme();
    const interval = setInterval(applyTheme, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [store.settings?.dark]);

  const openNewEntry = () => { setFormPrefill(null); setOpenEntryForm(true); };

  const handleTimerFinish = (prefill) => {
    setTimerRunning(false);
    setFormPrefill(prefill);
    setActiveTab('journal');
    setOpenEntryForm(true);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'journal':
        return (
          <JournalTab
            openEntryForm={openEntryForm}
            setOpenEntryForm={setOpenEntryForm}
            formPrefill={formPrefill}
            onTimerFinished={() => setFormPrefill(null)}
          />
        );
      case 'sante':  return <SanteTab />;
      case 'dodo':   return <DodoTab openFormExternal={openDodoForm} setOpenFormExternal={setOpenDodoForm} />;
      case 'outils':
        return (
          <OutilsTab
            openToolKey={openToolKey}
            setOpenToolKey={setOpenToolKey}
            onTimerFinish={handleTimerFinish}
            onTimerStart={() => setTimerRunning(true)}
          />
        );
      case 'reglages':
        return <ReglagesTab onOpenFamille={() => { setActiveTab('outils'); setOpenToolKey('famille'); }} />;
      default: return null;
    }
  };

  // FAB contextuel selon l'onglet
  const fabAction = activeTab === 'journal' ? openNewEntry
    : activeTab === 'dodo' ? () => setOpenDodoForm(true)
    : null;

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <div className="app-topbar-left">
          <div>
            <div className="app-topbar-title">OmniBaby</div>
            <div className="app-topbar-sub">
              {activeChild
                ? `${activeChild.emoji || '👶'} ${activeChild.nom}${activeChild.birthdate ? ' · ' + formatAge(activeChild.birthdate) : ''}`
                : 'Suivi bébé hors-ligne'}
            </div>
          </div>
        </div>
        <div className="flex-row" style={{ gap: 6 }}>

          {/* Reminder vitamine D */}
          {showVitDReminder && (
            <button
              className="child-switcher"
              style={{ background: 'var(--accent-sun)', color: '#fff', border: 'none', gap: 4 }}
              onClick={() => { setFormPrefill({ type: 'biberon' }); setOpenEntryForm(true); setActiveTab('journal'); }}
            >
              <span>💊</span>
              <span className="name" style={{ fontSize: '.7rem' }}>Vit. D</span>
            </button>
          )}

          {/* Indicateur parent connecté + statut sync */}
          {firebaseUser && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,.15)',
              borderRadius: 'var(--radius-pill)',
              padding: '3px 8px 3px 4px',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(255,255,255,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '.65rem', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {(firebaseUser.displayName || firebaseUser.email || '?').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{
                  fontSize: '.68rem', fontWeight: 700, color: '#fff',
                  maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {firebaseUser.displayName || firebaseUser.email?.split('@')[0]}
                </span>
                <span style={{ fontSize: '.58rem', color: 'rgba(255,255,255,.75)', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    background: syncStatus === 'synced' ? '#4CAF50'
                      : syncStatus === 'syncing' ? '#FFC107'
                      : syncStatus === 'error' ? '#f44336'
                      : 'rgba(255,255,255,.4)',
                  }} />
                  {syncStatus === 'synced' ? 'Synchronisé'
                    : syncStatus === 'syncing' ? 'Sync...'
                    : syncStatus === 'error' ? 'Erreur'
                    : 'Hors-ligne'}
                </span>
              </div>
            </div>
          )}

          {store.children.length > 1 && activeChild && (
            <button className="child-switcher" onClick={() => setChildSwitcherOpen(true)}>
              <span className="emoji">{activeChild.emoji || '👶'}</span>
              <span className="name">{activeChild.nom}</span>
            </button>
          )}

          {/* Réglages */}
          <button
            onClick={() => setActiveTab('reglages')}
            style={{
              background: activeTab === 'reglages' ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.12)',
              border: 'none', borderRadius: 'var(--radius-md)', width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', cursor: 'pointer', flexShrink: 0,
            }}
            aria-label="Réglages"
          >⚙️</button>

        </div>
      </div>

      <div className="app-content">
        {isFirstLoad && store.familyId ? (
          <SkeletonLoader />
        ) : (
          <div key={activeTab} className="tab-content-enter">
            {renderTab()}
          </div>
        )}
      </div>

      {fabAction && <button className="fab" onClick={fabAction}>＋</button>}

      <div className="app-tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            style={{ position: 'relative' }}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {t.key === 'outils' && timerRunning && (
              <span style={{
                position: 'absolute', top: 4, right: 6,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--primary)', border: '1.5px solid var(--surface)',
                animation: 'pulse 1.5s infinite',
              }} />
            )}
          </button>
        ))}
      </div>

      <ChildSwitcher open={childSwitcherOpen} onClose={() => setChildSwitcherOpen(false)} />
      {showExitHint && <div className="exit-hint">Appuyez à nouveau pour quitter</div>}
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
