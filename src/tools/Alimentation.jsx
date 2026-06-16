import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild, ageInMonths } from '../store.js';
import { useToast, fireConfetti, ConfirmInline } from '../utils.js';
import { Modal } from '../Modal.jsx';
import { DIVERSIFICATION_STAGES, ALIMENT_CATEGORIES, ALIMENT_STATUTS } from '../data/diversification.js';

// ----------------------------------------------------------------------
// Feeding advice (detailed, age-based)
// ----------------------------------------------------------------------
function FeedingAdvice({ child }) {
  const ageM = ageInMonths(child.birthdate);
  if (ageM == null) return null;

  let milkAdvice;
  if (ageM < 6) {
    milkAdvice = child.alimentation === 'lait_infantile'
      ? "Lait infantile 1er âge recommandé jusqu'à 6 mois."
      : "Allaitement exclusif recommandé jusqu'à 6 mois.";
  } else if (ageM < 12) {
    milkAdvice = 'Transition vers le lait 2e âge (suite) entre 6 et 12 mois, en complément de la diversification.';
  } else if (ageM < 36) {
    milkAdvice = "Lait de croissance recommandé entre 1 et 3 ans, en complément d'une alimentation variée.";
  } else {
    milkAdvice = 'Lait de vache entier ou produits laitiers adaptés peuvent être proposés au quotidien.';
  }

  return (
    <div className="card appear">
      <div className="section-title" style={{ marginBottom: 6 }}>🥛 Conseils selon l'âge</div>
      <div className="muted" style={{ fontSize: '0.85rem' }}>{milkAdvice}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Diversification stages with checkable steps
// ----------------------------------------------------------------------
function DiversificationSection({ child, etapesDiv, canEdit }) {
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
    update((draft) => {
      draft.etapesDiv[stepId] = checked;
      return draft;
    });
    if (checked) {
      fireConfetti();
    }
  };

  return (
    <div className="card appear">
      <div className="section-title" style={{ marginBottom: 6 }}>🥦 Étapes de diversification (0-3 ans)</div>
      <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 12 }}>
        Repères PNNS / Santé publique France, incluant hygiène bucco-dentaire et protection solaire.
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
                    style={{ cursor: canEdit ? 'pointer' : 'default', opacity: checked ? 0.7 : 1 }}
                    onClick={() => canEdit && toggleStep(step.id)}
                  >
                    <div className="entry-icon" style={{ background: checked ? 'var(--accent-sage-soft)' : 'var(--surface-2)', color: checked ? 'var(--accent-sage)' : 'var(--text-faint)' }}>
                      {checked ? '✅' : step.icon}
                    </div>
                    <div className="entry-body">
                      <div className="entry-title" style={{ fontSize: '0.85rem', textDecoration: checked ? 'line-through' : 'none' }}>
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
// Add aliment form
// ----------------------------------------------------------------------
function AlimentForm({ open, onClose, child }) {
  const { update, nextId } = useStore();
  const showToast = useToast();
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('legume');
  const [statut, setStatut] = useState('a_tester');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (open) {
      setNom('');
      setCategorie('legume');
      setStatut('a_tester');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = () => {
    if (!nom.trim()) {
      showToast("Entre le nom de l'aliment", '⚠️');
      return;
    }
    update((draft) => {
      draft.aliments.push({
        id: nextId(),
        childId: child.id,
        nom: nom.trim(),
        categorie,
        statut,
        notes,
        date: new Date().toISOString(),
      });
      return draft;
    });
    showToast('Aliment ajouté', '✅');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvel aliment" icon="🥦">
      <div className="field">
        <label>Nom de l'aliment</label>
        <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Carotte" autoFocus />
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
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Réaction observée, texture, contexte..." />
      </div>
      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>Ajouter ✓</button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Aliments testés section with filters
// ----------------------------------------------------------------------
function AlimentsSection({ child, aliments, canEdit }) {
  const { update } = useStore();
  const showToast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [filterCat, setFilterCat] = useState('tous');
  const [filterStatut, setFilterStatut] = useState('tous');

  const filtered = useMemo(() => {
    return aliments.filter((a) => {
      if (filterCat !== 'tous' && a.categorie !== filterCat) return false;
      if (filterStatut !== 'tous' && a.statut !== filterStatut) return false;
      return true;
    }).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }, [aliments, filterCat, filterStatut]);

  const handleDelete = (id) => {
    update((draft) => {
      draft.aliments = draft.aliments.filter((a) => a.id !== id);
      return draft;
    });
    showToast('Aliment supprimé', '🗑️');
  };

  const cycleStatut = (aliment) => {
    const idx = ALIMENT_STATUTS.findIndex((s) => s.key === aliment.statut);
    const next = ALIMENT_STATUTS[(idx + 1) % ALIMENT_STATUTS.length];
    update((draft) => {
      const a = draft.aliments.find((x) => x.id === aliment.id);
      if (a) a.statut = next.key;
      return draft;
    });
  };

  return (
    <div className="card appear">
      <div className="flex-between">
        <div className="section-title" style={{ marginBottom: 0 }}>🍽️ Aliments testés</div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => setFormOpen(true)}>＋ Ajouter</button>
        )}
      </div>

      <div className="chip-row mt-8">
        <button className={`chip ${filterCat === 'tous' ? 'active' : ''}`} onClick={() => setFilterCat('tous')}>Toutes catégories</button>
        {ALIMENT_CATEGORIES.map((c) => (
          <button key={c.key} className={`chip ${filterCat === c.key ? 'active' : ''}`} onClick={() => setFilterCat(c.key)}>{c.icon} {c.label}</button>
        ))}
      </div>
      <div className="chip-row" style={{ marginTop: -4 }}>
        <button className={`chip ${filterStatut === 'tous' ? 'active' : ''}`} onClick={() => setFilterStatut('tous')}>Tous statuts</button>
        {ALIMENT_STATUTS.map((s) => (
          <button key={s.key} className={`chip ${filterStatut === s.key ? 'active' : ''}`} onClick={() => setFilterStatut(s.key)}>{s.icon} {s.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <div className="emoji">🥦</div>
          <div className="desc">Aucun aliment ne correspond. Ajoute le premier aliment testé !</div>
        </div>
      ) : (
        <div className="entry-list mt-16">
          {filtered.map((a) => {
            const statutDef = ALIMENT_STATUTS.find((s) => s.key === a.statut) || ALIMENT_STATUTS[0];
            const catDef = ALIMENT_CATEGORIES.find((c) => c.key === a.categorie);
            return (
              <div key={a.id} className="swipe-content">
                <div
                  className="entry-icon"
                  style={{ background: 'var(--surface-2)', color: statutDef.color, cursor: canEdit ? 'pointer' : 'default' }}
                  onClick={() => canEdit && cycleStatut(a)}
                >
                  {statutDef.icon}
                </div>
                <div className="entry-body">
                  <div className="entry-title">{a.nom}</div>
                  <div className="entry-sub">{catDef ? `${catDef.icon} ${catDef.label} · ` : ''}{statutDef.label}{a.notes ? ` · ${a.notes}` : ''}</div>
                </div>
                {canEdit && <ConfirmInline onConfirm={() => handleDelete(a.id)} />}
              </div>
            );
          })}
        </div>
      )}

      <AlimentForm open={formOpen} onClose={() => setFormOpen(false)} child={child} />
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Alimentation module
// ----------------------------------------------------------------------
export default function AlimentationTool() {
  const { store, session } = useStore();
  const activeChild = getActiveChild(store);
  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const childAliments = useMemo(
    () => filterByActiveChild(store.aliments, store.activeChildId),
    [store.aliments, store.activeChildId]
  );

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour suivre son alimentation.</div>
      </div>
    );
  }

  return (
    <div>
      <FeedingAdvice child={activeChild} />
      <DiversificationSection child={activeChild} etapesDiv={store.etapesDiv} canEdit={canEdit} />
      <AlimentsSection child={activeChild} aliments={childAliments} canEdit={canEdit} />
    </div>
  );
}
