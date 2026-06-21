import React, { useState, useRef } from 'react';
import { useStore, genId, formatAge } from './store.jsx';
import { toISODate, useToast, ConfirmInline, exportPDF, shareJSON, Accordion } from './utils.jsx';
import { Modal } from './Modal.jsx';
import { APP_VERSION } from './version.js';
import { auth, db, doc, updateDoc } from './firebase.js';
import { isBiometricAvailable } from './Auth.jsx';
import { deleteUser } from 'firebase/auth';

const EMOJIS = ['👶', '👧', '👦', '🧒', '👼'];

const ALIMENTATION_OPTIONS = [
  { key: 'allaitement', label: '🤱 Allaitement' },
  { key: 'mixte', label: '🤱🍼 Mixte' },
  { key: 'lait_infantile', label: '🍼 Lait infantile' },
];

const TYPE_LAIT_OPTIONS = [
  { key: '1er_age', label: '1er âge' },
  { key: '2e_age', label: '2e âge' },
  { key: 'croissance', label: 'Croissance' },
];

// ----------------------------------------------------------------------
// Formulaire enfant
// ----------------------------------------------------------------------
function childDefaults() {
  return {
    nom: '', emoji: '👶', sexe: 'fille', birthdate: toISODate(),
    alimentation: 'allaitement', typeLait: '1er_age',
    allergies: '', groupeSanguin: '', medecinNom: '', medecinTel: '',
    contactUrgenceNom: '', contactUrgenceTel: '', notesMedicales: '',
  };
}

function ChildForm({ open, onClose, editing }) {
  const { update } = useStore();
  const showToast = useToast();
  const [form, setForm] = useState(childDefaults());
  const [tab, setTab] = useState('general');

  React.useEffect(() => {
    if (open) { setForm(editing ? { ...childDefaults(), ...editing } : childDefaults()); setTab('general'); }
  }, [open, editing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.nom.trim()) { showToast('Entre un prénom', '⚠️'); return; }
    update((draft) => {
      if (editing) {
        const idx = draft.children.findIndex((c) => c.id === editing.id);
        if (idx !== -1) draft.children[idx] = { ...draft.children[idx], ...form, id: editing.id };
      } else {
        const id = genId();
        draft.children.push({ ...childDefaults(), ...form, id, lastVitDDate: null });
        if (!draft.activeChildId) draft.activeChildId = id;
      }
      return draft;
    });
    showToast(editing ? 'Profil modifié' : 'Profil créé', '✅');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier le profil' : 'Nouveau profil enfant'} icon="👶">
      <div className="chip-row">
        {['general','medical','urgence'].map(t => (
          <button key={t} className={`chip ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t==='general'?'Général':t==='medical'?'Médical':'Urgence'}
          </button>
        ))}
      </div>

      {tab === 'general' && <>
        <div className="field"><label>Prénom</label>
          <input type="text" value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Léa" autoFocus /></div>
        <div className="field"><label>Emoji</label>
          <div className="pill-group">{EMOJIS.map(e => (
            <button key={e} className={`pill-choice ${form.emoji===e?'selected':''}`} onClick={() => set('emoji', e)} style={{ fontSize:'1.2rem' }}>{e}</button>
          ))}</div></div>
        <div className="field"><label>Sexe</label>
          <div className="pill-group">
            <button className={`pill-choice ${form.sexe==='fille'?'selected':''}`} onClick={() => set('sexe','fille')}>Fille</button>
            <button className={`pill-choice ${form.sexe==='garcon'?'selected':''}`} onClick={() => set('sexe','garcon')}>Garçon</button>
          </div></div>
        <div className="field"><label>Date de naissance</label>
          <input type="date" value={form.birthdate} onChange={(e) => set('birthdate', e.target.value)} /></div>
        <div className="field"><label>Alimentation</label>
          <div className="pill-group">{ALIMENTATION_OPTIONS.map(o => (
            <button key={o.key} className={`pill-choice ${form.alimentation===o.key?'selected':''}`} onClick={() => set('alimentation', o.key)}>{o.label}</button>
          ))}</div></div>
        {form.alimentation !== 'allaitement' && (
          <div className="field"><label>Type de lait</label>
            <div className="pill-group">{TYPE_LAIT_OPTIONS.map(o => (
              <button key={o.key} className={`pill-choice ${form.typeLait===o.key?'selected':''}`} onClick={() => set('typeLait', o.key)}>{o.label}</button>
            ))}</div></div>
        )}
      </>}

      {tab === 'medical' && <>
        <div className="field"><label>Allergies</label>
          <textarea rows={2} value={form.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Aucune connue" /></div>
        <div className="field"><label>Groupe sanguin</label>
          <input type="text" value={form.groupeSanguin} onChange={(e) => set('groupeSanguin', e.target.value)} placeholder="Ex : O+" /></div>
        <div className="field"><label>Médecin / pédiatre</label>
          <input type="text" value={form.medecinNom} onChange={(e) => set('medecinNom', e.target.value)} placeholder="Dr Martin" /></div>
        <div className="field"><label>Téléphone du médecin</label>
          <input type="tel" value={form.medecinTel} onChange={(e) => set('medecinTel', e.target.value)} placeholder="06 00 00 00 00" /></div>
        <div className="field"><label>Notes médicales</label>
          <textarea rows={3} value={form.notesMedicales} onChange={(e) => set('notesMedicales', e.target.value)} placeholder="Traitements en cours, particularités..." /></div>
      </>}

      {tab === 'urgence' && <>
        <div className="field"><label>Contact d'urgence — nom</label>
          <input type="text" value={form.contactUrgenceNom} onChange={(e) => set('contactUrgenceNom', e.target.value)} placeholder="Mamie Jeanne" /></div>
        <div className="field"><label>Contact d'urgence — téléphone</label>
          <input type="tel" value={form.contactUrgenceTel} onChange={(e) => set('contactUrgenceTel', e.target.value)} placeholder="06 00 00 00 00" /></div>
        <div className="muted" style={{ fontSize:'0.8rem' }}>Ces informations apparaissent dans la fiche Urgence pour une baby-sitter.</div>
      </>}

      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        {editing ? 'Enregistrer ✓' : 'Créer le profil ✓'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Section profils enfants
// ----------------------------------------------------------------------
function ChildrenSection({ canEdit, embedded = false }) {
  const { store, update } = useStore();
  const showToast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const handleDelete = (id) => {
    update((draft) => {
      draft.children = draft.children.filter((c) => c.id !== id);
      if (draft.activeChildId === id) draft.activeChildId = draft.children[0]?.id || null;
      return draft;
    });
    showToast('Profil supprimé', '🗑️');
  };

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <div className="section-title" style={{ margin: 0, display: embedded ? 'none' : 'flex' }}>👶 Profils enfants</div>
        {canEdit && <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Ajouter</button>}
      </div>

      {store.children.length === 0 ? (
        <div className="empty-state" style={{ padding:'24px 12px' }}>
          <div className="emoji">👶</div>
          <div className="desc">Aucun profil enfant. Crée le premier profil pour commencer.</div>
        </div>
      ) : (
        <div className="entry-list">
          {store.children.map((c) => (
            <div key={c.id} className="swipe-content" style={{ cursor:'pointer' }}
              onClick={() => canEdit && (setEditing(c), setFormOpen(true))}>
              <div className="entry-icon" style={{ background:'var(--primary-soft)', color:'var(--primary-deep)', fontSize:'1.2rem' }}>{c.emoji||'👶'}</div>
              <div className="entry-body">
                <div className="entry-title">{c.nom}
                  {c.id === store.activeChildId && <span style={{ color:'var(--primary)', fontWeight:700 }}> · actif</span>}
                </div>
                <div className="entry-sub">{formatAge(c.birthdate)} · {c.sexe==='garcon'?'Garçon':'Fille'}</div>
              </div>
              {canEdit && (
                <div style={{ display:'flex', gap:6 }} onClick={e => e.stopPropagation()}>
                  {c.id !== store.activeChildId && (
                    <button className="btn btn-ghost btn-sm" onClick={() => update(d => { d.activeChildId=c.id; return d; })}>Activer</button>
                  )}
                  {store.children.length > 1 && <ConfirmInline onConfirm={() => handleDelete(c.id)} />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <ChildForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} editing={editing} />
    </div>
  );
}

// ----------------------------------------------------------------------
// Section synchronisation Firebase
// ----------------------------------------------------------------------
function SyncSection({ embedded = false }) {
  const { store, firebaseUser, syncStatus, logout } = useStore();
  const showToast = useToast();
  const [showCode, setShowCode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const STATUS = {
    offline: { text:'Hors-ligne', color:'var(--text-faint)' },
    syncing: { text:'Synchronisation...', color:'var(--accent-sun)' },
    synced:  { text:'Synchronisé', color:'var(--accent-sage)' },
    error:   { text:'Erreur de sync', color:'var(--danger)' },
  };
  const st = STATUS[syncStatus] || STATUS.offline;

  const handleDeleteAccount = async () => {
    try {
      if (auth.currentUser) await deleteUser(auth.currentUser);
      logout();
      showToast('Compte supprimé', '✅');
    } catch (e) {
      showToast('Reconnecte-toi avant de supprimer le compte', '⚠️');
    }
    setDeleteConfirm(false);
  };

  if (!firebaseUser) {
    return (
      <div className={embedded ? '' : 'card appear'}>
        <div className="section-title" style={{ display: embedded?'none':'flex', marginBottom:8 }}>☁️ Synchronisation</div>
        <div className="muted" style={{ fontSize:'.82rem', marginBottom:12 }}>
          Connecte-toi pour partager les données en temps réel avec le deuxième parent.
        </div>
        <button className="btn btn-primary btn-block" onClick={() => window.__showFirebaseLogin?.()}>
          Se connecter / Créer un compte
        </button>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ display: embedded?'none':'flex', marginBottom:8 }}>☁️ Synchronisation</div>

      {/* Compte connecté */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'.86rem' }}>{firebaseUser.displayName || firebaseUser.email}</div>
          <div style={{ fontSize:'.72rem', color:st.color, marginTop:2, fontWeight:600 }}>● {st.text}</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={logout}>Déconnexion</button>
      </div>

      {/* Code famille */}
      {store.familyCode && (
        <div style={{ background:'var(--primary-soft)', borderRadius:'var(--radius-md)', padding:'10px 12px', marginBottom:12 }}>
          <div style={{ fontSize:'.72rem', color:'var(--primary-deep)', fontWeight:700, marginBottom:4 }}>
            Code d'invitation famille
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.3rem', fontWeight:700, letterSpacing:6, color:'var(--primary-deep)', textAlign:'center' }}>
            {showCode ? store.familyCode : '••••••'}
          </div>
          <button onClick={() => setShowCode(s=>!s)} style={{ display:'block', margin:'6px auto 0', background:'none', border:'none', color:'var(--primary-deep)', fontSize:'.72rem', cursor:'pointer', fontFamily:'inherit' }}>
            {showCode ? 'Masquer' : 'Afficher le code'}
          </button>
        </div>
      )}

      <div className="muted" style={{ fontSize:'.72rem', marginBottom:12 }}>
        Sync en temps réel entre tous les appareils. Fonctionne aussi hors-ligne.
      </div>

      {/* Supprimer le compte */}
      {!deleteConfirm ? (
        <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(true)}>
          Supprimer mon compte Firebase
        </button>
      ) : (
        <div style={{ background:'var(--danger-soft)', borderRadius:'var(--radius-md)', padding:'10px 12px' }}>
          <div style={{ fontWeight:600, fontSize:'.82rem', marginBottom:8 }}>
            Supprimer définitivement le compte ? Les données cloud seront inaccessibles.
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(false)}>Annuler</button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount}>Confirmer</button>
          </div>
        </div>
      )}
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
    <div className={embedded ? '' : 'card appear'} style={{ marginTop: embedded?12:0 }}>
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

      {/* Heure bascule automatique */}
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
            Retour en mode clair à 7h dans tous les cas
          </div>
        </div>
      )}

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
  const set = (key, val) => update(d => { d.settings[key] = val; return d; });

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ display:embedded?'none':'flex', marginBottom:6 }}>⚙️ Saisie</div>
      <div className="field">
        <label>Quantité par défaut biberon (ml)</label>
        <div className="pill-group">
          {[60, 90, 120, 150, 180].map(ml => (
            <button key={ml} className={`pill-choice ${(s.defaultBiberonMl||120)===ml?'selected':''}`}
              onClick={() => set('defaultBiberonMl', ml)}>{ml}</button>
          ))}
        </div>
        <div className="muted" style={{ fontSize:'.72rem', marginTop:4 }}>
          Pré-remplit le champ quantité lors d'un nouveau biberon
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
  const { store, update, replaceStore, resetStore } = useStore();
  const showToast = useToast();
  const fileInputRef = useRef(null);
  const [resetStep, setResetStep] = useState(0);

  const lastExport = store.settings.lastExportDate;
  const needsBackup = !lastExport || (new Date() - new Date(lastExport)) / 86400000 > 7;

  const handleExport = async () => {
    try {
      await shareJSON(store);
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
      try { replaceStore(JSON.parse(reader.result)); showToast('Sauvegarde importée', '📥'); }
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
// Main ReglagesTab
// ----------------------------------------------------------------------
export default function ReglagesTab({ onOpenFamille }) {
  const { store, session } = useStore();
  const role = store.users.find(u => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role === 'admin';

  return (
    <div>
      <Accordion icon="👶" title="Profils enfants" badge={store.children.length||null} defaultOpen={true} stateKey="reg.enfants">
        <ChildrenSection canEdit={canEdit} embedded />
      </Accordion>

      <Accordion icon="☁️" title="Synchronisation" defaultOpen={false} stateKey="reg.sync">
        <SyncSection embedded />
      </Accordion>

      <Accordion icon="🔐" title="Biométrie & Apparence" defaultOpen={false} stateKey="reg.bio">
        <BiometricSection embedded />
        <AppearanceSection embedded />
      </Accordion>

      <Accordion icon="⚙️" title="Saisie" defaultOpen={false} stateKey="reg.behavior">
        <BehaviorSection embedded />
      </Accordion>

      <Accordion icon="🔔" title="Notifications" defaultOpen={false} stateKey="reg.notifs">
        <NotificationsSection embedded />
      </Accordion>

      <Accordion icon="👨‍👩‍👧" title="Famille" defaultOpen={false} stateKey="reg.famille">
        <div className="flex-between" style={{ marginBottom:8 }}>
          <div className="muted" style={{ fontSize:'.85rem' }}>Utilisateurs, rôles, code d'invitation.</div>
          <button className="btn btn-secondary btn-sm" onClick={onOpenFamille}>Gérer →</button>
        </div>
      </Accordion>

      <Accordion icon="💾" title="Données" defaultOpen={false} stateKey="reg.data">
        <DataSection canEdit={canEdit} embedded />
      </Accordion>

      <Accordion icon="ℹ️" title="À propos" defaultOpen={false} stateKey="reg.about">
        <div style={{ padding:'4px 0' }}>
          {[
            { label:'Application', val:'OmniBaby' },
            { label:'Version', val:`v${APP_VERSION}` },
            { label:'Sources médicales', val:'OMS · PNNS4 · HCSP 2020' },
            { label:'Données', val:'Locales + Firebase' },
            { label:'Publicités', val:'Aucune' },
          ].map((r, i, arr) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0',
              borderBottom: i<arr.length-1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize:'.84rem', color:'var(--text-soft)' }}>{r.label}</span>
              <span style={{ fontSize:'.84rem', fontWeight:600 }}>{r.val}</span>
            </div>
          ))}
        </div>
      </Accordion>
    </div>
  );
}
