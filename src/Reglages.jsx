import React, { useState, useRef } from 'react';
import { useStore, genId, ageInMonths, formatAge } from './store.jsx';
import { toISODate, useToast, ConfirmInline, exportPDF } from './utils.jsx';
import { Modal } from './Modal.jsx';
import { isBiometricAvailable } from './Auth.jsx';
import { Accordion } from './utils.jsx';

const EMOJIS = ['👶', '👧', '👦', '🧒', '👼'];

const ALIMENTATION_OPTIONS = [
  { key: 'allaitement', label: '🤱 Allaitement' },
  { key: 'mixte', label: '🤱🍼 Mixte' },
  { key: 'lait_infantile', label: '🍼 Lait infantile' },
];

const TYPE_LAIT_OPTIONS = [
  { key: 'maternel', label: 'Lait maternel' },
  { key: '1er_age', label: '1er âge' },
  { key: '2e_age', label: '2e âge' },
  { key: 'croissance', label: 'Croissance' },
];

// ----------------------------------------------------------------------
// Child form (create / edit)
// ----------------------------------------------------------------------
function childDefaults() {
  return {
    nom: '',
    emoji: '👶',
    sexe: 'fille',
    birthdate: toISODate(),
    alimentation: 'allaitement',
    typeLait: 'maternel',
    allergies: '',
    groupeSanguin: '',
    medecinNom: '',
    medecinTel: '',
    contactUrgenceNom: '',
    contactUrgenceTel: '',
    notesMedicales: '',
  };
}

function ChildForm({ open, onClose, editing }) {
  const { update } = useStore();
  const showToast = useToast();
  const [form, setForm] = useState(childDefaults());
  const [tab, setTab] = useState('general');

  React.useEffect(() => {
    if (open) {
      setForm(editing ? { ...childDefaults(), ...editing } : childDefaults());
      setTab('general');
    }
  }, [open, editing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.nom.trim()) {
      showToast('Entre un prénom', '⚠️');
      return;
    }
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
        <button className={`chip ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>Général</button>
        <button className={`chip ${tab === 'medical' ? 'active' : ''}`} onClick={() => setTab('medical')}>Médical</button>
        <button className={`chip ${tab === 'urgence' ? 'active' : ''}`} onClick={() => setTab('urgence')}>Urgence</button>
      </div>

      {tab === 'general' && (
        <>
          <div className="field">
            <label>Prénom</label>
            <input type="text" value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Léa" autoFocus />
          </div>
          <div className="field">
            <label>Emoji</label>
            <div className="pill-group">
              {EMOJIS.map((e) => (
                <button key={e} className={`pill-choice ${form.emoji === e ? 'selected' : ''}`} onClick={() => set('emoji', e)} style={{ fontSize: '1.2rem' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Sexe</label>
            <div className="pill-group">
              <button className={`pill-choice ${form.sexe === 'fille' ? 'selected' : ''}`} onClick={() => set('sexe', 'fille')}>Fille</button>
              <button className={`pill-choice ${form.sexe === 'garcon' ? 'selected' : ''}`} onClick={() => set('sexe', 'garcon')}>Garçon</button>
            </div>
          </div>
          <div className="field">
            <label>Date de naissance</label>
            <input type="date" value={form.birthdate} onChange={(e) => set('birthdate', e.target.value)} />
          </div>
          <div className="field">
            <label>Alimentation</label>
            <div className="pill-group">
              {ALIMENTATION_OPTIONS.map((o) => (
                <button key={o.key} className={`pill-choice ${form.alimentation === o.key ? 'selected' : ''}`} onClick={() => set('alimentation', o.key)}>{o.label}</button>
              ))}
            </div>
          </div>
          {form.alimentation !== 'allaitement' && (
            <div className="field">
              <label>Type de lait</label>
              <div className="pill-group">
                {TYPE_LAIT_OPTIONS.filter((o) => o.key !== 'maternel').map((o) => (
                  <button key={o.key} className={`pill-choice ${form.typeLait === o.key ? 'selected' : ''}`} onClick={() => set('typeLait', o.key)}>{o.label}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'medical' && (
        <>
          <div className="field">
            <label>Allergies</label>
            <textarea rows={2} value={form.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Aucune connue" />
          </div>
          <div className="field">
            <label>Groupe sanguin</label>
            <input type="text" value={form.groupeSanguin} onChange={(e) => set('groupeSanguin', e.target.value)} placeholder="Ex : O+" />
          </div>
          <div className="field">
            <label>Médecin / pédiatre</label>
            <input type="text" value={form.medecinNom} onChange={(e) => set('medecinNom', e.target.value)} placeholder="Dr Martin" />
          </div>
          <div className="field">
            <label>Téléphone du médecin</label>
            <input type="tel" value={form.medecinTel} onChange={(e) => set('medecinTel', e.target.value)} placeholder="06 00 00 00 00" />
          </div>
          <div className="field">
            <label>Notes médicales</label>
            <textarea rows={3} value={form.notesMedicales} onChange={(e) => set('notesMedicales', e.target.value)} placeholder="Traitements en cours, particularités..." />
          </div>
        </>
      )}

      {tab === 'urgence' && (
        <>
          <div className="field">
            <label>Contact d'urgence — nom</label>
            <input type="text" value={form.contactUrgenceNom} onChange={(e) => set('contactUrgenceNom', e.target.value)} placeholder="Mamie Jeanne" />
          </div>
          <div className="field">
            <label>Contact d'urgence — téléphone</label>
            <input type="tel" value={form.contactUrgenceTel} onChange={(e) => set('contactUrgenceTel', e.target.value)} placeholder="06 00 00 00 00" />
          </div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>
            Ces informations apparaissent dans la fiche Urgence (Outils) pour une baby-sitter.
          </div>
        </>
      )}

      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        {editing ? 'Enregistrer ✓' : 'Créer le profil ✓'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Children profiles section
// ----------------------------------------------------------------------
function ChildrenSection({ canEdit, embedded = false }) {
  const { store, update } = useStore();
  const showToast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const handleDelete = (id) => {
    update((draft) => {
      draft.children = draft.children.filter((c) => c.id !== id);
      if (draft.activeChildId === id) {
        draft.activeChildId = draft.children[0]?.id || null;
      }
      return draft;
    });
    showToast('Profil supprimé', '🗑️');
  };

  const handleSetActive = (id) => {
    update((draft) => {
      draft.activeChildId = id;
      return draft;
    });
  };

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="flex-between">
        <div className="section-title" style={{ marginBottom: 0, display: embedded ? 'none' : 'flex' }}>👶 Profils enfants</div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Ajouter</button>
        )}
      </div>

      {store.children.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <div className="emoji">👶</div>
          <div className="desc">Aucun profil enfant. Crée le premier profil pour commencer à utiliser l'application.</div>
        </div>
      ) : (
        <div className="entry-list mt-16">
          {store.children.map((c) => (
            <div key={c.id} className="swipe-content" style={{ cursor: 'pointer' }} onClick={() => canEdit && (setEditing(c), setFormOpen(true))}>
              <div className="entry-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary-deep)' }}>
                {c.emoji || '👶'}
              </div>
              <div className="entry-body">
                <div className="entry-title">
                  {c.nom}
                  {c.id === store.activeChildId && <span style={{ color: 'var(--primary)', fontWeight: 700 }}> · actif</span>}
                </div>
                <div className="entry-sub">{formatAge(c.birthdate)} · {c.sexe === 'garcon' ? 'Garçon' : 'Fille'}</div>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {c.id !== store.activeChildId && (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSetActive(c.id)}>Activer</button>
                  )}
                  {store.children.length > 1 && (
                    <ConfirmInline onConfirm={() => handleDelete(c.id)} />
                  )}
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
// Biometric section
// ----------------------------------------------------------------------
function BiometricSection({ embedded = false }) {
  const { store, update } = useStore();
  const [available, setAvailable] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
        const ok = await isBiometricAvailable();
        if (ok) { setAvailable(true); setChecked(true); return; }
        await new Promise((r) => setTimeout(r, 300));
      }
      setChecked(true);
    };
    check();
    return () => { cancelled = true; };
  }, []);

  // Ne rien afficher tant que la vérification n'est pas terminée
  if (!checked) return null;
  // Cacher la section si biométrie non disponible sur cet appareil
  if (!available) return null;

  const enabled = store.settings?.biometrie !== false;

  const toggle = () => {
    update((draft) => {
      if (!draft.settings) draft.settings = {};
      draft.settings.biometrie = !enabled;
      return draft;
    });
  };

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ marginBottom: 6, display: embedded ? 'none' : 'flex' }}>🔐 Biométrie</div>
      <div className="flex-between" style={{ padding: '8px 0' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Connexion par empreinte digitale</div>
          <div className="muted" style={{ fontSize: '0.72rem', marginTop: 2 }}>
            Déverrouille l'app sans saisir le code PIN
          </div>
        </div>
        <button className={`switch ${enabled ? 'on' : 'off'}`} onClick={toggle} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Appearance section (theme)
// ----------------------------------------------------------------------
function AppearanceSection({ embedded = false }) {
  const { store, update } = useStore();

  const setDark = (value) => {
    update((draft) => {
      draft.settings.dark = value;
      return draft;
    });
  };

  const current = store.settings.dark;

  return (
    <div className={embedded ? '' : 'card appear'} style={{ marginTop: embedded ? 12 : 0 }}>
      <div className="section-title" style={{ marginBottom: 6, display: embedded ? 'none' : 'flex' }}>🎨 Apparence</div>
      <div className="pill-group mt-8">
        <button className={`pill-choice ${current === null || current === undefined ? 'selected' : ''}`} onClick={() => setDark(null)}>
          🌗 Auto (21h-7h)
        </button>
        <button className={`pill-choice ${current === false ? 'selected' : ''}`} onClick={() => setDark(false)}>
          ☀️ Clair
        </button>
        <button className={`pill-choice ${current === true ? 'selected' : ''}`} onClick={() => setDark(true)}>
          🌙 Sombre
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Notifications section
// ----------------------------------------------------------------------
const NOTIF_LABELS = {
  biberon: { label: 'Biberon / tétée', icon: '🍼' },
  couche: { label: 'Couche', icon: '🧷' },
  sommeil: { label: 'Sommeil', icon: '🌙' },
  vaccin: { label: 'Vaccins', icon: '💉' },
  medoc: { label: 'Médicaments', icon: '💊' },
  activite: { label: 'Activités / rappels', icon: '🎯' },
};

function NotificationsSection({ embedded = false }) {
  const { store, update } = useStore();

  const toggle = (key) => {
    update((draft) => {
      draft.settings.notifs[key] = !draft.settings.notifs[key];
      return draft;
    });
  };

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ marginBottom: 6, display: embedded ? 'none' : 'flex' }}>🔔 Notifications</div>
      <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
        Préférences utilisées par les modules Rappels et Médicaments.
      </div>
      {Object.entries(NOTIF_LABELS).map(([key, def]) => (
        <div key={key} className="flex-between" style={{ padding: '8px 0' }}>
          <span className="flex-row">{def.icon} {def.label}</span>
          <button className={`switch ${store.settings.notifs[key] ? 'on' : ''}`} onClick={() => toggle(key)} />
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// Data section: export / import / reset
// ----------------------------------------------------------------------
function DataSection({ canEdit, embedded = false }) {
  const { store, update, replaceStore, resetStore } = useStore();
  const showToast = useToast();
  const fileInputRef = useRef(null);
  const [resetStep, setResetStep] = useState(0);

  const lastExport = store.settings.lastExportDate;
  const needsBackup = !lastExport || (new Date() - new Date(lastExport)) / (1000 * 60 * 60 * 24) > 7;

  const handleExport = async () => {
    const data = JSON.stringify(store, null, 2);
    const filename = `omnibaby-export-${toISODate()}.json`;

    // Sur Android (Capacitor), utiliser l'API de partage native
    // qui permet de choisir où enregistrer le fichier (Drive, Messages, etc.)
    if (navigator.share && navigator.canShare) {
      try {
        const blob = new Blob([data], { type: 'application/json' });
        const file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Sauvegarde OmniBaby',
            text: `Données OmniBaby exportées le ${toISODate()}`,
          });
          update((draft) => { draft.settings.lastExportDate = toISODate(); return draft; });
          showToast('Partage ouvert', '📤');
          return;
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          // Partage annulé par l'utilisateur — ne pas afficher d'erreur
        } else {
          return;
        }
      }
    }

    // Fallback navigateur desktop : téléchargement direct
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    update((draft) => { draft.settings.lastExportDate = toISODate(); return draft; });
    showToast('Export téléchargé', '📤');
  };

  const handleExportPDF = async () => {
    const activeChild = store.children.find((c) => c.id === store.activeChildId);
    if (!activeChild) { showToast('Aucun enfant actif', '⚠️'); return; }
    try {
      await exportPDF(store, activeChild);
      showToast('PDF généré', '📄');
    } catch (e) {
      showToast('Erreur PDF : ' + e.message, '⚠️');
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        replaceStore(parsed);
        showToast('Sauvegarde importée', '📥');
      } catch (err) {
        showToast('Fichier invalide', '⚠️');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    resetStore();
    setResetStep(0);
  };

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ marginBottom: 6, display: embedded ? 'none' : 'flex' }}>💾 Données</div>

      {needsBackup && (
        <div className="card" style={{ background: 'var(--accent-sun-soft)', border: 'none', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>⚠️ Pense à sauvegarder</div>
          <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            {lastExport ? `Dernière sauvegarde : ${lastExport}` : 'Aucune sauvegarde effectuée pour le moment.'}
          </div>
        </div>
      )}

      <div className="flex-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={handleExport}>📤 Exporter JSON</button>
        <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>📄 PDF pédiatre</button>
        {canEdit && (
          <>
            <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>📥 Importer un JSON</button>
            <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
          </>
        )}
      </div>

      {canEdit && (
        <>
          <div className="divider" />
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6, color: 'var(--danger)' }}>🔄 Réinitialisation complète</div>
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
            Efface toutes les données de l'application (profils, journal, mesures, réglages...). Cette action est irréversible.
          </div>
          {resetStep === 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => setResetStep(1)}>Réinitialiser l'application</button>
          )}
          {resetStep === 1 && (
            <div className="card" style={{ background: 'var(--danger-soft)', border: 'none' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>Es-tu sûr(e) ? Toutes les données seront perdues.</div>
              <div className="flex-row">
                <button className="btn btn-ghost btn-sm" onClick={() => setResetStep(0)}>Annuler</button>
                <button className="btn btn-danger btn-sm" onClick={() => setResetStep(2)}>Continuer</button>
              </div>
            </div>
          )}
          {resetStep === 2 && (
            <div className="card" style={{ background: 'var(--danger-soft)', border: 'none' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>Dernière confirmation : effacer définitivement toutes les données ?</div>
              <div className="flex-row">
                <button className="btn btn-ghost btn-sm" onClick={() => setResetStep(0)}>Annuler</button>
                <button className="btn btn-danger btn-sm" onClick={handleReset}>✕ Tout effacer ✓</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Réglages tab
// ----------------------------------------------------------------------
export default function ReglagesTab({ onOpenFamille }) {
  const { store, session } = useStore();
  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role === 'admin';

  return (
    <div>
      <Accordion icon="👶" title="Profils enfants"
        badge={store.children.length || null}
        defaultOpen={true}>
        <ChildrenSection canEdit={canEdit} embedded />
      </Accordion>

      <Accordion icon="🔐" title="Biométrie & Apparence" defaultOpen={false}>
        <BiometricSection embedded />
        <AppearanceSection embedded />
      </Accordion>

      <Accordion icon="🔔" title="Notifications" defaultOpen={false}>
        <NotificationsSection embedded />
      </Accordion>

      <Accordion icon="👨‍👩‍👧" title="Famille" defaultOpen={false}>
        <div className="flex-between" style={{ marginBottom: 8 }}>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Utilisateurs, rôles (admin, éditeur, lecture seule).
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onOpenFamille}>Gérer →</button>
        </div>
      </Accordion>

      <Accordion icon="💾" title="Données" defaultOpen={false}>
        <DataSection canEdit={canEdit} embedded />
      </Accordion>
    </div>
  );
}
