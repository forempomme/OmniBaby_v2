import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild, ageInMonths } from '../store.jsx';
import { useToast, fireConfetti, ConfirmInline, Accordion } from '../utils.jsx';
import { Modal } from '../Modal.jsx';
import { DIVERSIFICATION_STAGES, ALIMENT_CATEGORIES, ALIMENT_STATUTS } from '../data/diversification.js';

// ----------------------------------------------------------------------
// Aliments pré-remplis (seed au premier lancement pour un enfant)
// Tous en statut "a_tester" — l'utilisateur met à jour au fil des essais
// ----------------------------------------------------------------------
export const ALIMENTS_SEED = [
  // Légumes
  { nom: 'Carotte', categorie: 'legume', icon: '🥕' },
  { nom: 'Courgette', categorie: 'legume', icon: '🥒' },
  { nom: 'Haricot vert', categorie: 'legume', icon: '🫛' },
  { nom: 'Patate douce', categorie: 'legume', icon: '🍠' },
  { nom: 'Brocoli', categorie: 'legume', icon: '🥦' },
  { nom: 'Poireau', categorie: 'legume', icon: '🌿' },
  { nom: 'Épinard', categorie: 'legume', icon: '🌱' },
  { nom: 'Tomate', categorie: 'legume', icon: '🍅' },
  // Fruits
  { nom: 'Pomme', categorie: 'fruit', icon: '🍎' },
  { nom: 'Poire', categorie: 'fruit', icon: '🍐' },
  { nom: 'Banane', categorie: 'fruit', icon: '🍌' },
  { nom: 'Mangue', categorie: 'fruit', icon: '🥭' },
  { nom: 'Avocat', categorie: 'fruit', icon: '🥑' },
  { nom: 'Fraise', categorie: 'fruit', icon: '🍓' },
  { nom: 'Pêche', categorie: 'fruit', icon: '🍑' },
  { nom: 'Melon', categorie: 'fruit', icon: '🍈' },
  // Féculents
  { nom: 'Riz', categorie: 'feculent', icon: '🍚' },
  { nom: 'Pâtes', categorie: 'feculent', icon: '🍝' },
  { nom: 'Pomme de terre', categorie: 'feculent', icon: '🥔' },
  { nom: 'Pain', categorie: 'feculent', icon: '🍞' },
  { nom: 'Semoule', categorie: 'feculent', icon: '🌾' },
  // Protéines
  { nom: 'Poulet', categorie: 'proteine', icon: '🍗' },
  { nom: 'Saumon', categorie: 'proteine', icon: '🐟' },
  { nom: 'Cabillaud', categorie: 'proteine', icon: '🐠' },
  { nom: 'Œuf', categorie: 'proteine', icon: '🥚' },
  { nom: 'Bœuf', categorie: 'proteine', icon: '🥩' },
  { nom: 'Lentilles', categorie: 'proteine', icon: '🫘' },
  // Produits laitiers
  { nom: 'Yaourt nature', categorie: 'laitier', icon: '🥛' },
  { nom: 'Fromage blanc', categorie: 'laitier', icon: '🧴' },
  { nom: 'Emmental', categorie: 'laitier', icon: '🧀' },
  { nom: 'Beurre', categorie: 'laitier', icon: '🧈' },
  // Allergènes (à surveiller particulièrement)
  { nom: 'Arachide', categorie: 'allergene', icon: '🥜' },
  { nom: "Blanc d'œuf", categorie: "allergene", icon: "🍳" },
  { nom: 'Lait de vache', categorie: 'allergene', icon: '🐄' },
  { nom: 'Gluten (blé)', categorie: 'allergene', icon: '🌾' },
  { nom: 'Fruits à coque', categorie: 'allergene', icon: '🌰' },
];



// ----------------------------------------------------------------------
// Conseils lait selon l'âge (OMS 2023 + PNNS4)
// ----------------------------------------------------------------------
function FeedingAdvice({ child, embedded = false }) {
  const ageM = ageInMonths(child.birthdate);
  if (ageM == null) return null;

  let milkAdvice;
  if (ageM < 6) {
    milkAdvice = child.alimentation === 'lait_infantile'
      ? "Lait infantile 1er âge recommandé jusqu'à 6 mois."
      : "Allaitement exclusif recommandé jusqu'à 6 mois (OMS).";
  } else if (ageM < 12) {
    milkAdvice = "Lait 2e âge en complément de la diversification. Lait animal déconseillé avant 1 an (OMS 2023).";
  } else if (ageM < 36) {
    milkAdvice = "Lait de croissance recommandé jusqu'à 3 ans (500-750 ml/jour). Apports en fer, DHA et vitamine D adaptés.";
  } else {
    milkAdvice = "Lait de vache entier ou produits laitiers au quotidien. Alimentation familiale complète et variée.";
  }

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ marginBottom: 6, display: embedded ? 'none' : 'flex' }}>🥛 Conseils selon l'âge</div>
      <div className="muted" style={{ fontSize: '0.85rem' }}>{milkAdvice}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Étapes de diversification
// ----------------------------------------------------------------------
function DiversificationSection({ child, etapesDiv, canEdit, embedded = false }) {
  const { update } = useStore();
  const ageM = ageInMonths(child.birthdate) ?? 0;

  const defaultStageKey = useMemo(() => {
    if (ageM <= 6) return '0-6';
    if (ageM <= 9) return '6-9';
    if (ageM <= 12) return '9-12';
    if (ageM <= 24) return '12-24';
    return '24-36';
  }, [ageM]);

  const [openStage, setOpenStage] = useState(defaultStageKey);

  const toggleStep = (stepId) => {
    const checked = !etapesDiv[stepId];
    update((draft) => { draft.etapesDiv[stepId] = checked; return draft; });
    if (checked) fireConfetti();
  };

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="section-title" style={{ marginBottom: 4, display: embedded ? 'none' : 'flex' }}>🥦 Étapes 0-3 ans</div>
      <div className="muted" style={{ fontSize: '0.75rem', marginBottom: 10 }}>
        PNNS4 · HCSP 2020 · OMS 2023 — inclut hygiène dentaire et protection solaire
      </div>
      <div className="chip-row">
        {DIVERSIFICATION_STAGES.map((stage) => (
          <button
            key={stage.key}
            className={`chip ${openStage === stage.key ? 'active' : ''}`}
            onClick={() => setOpenStage(stage.key)}
          >
            {stage.icon} {stage.label}
          </button>
        ))}
      </div>
      {DIVERSIFICATION_STAGES.filter((s) => s.key === openStage).map((stage) => {
        const total = stage.steps.length;
        const done = stage.steps.filter((s) => etapesDiv[s.id]).length;
        return (
          <div key={stage.key} className="mt-16">
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{stage.label}</span>
              <span className="muted" style={{ fontSize: '0.78rem' }}>{done}/{total}</span>
            </div>
            <div className="entry-list">
              {stage.steps.map((step) => {
                const checked = !!etapesDiv[step.id];
                return (
                  <div
                    key={step.id}
                    className="swipe-content"
                    style={{ cursor: canEdit ? 'pointer' : 'default', opacity: checked ? 0.65 : 1 }}
                    onClick={() => canEdit && toggleStep(step.id)}
                  >
                    <div className="entry-icon" style={{
                      background: checked ? 'var(--accent-sage-soft)' : 'var(--surface-2)',
                      color: checked ? 'var(--accent-sage)' : 'var(--text-faint)',
                    }}>
                      {checked ? '✅' : step.icon}
                    </div>
                    <div className="entry-body">
                      <div className="entry-title" style={{ fontSize: '0.82rem', textDecoration: checked ? 'line-through' : 'none' }}>
                        {step.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------
// Formulaire ajout / édition aliment
// ----------------------------------------------------------------------
function AlimentForm({ open, onClose, child, editing, onDelete }) {
  const { update, nextId } = useStore();
  const showToast = useToast();
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('legume');
  const [statut, setStatut] = useState('a_tester');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setNom(editing.nom || '');
        setCategorie(editing.categorie || 'legume');
        setStatut(editing.statut || 'a_tester');
        setNotes(editing.notes || '');
      } else {
        setNom('');
        setCategorie('legume');
        setStatut('a_tester');
        setNotes('');
      }
    }
  }, [open, editing]);

  const handleSubmit = () => {
    if (!nom.trim()) { showToast("Entre le nom de l'aliment", '⚠️'); return; }
    update((draft) => {
      if (editing) {
        const idx = draft.aliments.findIndex((a) => a.id === editing.id);
        if (idx !== -1) draft.aliments[idx] = { ...draft.aliments[idx], nom: nom.trim(), categorie, statut, notes };
      } else {
        draft.aliments.push({ id: nextId(), childId: child.id, nom: nom.trim(), categorie, statut, notes, date: new Date().toISOString() });
      }
      return draft;
    });
    showToast(editing ? 'Aliment modifié' : 'Aliment ajouté', '✅');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier' : 'Nouvel aliment'} icon="🥦">
      <div className="field">
        <label>Nom</label>
        <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Carotte, Saumon, Yaourt..." autoFocus />
      </div>
      <div className="field">
        <label>Catégorie</label>
        <div className="pill-group">
          {ALIMENT_CATEGORIES.map((c) => (
            <button key={c.key} className={`pill-choice ${categorie === c.key ? 'selected' : ''}`} onClick={() => setCategorie(c.key)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Réaction</label>
        <div className="pill-group">
          {ALIMENT_STATUTS.map((s) => (
            <button key={s.key} className={`pill-choice ${statut === s.key ? 'selected' : ''}`} onClick={() => setStatut(s.key)}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Notes (optionnel)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Réaction, texture, contexte..." />
      </div>
      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        {editing ? 'Enregistrer ✓' : 'Ajouter ✓'}
      </button>
      {editing && onDelete && (
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
          <ConfirmInline onConfirm={onDelete} label="Supprimer cet aliment" icon="🗑️" />
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Grille aliments — variante A
// Cartes 3 colonnes avec icône catégorie + nom + badge statut coloré
// Filtre par catégorie (chips) + filtre par statut (chips)
// Touche l'icône pour cycler le statut, touche la carte pour éditer
// ----------------------------------------------------------------------
function AlimentsGrid({ child, aliments, canEdit, embedded = false }) {
  const { update } = useStore();
  const showToast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState('tous');
  const [filterStatut, setFilterStatut] = useState('tous');

  const filtered = useMemo(() => {
    return aliments
      .filter((a) => filterCat === 'tous' || a.categorie === filterCat)
      .filter((a) => filterStatut === 'tous' || a.statut === filterStatut)
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }, [aliments, filterCat, filterStatut]);

  const handleDelete = (id) => {
    update((draft) => { draft.aliments = draft.aliments.filter((a) => a.id !== id); return draft; });
    showToast('Aliment supprimé', '🗑️');
  };

  const cycleStatut = (e, aliment) => {
    e.stopPropagation();
    if (!canEdit) return;
    const idx = ALIMENT_STATUTS.findIndex((s) => s.key === aliment.statut);
    const next = ALIMENT_STATUTS[(idx + 1) % ALIMENT_STATUTS.length];
    update((draft) => { const a = draft.aliments.find((x) => x.id === aliment.id); if (a) a.statut = next.key; return draft; });
  };

  const openEdit = (aliment) => { if (!canEdit) return; setEditing(aliment); setFormOpen(true); };
  const openAdd = () => { setEditing(null); setFormOpen(true); };

  // Compteurs par statut
  const counts = useMemo(() => {
    const c = {};
    ALIMENT_STATUTS.forEach((s) => { c[s.key] = aliments.filter((a) => a.statut === s.key).length; });
    return c;
  }, [aliments]);

  return (
    <div className={embedded ? '' : 'card appear'}>
      <div className="flex-between">
        <div className="section-title" style={{ marginBottom: 0 }}>🍽️ Aliments testés</div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={openAdd}>＋ Ajouter</button>
        )}
      </div>

      {/* Résumé rapide statuts */}
      {aliments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0 8px' }}>
          {ALIMENT_STATUTS.filter((s) => counts[s.key] > 0).map((s) => (
            <span
              key={s.key}
              onClick={() => setFilterStatut(filterStatut === s.key ? 'tous' : s.key)}
              style={{
                padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.7rem', fontWeight: 700,
                background: filterStatut === s.key ? s.color : 'var(--surface-2)',
                color: filterStatut === s.key ? '#fff' : s.color,
                border: `1.5px solid ${s.color}`, cursor: 'pointer',
              }}
            >
              {s.icon} {counts[s.key]}
            </span>
          ))}
        </div>
      )}

      {/* Filtre catégorie */}
      <div className="chip-row">
        <button className={`chip ${filterCat === 'tous' ? 'active' : ''}`} onClick={() => setFilterCat('tous')}>Tout</button>
        {ALIMENT_CATEGORIES.map((c) => (
          <button key={c.key} className={`chip ${filterCat === c.key ? 'active' : ''}`} onClick={() => setFilterCat(c.key)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px 12px' }}>
          <div className="emoji">🥦</div>
          <div className="desc">
            {aliments.length === 0
              ? 'Ajoute le premier aliment testé par ' + child.nom + ' !'
              : 'Aucun aliment pour ce filtre.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
          {filtered.map((a) => {
            const statutDef = ALIMENT_STATUTS.find((s) => s.key === a.statut) || ALIMENT_STATUTS[0];
            const catDef = ALIMENT_CATEGORIES.find((c) => c.key === a.categorie);
            return (
              <div
                key={a.id}
                onClick={() => openEdit(a)}
                style={{
                  background: statutDef.bg,
                  border: `1.5px solid ${statutDef.border}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 6px 8px',
                  textAlign: 'center',
                  cursor: canEdit ? 'pointer' : 'default',
                  position: 'relative',
                  minHeight: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {/* Icône catégorie */}
                <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>{catDef?.icon || '🍽️'}</div>
                {/* Nom */}
                <div style={{ fontWeight: 600, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                  {a.nom}
                </div>
                {/* Badge statut — cliquable pour cycler */}
                <button
                  onClick={(e) => cycleStatut(e, a)}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: '0.9rem', cursor: canEdit ? 'pointer' : 'default',
                    lineHeight: 1,
                  }}
                  title={statutDef.label}
                >
                  {statutDef.icon}
                </button>
                {/* Suppression via formulaire d'édition — pas de suppression directe */}
              </div>
            );
          })}
          {/* Bouton ajouter dans la grille */}
          {canEdit && (
            <div
              onClick={openAdd}
              style={{
                border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-md)',
                padding: '10px 6px', textAlign: 'center', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, minHeight: 80,
                color: 'var(--text-faint)',
              }}
            >
              <div style={{ fontSize: '1.3rem' }}>＋</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600 }}>Ajouter</div>
            </div>
          )}
        </div>
      )}

      {/* Légende */}
      {aliments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {ALIMENT_STATUTS.map((s) => (
            <span key={s.key} style={{ fontSize: '0.65rem', color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: 2 }}>
              {s.icon} {s.label}
            </span>
          ))}
        </div>
      )}

      <AlimentForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        child={child}
        editing={editing}
        onDelete={editing ? () => { handleDelete(editing.id); setFormOpen(false); setEditing(null); } : null}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Alimentation module
// ----------------------------------------------------------------------
export default function AlimentationTool() {
  const { store, update, nextId, session } = useStore();
  const activeChild = getActiveChild(store);
  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const childAliments = useMemo(
    () => filterByActiveChild(store.aliments, store.activeChildId),
    [store.aliments, store.activeChildId]
  );

  // Seed les aliments pré-remplis au premier accès pour cet enfant
  React.useEffect(() => {
    if (!activeChild || !canEdit) return;
    const hasAliments = store.aliments.some((a) => a.childId === activeChild.id);
    if (hasAliments) return;
    update((draft) => {
      ALIMENTS_SEED.forEach((seed) => {
        draft.aliments.push({
          id: draft.nextId++,
          childId: activeChild.id,
          nom: seed.nom,
          categorie: seed.categorie,
          statut: 'a_tester',
          notes: '',
          date: new Date().toISOString(),
          seeded: true,
        });
      });
      return draft;
    });
  }, [activeChild?.id]);

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour suivre son alimentation.</div>
      </div>
    );
  }

  // Calcul du badge de progression pour les étapes
  const totalSteps = DIVERSIFICATION_STAGES.reduce((sum, s) => sum + s.steps.length, 0);
  const doneSteps = DIVERSIFICATION_STAGES.reduce((sum, s) =>
    sum + s.steps.filter((step) => store.etapesDiv[step.id]).length, 0);

  return (
    <div>
      <Accordion icon="🥛" title="Conseils selon l'âge" defaultOpen={false}>
        <FeedingAdvice child={activeChild} embedded />
      </Accordion>

      <Accordion
        icon="🥦"
        title="Étapes de diversification"
        badge={`${doneSteps}/${totalSteps}`}
        defaultOpen={false}>
        <DiversificationSection child={activeChild} etapesDiv={store.etapesDiv} canEdit={canEdit} embedded />
      </Accordion>

      <Accordion
        icon="🍽️"
        title="Aliments testés"
        badge={childAliments.filter(a => a.statut !== 'a_tester').length
          ? `${childAliments.filter(a => a.statut !== 'a_tester').length}/${childAliments.length}`
          : childAliments.length || null}
        defaultOpen={true}>
        <AlimentsGrid child={activeChild} aliments={childAliments} canEdit={canEdit} embedded />
      </Accordion>
    </div>
  );
}
