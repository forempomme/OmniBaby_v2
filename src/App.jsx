import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore, getActiveChild } from './store.jsx';
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
  { key: 'reglages', label: 'Réglages', icon: '⚙️' },
];

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
function AppShell() {
  const { store } = useStore();
  const [activeTab, setActiveTab] = useState('journal');
  const [childSwitcherOpen, setChildSwitcherOpen] = useState(false);
  const [openEntryForm, setOpenEntryForm] = useState(false);
  const [formPrefill, setFormPrefill] = useState(null);
  const [openToolKey, setOpenToolKey] = useState(null);

  const activeChild = getActiveChild(store);
  const { showExitHint } = useAndroidBack({ activeTab, setActiveTab, defaultTab: 'journal' });

  // ---- Theme handling (manual or auto 21h-7h) ----
  useEffect(() => {
    const applyTheme = () => {
      let dark;
      if (store.settings.dark === null || store.settings.dark === undefined) {
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
  }, [store.settings.dark]);

  const openNewEntry = () => {
    setFormPrefill(null);
    setOpenEntryForm(true);
  };

  const handleTimerFinish = (prefill) => {
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
      case 'sante':
        return <SanteTab />;
      case 'dodo':
        return <DodoTab />;
      case 'outils':
        return (
          <OutilsTab
            openToolKey={openToolKey}
            setOpenToolKey={setOpenToolKey}
            onTimerFinish={handleTimerFinish}
          />
        );
      case 'reglages':
        return <ReglagesTab onOpenFamille={() => { setActiveTab('outils'); setOpenToolKey('famille'); }} />;
      default:
        return null;
    }
  };

  const showFab = activeTab === 'journal';

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <div className="app-topbar-left">
          {/* Icône app à côté du titre */}
          <img
            src="./icon.png"
            alt="OmniBaby"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
          <div>
            <div className="app-topbar-title">OmniBaby</div>
            <div className="app-topbar-sub">Suivi bébé hors-ligne</div>
          </div>
        </div>
        <div className="flex-row">
          {store.children.length > 1 && activeChild && (
            <button className="child-switcher" onClick={() => setChildSwitcherOpen(true)}>
              <span className="emoji">{activeChild.emoji || '👶'}</span>
              <span className="name">{activeChild.nom}</span>
            </button>
          )}
          <span className="app-version-badge">v{APP_VERSION}</span>
        </div>
      </div>

      <div className="app-content">{renderTab()}</div>

      {showFab && (
        <button className="fab" onClick={openNewEntry}>＋</button>
      )}

      <div className="app-tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <ChildSwitcher open={childSwitcherOpen} onClose={() => setChildSwitcherOpen(false)} />

      {showExitHint && <div className="exit-hint">Appuyez à nouveau pour quitter</div>}
    </div>
  );
}

// ----------------------------------------------------------------------
// Root component
// ----------------------------------------------------------------------
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
