import React, { useState, useRef } from 'react';
import { useStore, formatAge, HISTORY_WINDOW_DAYS } from './store.jsx';
import { readsToday } from './readCounter.js';
import { toISODate, useToast, exportPDF, shareJSON, shareText, formatElapsed, Accordion } from './utils.jsx';
import { APP_VERSION } from './version.js';
import { auth, deleteUser } from './firebase.js';
import { isBiometricAvailable, AuthOverlay, initials } from './Auth.jsx';
import ChildForm from './ChildForm.jsx';
import { Icon } from './icons.jsx';
import { TestChildForm, DeleteChildModal, OrphanSection } from './ChildManager.jsx';
import { childDataCounts, totalCount } from './children.js';

// ----------------------------------------------------------------------
// Bébé : profils enfants
// ----------------------------------------------------------------------
function ChildrenSection({ canEdit }) {
  const { store, update } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [testFormOpen, setTestFormOpen] = useState(false);
  const [danger, setDanger] = useState(null); // { child, mode: 'delete' | 'clear' }
  const hasTest = store.children.some((c) => c.isTest);
  const activate = (id) => update((d) => { d.activeChildId = id; return d; });

  return (
    <div className="kids">
      {store.children.length === 0 && (
        <div className="muted" style={{ fontSize: '.85rem', padding: '4px 0 10px' }}>Aucun profil enfant pour l'instant.</div>
      )}
      {store.children.map((c) => {
        const active = c.id === store.activeChildId;
        const n = totalCount(childDataCounts(store, c.id));
        if (c.isTest) {
          return (
            <div key={c.id} className="kid-card is-test">
              <div className="kid-row">
                <span className="kid-avatar"><Icon name="flask" size={18} /></span>
                <span className="kid-body">
                  <span className="kid-name">{c.nom} <span className="test-badge">TEST</span>{active && <span className="kid-active"> · actif</span>}</span>
                  <span className="kid-sub">{formatAge(c.birthdate)} · {n} donnée{n > 1 ? 's' : ''}{store.familyId ? ' · synchronisé' : ''}</span>
                </span>
              </div>
              {canEdit && (
                <div className="kid-actions">
                  <button className="btn btn-sm kid-btn-main" disabled={active} onClick={() => activate(c.id)}>{active ? 'Actif' : 'Activer'}</button>
                  <button className="btn btn-sm kid-btn-outline" disabled={!n} onClick={() => setDanger({ child: c, mode: 'clear' })}>Vider</button>
                  <button className="btn btn-sm kid-btn-danger" onClick={() => setDanger({ child: c, mode: 'delete' })}>Supprimer</button>
                </div>
              )}
            </div>
          );
        }
        return (
          <div key={c.id} className="kid-card">
            <div className="kid-row">
              <span className="kid-avatar">{(c.nom || '?').slice(0, 1).toUpperCase()}</span>
              <span className="kid-body">
                <span className="kid-name">{c.nom}{active && <span className="kid-active"> · actif</span>}</span>
                <span className="kid-sub">{formatAge(c.birthdate)} · {c.sexe === 'garcon' ? 'Garçon' : 'Fille'} · {n} donnée{n > 1 ? 's' : ''}</span>
              </span>
            </div>
            {canEdit && (
              <div className="kid-actions">
                <button className="btn btn-sm kid-btn-outline" onClick={() => { setEditing(c); setFormOpen(true); }}>Modifier</button>
                {!active && <button className="btn btn-sm kid-btn-outline" onClick={() => activate(c.id)}>Activer</button>}
                <button className="btn btn-sm kid-btn-danger" onClick={() => setDanger({ child: c, mode: 'delete' })}>Supprimer</button>
              </div>
            )}
          </div>
        );
      })}
      {canEdit && (
        <div className="kid-add">
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Ajouter un enfant</button>
          {!hasTest && <button className="btn btn-sm dashed-btn-sm" onClick={() => setTestFormOpen(true)}>＋ Profil test</button>}
        </div>
      )}
      <ChildForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} editing={editing} />
      <TestChildForm open={testFormOpen} onClose={() => setTestFormOpen(false)} />
      {danger && <DeleteChildModal child={danger.child} mode={danger.mode} onClose={() => setDanger(null)} />}
    </div>
  );
}

// ----------------------------------------------------------------------
// Famille & synchro : membres, code d'invitation, compte, profils PIN
// ----------------------------------------------------------------------
const SYNC_LABELS = {
  offline: { text: 'Hors-ligne', color: 'var(--text-faint)' },
  syncing: { text: 'Synchronisation…', color: 'var(--accent-sun)' },
  synced: { text: 'Synchronisé', color: 'var(--accent-sage)' },
  error: { text: 'Erreur de synchro', color: 'var(--danger)' },
};

// Lectures Firestore de ce téléphone aujourd'hui (estimation haute)
function ReadsCounter() {
  const { historyStatus, loadHistory } = useStore();
  const [reads, setReads] = useState(() => readsToday());
  React.useEffect(() => {
    const h = () => setReads(readsToday());
    window.addEventListener('omnibaby-reads', h);
    const t = setInterval(h, 60000); // passage à minuit
    return () => { window.removeEventListener('omnibaby-reads', h); clearInterval(t); };
  }, []);
  const pct = Math.min(100, (reads / 50000) * 100);
  return (
    <div className="reads-box">
      <div className="flex-between">
        <span style={{ fontWeight: 600, fontSize: '.86rem' }}>Lectures Firebase aujourd'hui</span>
        <span className="reads-value">≈ {reads.toLocaleString('fr-FR')}</span>
      </div>
      <div className="reads-bar"><span style={{ width: `${Math.max(pct, reads > 0 ? 1 : 0)}%` }} /></div>
      <div className="muted" style={{ fontSize: '.72rem', marginTop: 6, lineHeight: 1.4 }}>
        Ce téléphone, estimation haute. Gratuit jusqu'à 50 000 / jour pour toute la famille.
        Synchro continue : {HISTORY_WINDOW_DAYS} derniers jours ; historique ancien {historyStatus === 'complete' ? 'chargé' : 'chargé à la demande'}.
      </div>
      {historyStatus !== 'complete' && (
        <button className="btn btn-outline btn-sm mt-8" onClick={() => loadHistory()} disabled={historyStatus === 'loading'}>
          {historyStatus === 'loading' ? 'Chargement…' : "Charger l'historique complet"}
        </button>
      )}
    </div>
  );
}

function FamilySection({ onOpenFamille }) {
  const { store, firebaseUser, syncStatus, logout } = useStore();
  const showToast = useToast();
  const [showCode, setShowCode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [authMode, setAuthMode] = useState(null); // 'login' | 'join' | null
  const st = SYNC_LABELS[syncStatus] || SYNC_LABELS.offline;

  const handleDeleteAccount = async () => {
    try {
      if (auth.currentUser) await deleteUser(auth.currentUser);
      await logout();
      showToast('Compte supprimé', '✅');
    } catch (e) {
      showToast('Reconnecte-toi avant de supprimer le compte', '⚠️');
    }
    setDeleteConfirm(false);
  };

  const shareCode = async () => {
    const r = await shareText(
      `Rejoins notre famille sur OmniBaby : ouvre l'appli, choisis « Rejoindre une famille » et entre le code ${store.familyCode}.`,
      'Invitation OmniBaby'
    );
    if (r === 'copied') showToast('Invitation copiée', '📋');
  };

  const members = store.members?.length
    ? store.members
    : (firebaseUser ? [{ uid: firebaseUser.uid, displayName: firebaseUser.displayName, email: firebaseUser.email, role: 'admin' }] : []);

  return (
    <div>
      {!firebaseUser ? (
        <>
          <div className="muted" style={{ fontSize: '.85rem', marginBottom: 12 }}>
            Connecte un compte pour partager le journal avec l'autre parent, en temps réel.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setAuthMode('login')}>Se connecter / créer un compte</button>
            <button className="btn btn-outline btn-sm" onClick={() => setAuthMode('join')}>Rejoindre une famille</button>
          </div>
        </>
      ) : (
        <>
          <div className="member-list">
            {members.map((m) => {
              const isMe = m.uid === firebaseUser.uid;
              return (
                <div key={m.uid} className="member-row">
                  <span className="member-avatar">{initials(m.displayName || m.email)}</span>
                  <span className="member-body">
                    <span className="member-name">{m.displayName || m.email?.split('@')[0]}</span>
                    <span className="member-role">{m.role === 'admin' ? 'Admin' : 'Éditeur'}{isMe ? ' · toi' : ''}</span>
                  </span>
                  <span className="member-seen" style={isMe ? { color: st.color } : undefined}>
                    {isMe ? st.text : m.lastSeenAt ? `vu il y a ${formatElapsed(Date.now() - m.lastSeenAt)}` : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {store.familyCode && (
            <div className="invite-row">
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span className="muted" style={{ fontSize: '.75rem' }}>Code d'invitation</span>
                <button className="invite-code" onClick={() => setShowCode((v) => !v)} aria-label={showCode ? 'Masquer le code' : 'Afficher le code'}>
                  {showCode ? store.familyCode : '•• •• ••'}
                </button>
              </span>
              <button className="btn btn-outline btn-sm" onClick={shareCode}>Partager</button>
            </div>
          )}

          {store.familyId && <ReadsCounter />}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={logout}>Déconnexion</button>
            {!deleteConfirm && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteConfirm(true)}>Supprimer mon compte</button>}
          </div>
          {deleteConfirm && (
            <div style={{ background: 'var(--danger-soft)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginTop: 10 }}>
              <div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: 8 }}>
                Supprimer définitivement ton compte ? Les données de la famille restent accessibles aux autres membres.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(false)}>Annuler</button>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount}>Confirmer</button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex-between" style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '.86rem' }}>Profils de ce téléphone</div>
          <div className="muted" style={{ fontSize: '.75rem', marginTop: 2 }}>Code PIN, couleur, rôle ({store.users.length})</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onOpenFamille}>Gérer</button>
      </div>

      {authMode && <AuthOverlay mode={authMode} onClose={() => setAuthMode(null)} />}
    </div>
  );
}

// ----------------------------------------------------------------------
// Section biométrie
// ----------------------------------------------------------------------
function BiometricSection({ embedded = false }) {
  const { store, update } = useStore();
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
        if (await isBiometricAvailable()) { setAvailable(true); setChecked(true); return; }
        await new Promise(r => setTimeout(r, 300));
      }
      setChecked(true);
    };
    check();
    return () => { cancelled = true; };
  }, []);

  if (!checked || !available) return null;
  const enabled = store.settings?.biometrie !== false;

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ display:embedded?'none':'flex', marginBottom:6 }}>🔐 Biométrie</div>
      <div className="flex-between" style={{ padding:'8px 0' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'.86rem' }}>Connexion par empreinte digitale</div>
          <div className="muted" style={{ fontSize:'.72rem', marginTop:2 }}>Déverrouille l'app sans saisir le code PIN</div>
        </div>
        <button className={`switch ${enabled?'on':'off'}`}
          onClick={() => update(d => { d.settings.biometrie = !enabled; return d; })} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Section apparence
// ----------------------------------------------------------------------
function AppearanceSection({ embedded = false }) {
  const { store, update } = useStore();
  const s = store.settings || {};

  const set = (key, val) => update(d => { d.settings[key] = val; return d; });

  return (
    <div className={embedded ? '' : 'card appear'} style={{ marginTop: embedded ? 4 : 0 }}>
      <div className="section-title" style={{ display:embedded?'none':'flex', marginBottom:6 }}>🎨 Apparence</div>

      {/* Thème */}
      <div className="field">
        <label>Thème</label>
        <div className="pill-group">
          <button className={`pill-choice ${s.dark==null?'selected':''}`} onClick={() => set('dark', null)}>🌗 Auto</button>
          <button className={`pill-choice ${s.dark===false?'selected':''}`} onClick={() => set('dark', false)}>☀️ Clair</button>
          <button className={`pill-choice ${s.dark===true?'selected':''}`} onClick={() => set('dark', true)}>🌙 Sombre</button>
        </div>
      </div>

       {/* Heure bascule automatique sombre */}
       {s.dark == null && (
         <div className="field">
           <label>Heure de passage en mode sombre</label>
           <div className="pill-group">
             {[{h:20,l:'20h'},{h:21,l:'21h'},{h:22,l:'22h'},{h:23,l:'23h'}].map(o => (
               <button key={o.h} className={`pill-choice ${(s.darkHour||21)===o.h?'selected':''}`}
                 onClick={() => set('darkHour', o.h)}>{o.l}</button>
             ))}
           </div>
           <div className="muted" style={{ fontSize:'.72rem', marginTop:4 }}>
             Retour en mode clair à 7h
           </div>
         </div>
       )}

       {/* Mode nuit */}
       <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, marginTop:8 }}>
         <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:2 }}>🌙 Mode nuit</div>
         <div className="muted" style={{ fontSize:'.72rem', marginBottom:10 }}>
           Fond quasi-noir et texte agrandi — idéal pour les tétées nocturnes sans allumer la lumière.
         </div>
         <div className="field">
           <label>Activation</label>
           <div className="pill-group">
             <button className={`pill-choice ${s.nightMode===false?'selected':''}`}
               onClick={() => set('nightMode', false)}>Désactivé</button>
             <button className={`pill-choice ${(s.nightMode===null||s.nightMode===undefined)?'selected':''}`}
               onClick={() => set('nightMode', null)}>🌗 Auto</button>
             <button className={`pill-choice ${s.nightMode===true?'selected':''}`}
               onClick={() => set('nightMode', true)}>🌙 Toujours</button>
           </div>
         </div>
         {(s.nightMode === null || s.nightMode === undefined) && (
           <div className="field">
             <label>Heure d'activation automatique</label>
             <div className="pill-group">
               {[{h:21,l:'21h'},{h:22,l:'22h'},{h:23,l:'23h'}].map(o => (
                 <button key={o.h} className={`pill-choice ${(s.nightHour||22)===o.h?'selected':''}`}
                   onClick={() => set('nightHour', o.h)}>{o.l}</button>
               ))}
             </div>
             <div className="muted" style={{ fontSize:'.72rem', marginTop:4 }}>
               Retour au thème habituel à 7 h · touche le badge « Nuit » en haut de l'écran pour l'arrêter jusqu'au matin
             </div>
           </div>
         )}
       </div>


      {/* Vue compacte */}
      <div className="flex-between" style={{ padding:'10px 0', borderTop:'1px solid var(--border)', marginTop:4 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'.86rem' }}>Vue compacte du Journal</div>
          <div className="muted" style={{ fontSize:'.72rem', marginTop:2 }}>Entrées condensées sur une ligne</div>
        </div>
        <button className={`switch ${s.journalCompact?'on':'off'}`}
          onClick={() => set('journalCompact', !s.journalCompact)} />
      </div>

    </div>
  );
}

// ----------------------------------------------------------------------
// Section saisie & comportement
// ----------------------------------------------------------------------
function BehaviorSection({ embedded = false }) {
  const { store, update } = useStore();
  const s = store.settings || {};
  const [ml, setMl] = useState(String(s.defaultBiberonMl ?? 120));
  React.useEffect(() => { setMl(String(s.defaultBiberonMl ?? 120)); }, [s.defaultBiberonMl]);
  const set = (key, val) => update(d => { d.settings[key] = val; return d; });

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ display:embedded?'none':'flex', marginBottom:6 }}>⚙️ Saisie</div>
      <div className="field">
        <label>Quantité par défaut biberon (ml)</label>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input
            type="number"
            inputMode="numeric"
            min="10"
            max="500"
            value={ml}
            onChange={(e) => setMl(e.target.value)}
            onBlur={() => {
              // Valeur partagée avec l'autre parent : écrite une seule fois, à la sortie du champ
              const val = parseInt(ml, 10);
              const clamped = isNaN(val) ? 120 : Math.min(500, Math.max(10, val));
              setMl(String(clamped));
              if (clamped !== s.defaultBiberonMl) set('defaultBiberonMl', clamped);
            }}
            style={{ width: 90, textAlign:'center', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'1rem' }}
          />
          <span style={{ fontSize:'.82rem', color:'var(--text-soft)' }}>ml</span>
        </div>
        <div className="muted" style={{ fontSize:'.72rem', marginTop:4 }}>
          Pré-remplit le champ quantité lors d'un nouveau biberon (10–500 ml)
        </div>
      </div>

      <div className="flex-between" style={{ padding:'10px 0', borderTop:'1px solid var(--border)' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'.86rem' }}>Confirmer les suppressions</div>
          <div className="muted" style={{ fontSize:'.72rem', marginTop:2 }}>
            Demander confirmation avant tout effacement dans le journal
          </div>
        </div>
        <button className={`switch ${s.confirmDelete!==false?'on':'off'}`}
          onClick={() => set('confirmDelete', s.confirmDelete===false ? true : false)} />
      </div>

      <div className="flex-between" style={{ padding:'10px 0', borderTop:'1px solid var(--border)' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'.86rem' }}>Glisser pour supprimer</div>
          <div className="muted" style={{ fontSize:'.72rem', marginTop:2 }}>
            Swipe gauche sur une entrée pour faire apparaître la corbeille
          </div>
        </div>
        <button className={`switch ${s.swipeToDelete!==false?'on':'off'}`}
          onClick={() => set('swipeToDelete', s.swipeToDelete===false ? true : false)} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Section notifications
// ----------------------------------------------------------------------
const NOTIF_LABELS = {
  biberon: { label:'Biberon / tétée', icon:'🍼' },
  couche:  { label:'Couche', icon:'🧷' },
  sommeil: { label:'Sommeil', icon:'🌙' },
  vaccin:  { label:'Vaccins', icon:'💉' },
  medoc:   { label:'Médicaments', icon:'💊' },
  activite:{ label:'Activités / rappels', icon:'🎯' },
};

function NotificationsSection({ embedded = false }) {
  const { store, update } = useStore();
  const toggle = (key) => update(d => { d.settings.notifs[key] = !d.settings.notifs[key]; return d; });

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ display:embedded?'none':'flex', marginBottom:6 }}>🔔 Notifications</div>
      <div className="muted" style={{ fontSize:'.8rem', marginBottom:10 }}>
        Préférences utilisées par les modules Rappels et Médicaments.
      </div>
      {Object.entries(NOTIF_LABELS).map(([key, def]) => (
        <div key={key} className="flex-between" style={{ padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.85rem' }}>{def.icon} {def.label}</span>
          <button className={`switch ${store.settings.notifs[key]?'on':''}`} onClick={() => toggle(key)} />
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// Section données
// ----------------------------------------------------------------------
function DataSection({ canEdit, embedded = false }) {
  const { store, update, replaceStore, resetStore, loadHistory, getStore } = useStore();
  const showToast = useToast();
  const fileInputRef = useRef(null);
  const [resetStep, setResetStep] = useState(0);

  const lastExport = store.settings.lastExportDate;
  const needsBackup = !lastExport || (new Date() - new Date(lastExport)) / 86400000 > 7;

  const handleExport = async () => {
    try {
      // La sauvegarde doit contenir tout l'historique, pas seulement 60 jours
      const complete = await loadHistory();
      if (!complete) showToast('Historique ancien indisponible hors connexion : sauvegarde partielle', '⚠️');
      await shareJSON(getStore());
      update(d => { d.settings.lastExportDate = toISODate(); return d; });
      showToast('Export partagé', '📤');
    } catch (e) { if (e.name !== 'AbortError') showToast('Erreur export : ' + e.message, '⚠️'); }
  };

  const handleExportPDF = async () => {
    const child = store.children.find(c => c.id === store.activeChildId);
    if (!child) { showToast('Aucun enfant actif', '⚠️'); return; }
    try { await exportPDF(store, child); showToast('PDF généré', '📄'); }
    catch (e) { showToast('Erreur PDF : ' + e.message, '⚠️'); }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { replaceStore(JSON.parse(String(reader.result))); showToast('Sauvegarde importée', '📥'); }
      catch { showToast('Fichier invalide', '⚠️'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ display:embedded?'none':'flex', marginBottom:6 }}>💾 Données</div>

      {needsBackup && (
        <div className="card" style={{ background:'var(--accent-sun-soft)', border:'none', marginBottom:12 }}>
          <div style={{ fontWeight:600, fontSize:'.85rem' }}>⚠️ Pense à sauvegarder</div>
          <div className="muted" style={{ fontSize:'.8rem', marginTop:4 }}>
            {lastExport ? `Dernière sauvegarde : ${lastExport}` : 'Aucune sauvegarde effectuée.'}
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
        <button className="btn btn-primary btn-sm" onClick={handleExport}>📤 Exporter JSON</button>
        <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>📄 PDF pédiatre</button>
        {canEdit && <>
          <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>📥 Importer JSON</button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display:'none' }} onChange={handleImport} />
        </>}
      </div>

      {canEdit && <>
        <div className="divider" />
        <div style={{ fontWeight:600, fontSize:'.85rem', marginBottom:6, color:'var(--danger)' }}>🔄 Réinitialisation complète</div>
        <div className="muted" style={{ fontSize:'.8rem', marginBottom:10 }}>
          Efface toutes les données locales. Irréversible.
        </div>
        {resetStep === 0 && <button className="btn btn-danger btn-sm" onClick={() => setResetStep(1)}>Réinitialiser l'application</button>}
        {resetStep === 1 && (
          <div className="card" style={{ background:'var(--danger-soft)', border:'none' }}>
            <div style={{ fontWeight:600, fontSize:'.85rem', marginBottom:8 }}>Es-tu sûr(e) ? Toutes les données seront perdues.</div>
            <div className="flex-row">
              <button className="btn btn-ghost btn-sm" onClick={() => setResetStep(0)}>Annuler</button>
              <button className="btn btn-danger btn-sm" onClick={() => setResetStep(2)}>Continuer</button>
            </div>
          </div>
        )}
        {resetStep === 2 && (
          <div className="card" style={{ background:'var(--danger-soft)', border:'none' }}>
            <div style={{ fontWeight:600, fontSize:'.85rem', marginBottom:8 }}>Dernière confirmation — tout effacer ?</div>
            <div className="flex-row">
              <button className="btn btn-ghost btn-sm" onClick={() => setResetStep(0)}>Annuler</button>
              <button className="btn btn-danger btn-sm" onClick={() => { resetStore(); setResetStep(0); }}>✕ Tout effacer</button>
            </div>
          </div>
        )}
      </>}
    </div>
  );
}

// ----------------------------------------------------------------------
// Onglet Réglages — 5 sections
// ----------------------------------------------------------------------
export default function ReglagesTab({ onOpenFamille }) {
  const { store, session, firebaseUser, syncStatus } = useStore();
  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role === 'admin';
  const s = store.settings || {};
  const active = store.children.find((c) => c.id === store.activeChildId);

  const realKids = store.children.filter((c) => !c.isTest);
  const testKid = store.children.find((c) => c.isTest);
  const mainKid = active && !active.isTest ? active : realKids[0];
  const babySub = [
    mainKid ? `${mainKid.nom} · ${formatAge(mainKid.birthdate)}` : 'Aucun profil',
    realKids.length > 1 ? `${realKids.length} enfants` : null,
    testKid ? `1 profil test${active?.isTest ? ' (actif)' : ''}` : null,
  ].filter(Boolean).join(' · ');
  const famSub = firebaseUser
    ? `${Math.max(1, store.members?.length || 0)} parent${(store.members?.length || 0) > 1 ? 's' : ''} · ${(SYNC_LABELS[syncStatus] || SYNC_LABELS.offline).text.toLowerCase()}`
    : 'Non connecté · données sur ce téléphone';
  const theme = s.dark == null ? 'Thème auto' : s.dark ? 'Thème sombre' : 'Thème clair';
  const night = s.nightMode === false ? 'nuit off' : s.nightMode === true ? 'nuit toujours' : `nuit ${s.nightHour || 22} h`;
  const prefSub = `${theme} · ${night} · ${s.defaultBiberonMl || 120} ml${s.biometrie !== false ? ' · empreinte' : ''}`;
  const notifCount = Object.values(s.notifs || {}).filter(Boolean).length;

  return (
    <div>
      <Accordion iconName="baby" title="Bébé" subtitle={babySub} stateKey="reg.bebe">
        <ChildrenSection canEdit={canEdit} />
      </Accordion>

      <Accordion iconName="users" title="Famille & synchro" subtitle={famSub} stateKey="reg.famille">
        <FamilySection onOpenFamille={onOpenFamille} />
      </Accordion>

      <Accordion iconName="sliders" title="Préférences" subtitle={prefSub} stateKey="reg.prefs">
        <BiometricSection embedded />
        <AppearanceSection embedded />
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          <BehaviorSection embedded />
        </div>
      </Accordion>

      <Accordion iconName="bell" title="Rappels & notifications" subtitle={`${notifCount} type${notifCount > 1 ? 's' : ''} activé${notifCount > 1 ? 's' : ''}`} stateKey="reg.notifs">
        <NotificationsSection embedded />
      </Accordion>

      <Accordion iconName="database" title="Sauvegarde & export" subtitle={`JSON, PDF pédiatre, nettoyage · v${APP_VERSION}`} stateKey="reg.data">
        <DataSection canEdit={canEdit} embedded />
        {canEdit && (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
            <OrphanSection />
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 4 }}>
          {[
            { label: 'Version', val: `v${APP_VERSION}` },
            { label: 'Sources médicales', val: 'OMS · PNNS4 · HCSP' },
            { label: 'Données', val: store.familyId ? 'Téléphone + Firebase' : 'Ce téléphone uniquement' },
            { label: 'Publicités', val: 'Aucune' },
          ].map((r, i, arr) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: '.84rem', color: 'var(--text-soft)' }}>{r.label}</span>
              <span style={{ fontSize: '.84rem', fontWeight: 600 }}>{r.val}</span>
            </div>
          ))}
        </div>
      </Accordion>
    </div>
  );
}
