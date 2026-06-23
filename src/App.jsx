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
// Rapport d'activité parent — variante B : Stats + double filtre + timeline
// ----------------------------------------------------------------------
function ActivityReport({ open, onClose, firebaseUser, store }) {
  const [filterType, setFilterType] = React.useState('tous');
  const [filterWho, setFilterWho] = React.useState('tous');

  if (!open) return null;

  const userUid = firebaseUser?.uid;
  const userName = firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Moi';

  // Construire la liste de toutes les actions tracées
  const allItems = React.useMemo(() => {
    const items = [];
    const ICONS = { biberon:'🍼', couche:'🧷', sommeil:'🌙', autre:'📝' };

    for (const e of store.entries || []) {
      if (!e.createdBy && !e.updatedBy) continue;
      const child = store.children.find(c => c.id === e.childId);
      const isMe = e.createdBy === userUid || e.updatedBy === userUid;
      items.push({
        date: e.updatedAt || e.createdAt || e.date,
        icon: ICONS[e.type] || '📝',
        typeKey: e.type,
        label: e.type === 'biberon' ? 'Biberon' : e.type === 'couche' ? 'Couche' : e.type === 'sommeil' ? 'Sommeil' : 'Note',
        detail: e.mode === 'biberon' && e.quantite ? `${e.quantite} ml` : e.type === 'couche' && e.contenu ? e.contenu : '',
        action: e.updatedBy ? 'edited' : 'added',
        author: e.updatedByName || e.createdByName || userName,
        isMe,
        child: child?.nom,
        childEmoji: child?.emoji || '👶',
      });
    }
    for (const m of store.mesures || []) {
      if (!m.createdBy) continue;
      const child = store.children.find(c => c.id === m.childId);
      items.push({
        date: m.createdAt || m.date,
        icon: m.type === 'poids' ? '⚖️' : m.type === 'taille' ? '📏' : '🧠',
        typeKey: 'mesure',
        label: m.type === 'poids' ? 'Poids' : m.type === 'taille' ? 'Taille' : 'Périmètre',
        detail: m.valeur ? `${m.valeur} ${m.type === 'poids' ? 'kg' : 'cm'}` : '',
        action: 'added',
        author: m.createdByName || userName,
        isMe: m.createdBy === userUid,
        child: child?.nom,
        childEmoji: child?.emoji || '👶',
      });
    }
    for (const s of store.sommeils || []) {
      if (!s.createdBy) continue;
      const child = store.children.find(c => c.id === s.childId);
      const dur = s.duree ? `${Math.floor(s.duree/60)}h${String(s.duree%60).padStart(2,'0')}` : '';
      items.push({
        date: s.createdAt || s.debut,
        icon: s.type === 'nuit' ? '🌃' : '☀️',
        typeKey: 'sommeil',
        label: s.type === 'nuit' ? 'Nuit' : 'Sieste',
        detail: dur,
        action: 'added',
        author: s.createdByName || userName,
        isMe: s.createdBy === userUid,
        child: child?.nom,
        childEmoji: child?.emoji || '👶',
      });
    }
    for (const t of store.temperatures || []) {
      if (!t.createdBy) continue;
      const child = store.children.find(c => c.id === t.childId);
      items.push({
        date: t.createdAt || t.date,
        icon: '🌡️', typeKey: 'temperature', label: 'Température',
        detail: t.valeur ? `${t.valeur}°C` : '',
        action: 'added',
        author: t.createdByName || userName,
        isMe: t.createdBy === userUid,
        child: child?.nom,
        childEmoji: child?.emoji || '👶',
      });
    }

    return items.filter(i => i.date).sort((a,b) => a.date < b.date ? 1 : -1);
  }, [store, userUid, userName]);

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diffH = Math.floor((new Date() - d) / 3600000);
    if (diffH < 1) return "< 1h";
    if (diffH < 24) return `${diffH}h`;
    if (diffH < 48) return 'Hier';
    if (diffH < 168) return d.toLocaleDateString('fr-FR', { weekday:'short' });
    return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
  };

  // Stats globales
  const myItems = allItems.filter(i => i.isMe);
  const otherItems = allItems.filter(i => !i.isMe);
  const otherAuthors = [...new Set(otherItems.map(i => i.author))];

  // Filtrage
  const TYPE_FILTERS = [
    { k:'tous', l:'Tout' },
    { k:'biberon', l:'🍼 Biberons' },
    { k:'couche', l:'🧷 Changes' },
    { k:'sommeil', l:'🌙 Sommeil' },
    { k:'mesure', l:'📏 Mesures' },
    { k:'temperature', l:'🌡️ Fièvre' },
  ];
  const WHO_FILTERS = [
    { k:'tous', l:'Tous' },
    { k:'me', l:`👤 ${userName}` },
    ...otherAuthors.map(a => ({ k: a, l: `👤 ${a}` })),
  ];

  const shown = allItems
    .filter(i => filterType === 'tous' || i.typeKey === filterType)
    .filter(i => filterWho === 'tous' || (filterWho === 'me' ? i.isMe : i.author === filterWho))
    .slice(0, 60);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,.45)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: '20px 20px 0 0',
        maxHeight: '85%', display: 'flex', flexDirection: 'column',
        animation: 'slide-up .25s cubic-bezier(.25,1,.5,1)',
      }}>
        {/* Handle */}
        <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'10px auto 0', flexShrink:0 }} />

        {/* Header fixe */}
        <div style={{ padding:'10px 16px 8px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem' }}>
              Activite — 7 derniers jours
            </div>
            <button onClick={onClose} style={{
              width:30, height:30, borderRadius:'50%', background:'var(--surface-2)',
              border:'none', fontSize:'.85rem', color:'var(--text-soft)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>✕</button>
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${2 + otherAuthors.length},1fr)`, gap:6, marginBottom:10 }}>
            <div style={{ textAlign:'center', padding:'6px 4px', background:'var(--surface)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'1rem', color:'var(--primary-deep)' }}>{allItems.length}</div>
              <div style={{ fontSize:'.58rem', color:'var(--text-soft)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.3px', marginTop:2 }}>Total</div>
            </div>
            <div style={{ textAlign:'center', padding:'6px 4px', background:'var(--accent-sage-soft)', borderRadius:'var(--radius-md)', border:'1px solid var(--accent-sage)' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'1rem', color:'var(--accent-sage)' }}>{myItems.length}</div>
              <div style={{ fontSize:'.58rem', color:'var(--accent-sage)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.3px', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userName}</div>
            </div>
            {otherAuthors.map((a, i) => (
              <div key={i} style={{ textAlign:'center', padding:'6px 4px', background:'var(--accent-sky-soft)', borderRadius:'var(--radius-md)', border:'1px solid var(--accent-sky)' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'1rem', color:'var(--accent-sky)' }}>{otherItems.filter(x=>x.author===a).length}</div>
                <div style={{ fontSize:'.58rem', color:'var(--accent-sky)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.3px', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a}</div>
              </div>
            ))}
          </div>

          {/* Filtre type */}
          <div style={{ display:'flex', gap:5, overflowX:'auto', paddingBottom:4, marginBottom:4 }}>
            {TYPE_FILTERS.map(f => (
              <button key={f.k} onClick={() => setFilterType(f.k)} style={{
                flexShrink:0, padding:'4px 10px', borderRadius:'var(--radius-pill)', fontSize:'.68rem',
                fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'1.5px solid',
                background: filterType===f.k ? 'var(--primary)' : 'var(--surface)',
                color: filterType===f.k ? '#fff' : 'var(--text-soft)',
                borderColor: filterType===f.k ? 'var(--primary)' : 'var(--border)',
              }}>{f.l}</button>
            ))}
          </div>

          {/* Filtre parent */}
          <div style={{ display:'flex', gap:5, overflowX:'auto', paddingBottom:2 }}>
            {WHO_FILTERS.map(f => (
              <button key={f.k} onClick={() => setFilterWho(f.k)} style={{
                flexShrink:0, padding:'4px 10px', borderRadius:'var(--radius-pill)', fontSize:'.68rem',
                fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'1.5px solid',
                background: filterWho===f.k ? 'var(--primary-deep)' : 'var(--surface)',
                color: filterWho===f.k ? '#fff' : 'var(--text-soft)',
                borderColor: filterWho===f.k ? 'var(--primary-deep)' : 'var(--border)',
              }}>{f.l}</button>
            ))}
          </div>
        </div>

        {/* Timeline scrollable */}
        <div style={{ overflow:'auto', padding:'0 16px 24px' }}>
          {shown.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-soft)' }}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>📋</div>
              <div style={{ fontSize:'.85rem' }}>
                {allItems.length === 0
                  ? 'Aucune action tracee. Les nouvelles entrees apparaitront ici.'
                  : 'Aucun resultat pour ce filtre.'}
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase',
                letterSpacing:'.5px', color:'var(--text-faint)', padding:'10px 0 4px' }}>
                {shown.length} action{shown.length > 1 ? 's' : ''}
              </div>
              {shown.map((item, i) => (
                <div key={i} style={{
                  display:'flex', alignItems:'flex-start', gap:10,
                  padding:'8px 0', borderBottom:'1px solid var(--border)',
                }}>
                  {/* Icône colorée selon auteur */}
                  <div style={{
                    width:34, height:34, borderRadius:'50%', flexShrink:0,
                    background: item.isMe ? 'var(--accent-sage-soft)' : 'var(--accent-sky-soft)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.9rem',
                  }}>{item.icon}</div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:'.82rem', display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                      {item.label}
                      {item.child && (
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:3,
                          padding:'1px 7px', borderRadius:'var(--radius-pill)',
                          background:'var(--primary-soft)', color:'var(--primary-deep)',
                          fontSize:'.62rem', fontWeight:700,
                        }}>{item.childEmoji} {item.child}</span>
                      )}
                    </div>
                    <div style={{ fontSize:'.68rem', color:'var(--text-soft)', marginTop:2, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                      <span style={{
                        padding:'1px 6px', borderRadius:'var(--radius-pill)', fontSize:'.62rem', fontWeight:700,
                        background: item.action==='added' ? 'var(--accent-sage-soft)' : 'var(--accent-sun-soft)',
                        color: item.action==='added' ? 'var(--accent-sage)' : 'var(--accent-sun)',
                      }}>
                        {item.action==='added' ? '✍️ Ajoute' : '✏️ Modifie'}
                      </span>
                      <span style={{ color: item.isMe ? 'var(--accent-sage)' : 'var(--accent-sky)', fontWeight:700 }}>
                        {item.author}
                      </span>
                      {item.detail && <><span>·</span><span>{item.detail}</span></>}
                    </div>
                  </div>

                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'.68rem', color:'var(--text-faint)', flexShrink:0, marginTop:2 }}>
                    {fmtDate(item.date)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


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
  const [activityOpen, setActivityOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [currentTheme, setCurrentTheme] = React.useState('light');

  // Suivre le thème actuel pour le badge nuit dans la topbar
  React.useEffect(() => {
    const sync = () => setCurrentTheme(document.documentElement.getAttribute('data-theme') || 'light');
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
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

  // Écouter les erreurs de sync Firebase et les afficher en toast
  useEffect(() => {
    const handler = (e) => {
      // showToast n'est pas accessible ici, on utilise un event custom
      console.warn('[Firebase sync error]', e.detail);
    };
    window.addEventListener('firebase-sync-error', handler);
    return () => window.removeEventListener('firebase-sync-error', handler);
  }, []);

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
  // Calculer le thème actuel : 'light' | 'dark' | 'night'
  const computeTheme = React.useCallback(() => {
    const { dark, darkHour, nightMode, nightHour } = store.settings || {};
    const hour = new Date().getHours();

    // Mode nuit forcé manuellement
    if (nightMode === true) return 'night';

    // Mode nuit automatique
    if (nightMode === null || nightMode === undefined) {
      const nh = nightHour ?? 22;
      if (hour >= nh || hour < 7) return 'night';
    }

    // Mode sombre
    if (dark === null || dark === undefined) {
      const dh = darkHour ?? 21;
      if (hour >= dh || hour < 7) return 'dark';
      return 'light';
    }
    return dark ? 'dark' : 'light';
  }, [store.settings]);

  useEffect(() => {
    const applyTheme = () => {
      const theme = computeTheme();
      document.documentElement.setAttribute('data-theme', theme);
    };
    applyTheme();
    const interval = setInterval(applyTheme, 60 * 1000); // check toutes les minutes
    return () => clearInterval(interval);
  }, [computeTheme]);

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

          {/* Indicateur parent connecté + statut sync — cliquable pour rapport d'activité */}
          {firebaseUser && (
            <div
              onClick={() => setActivityOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,.15)',
                borderRadius: 'var(--radius-pill)',
                padding: '3px 8px 3px 4px',
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,.1)',
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

          {/* Badge mode nuit — cliquable pour activer/désactiver */}
          {currentTheme === 'night' && (
            <button
              className="night-mode-badge"
              onClick={() => update(d => {
                d.settings.nightMode = d.settings.nightMode === true ? false : true;
                return d;
              })}
              title="Mode nuit actif — tap pour désactiver"
            >
              🌙 Nuit
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
      <ActivityReport
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        firebaseUser={firebaseUser}
        store={store}
      />
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
