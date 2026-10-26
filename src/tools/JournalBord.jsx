import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild } from '../store.jsx';
import { toISODate, formatDateFR, groupByDay, dayLabel, useToast, ConfirmInline, toTime } from '../utils.jsx';
import { Modal } from '../Modal.jsx';

import { Icon, UiIcon } from '../icons.jsx';
const TAGS = [
  { key: 'etape', label: 'Étape', icon: '⭐', color: 'var(--accent-sun)', bg: 'var(--accent-sun-soft)' },
  { key: 'souvenir', label: 'Souvenir', icon: '📸', color: 'var(--accent-sky)', bg: 'var(--accent-sky-soft)' },
  { key: 'sante', label: 'Santé', icon: '🩺', color: 'var(--accent-sage)', bg: 'var(--accent-sage-soft)' },
  { key: 'drole', label: 'Drôle', icon: '😄', color: 'var(--primary)', bg: 'var(--primary-soft)' },
];

function journalDefaults() {
  return { titre: '', note: '', tag: 'etape', date: toISODate() };
}

function EntryForm({ open, onClose, child, editing }) {
  const { update, nextId } = useStore();
  const showToast = useToast();
  const [form, setForm] = useState(journalDefaults());

  React.useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { titre: editing.titre || '', note: editing.note || '', tag: editing.tag || 'etape', date: editing.date?.slice(0, 10) || toISODate() }
          : journalDefaults()
      );
    }
  }, [open, editing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.titre.trim() && !form.note.trim()) {
      showToast('Ajoute un titre ou une note', '⚠️');
      return;
    }
    update((draft) => {
      if (editing) {
        const idx = draft.journal.findIndex((j) => j.id === editing.id);
        if (idx !== -1) draft.journal[idx] = { ...draft.journal[idx], ...form, titre: form.titre.trim(), note: form.note.trim() };
      } else {
        draft.journal.push({
          id: nextId(),
          childId: child.id,
          titre: form.titre.trim(),
          note: form.note.trim(),
          tag: form.tag,
          date: form.date,
        });
      }
      return draft;
    });
    showToast(editing ? 'Souvenir modifié' : 'Souvenir enregistré ✨', '📸');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier' : 'Nouveau souvenir'} icon="📸">
      <div className="field">
        <label>Titre</label>
        <input type="text" value={form.titre} onChange={(e) => set('titre', e.target.value)} placeholder="Ex : Premier sourire, Premier pas..." autoFocus />
      </div>
      <div className="field">
        <label>Tag</label>
        <div className="pill-group">
          {TAGS.map((t) => (
            <button key={t.key} className={`pill-choice ${form.tag === t.key ? 'selected' : ''}`} onClick={() => set('tag', t.key)}>
              <UiIcon value={t.icon} size={14} className="inline-ic" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Date</label>
        <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
      </div>
      <div className="field">
        <label>Note (optionnel)</label>
        <textarea rows={4} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Décris ce moment précieux..." />
      </div>
      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        {editing ? 'Enregistrer' : 'Ajouter'}
      </button>
    </Modal>
  );
}

function JournalCard({ entry, onEdit, onDelete, canEdit }) {
  const tagDef = TAGS.find((t) => t.key === entry.tag) || TAGS[0];
  return (
    <div className="card appear" style={{ cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && onEdit()}>
      <div className="flex-between">
        <div className="flex-row" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ flexShrink: 0, color: tagDef.color }}><UiIcon value={tagDef.icon} size={22} /></span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.titre || '(sans titre)'}
          </span>
        </div>
        {canEdit && (
          <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            <ConfirmInline onConfirm={onDelete} />
          </div>
        )}
      </div>
      {entry.note && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-soft)', marginTop: 8, lineHeight: 1.5 }}>
          {entry.note}
        </div>
      )}
      <div className="flex-between mt-8">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: tagDef.bg, color: tagDef.color, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 700 }}>
          <UiIcon value={tagDef.icon} size={13} className="inline-ic" /> {tagDef.label}
        </span>
        <span className="muted" style={{ fontSize: '0.75rem' }}>{formatDateFR(entry.date)}</span>
      </div>
    </div>
  );
}

export default function JournalBordTool() {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterTag, setFilterTag] = useState('tous');
  const [search, setSearch] = useState('');

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const childJournal = useMemo(
    () => filterByActiveChild(store.journal, store.activeChildId),
    [store.journal, store.activeChildId]
  );

  const filtered = useMemo(() => {
    return childJournal
      .filter((j) => filterTag === 'tous' || j.tag === filterTag)
      .filter((j) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (j.titre || '').toLowerCase().includes(q) || (j.note || '').toLowerCase().includes(q);
      })
      .sort((a, b) => toTime(b.date) - toTime(a.date));
  }, [childJournal, filterTag, search]);

  const grouped = useMemo(() => groupByDay(filtered, 'date'), [filtered]);

  const handleDelete = (id) => {
    update((draft) => {
      draft.journal = draft.journal.filter((j) => j.id !== id);
      return draft;
    });
    showToast('Souvenir supprimé', '🗑️');
  };

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji"><UiIcon value="👶" size={40} /></div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour tenir son journal de bord.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between">
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          {childJournal.length > 0
            ? `${childJournal.length} souvenir${childJournal.length > 1 ? 's' : ''} de ${activeChild.nom}`
            : `Journal de bord de ${activeChild.nom}`}
        </div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Icon name="plus" size={16} /> Ajouter</button>
        )}
      </div>

      <div className="field mt-8">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher dans les souvenirs..." />
      </div>

      <div className="chip-row" style={{ marginTop: -4 }}>
        <button className={`chip ${filterTag === 'tous' ? 'active' : ''}`} onClick={() => setFilterTag('tous')}>Tous</button>
        {TAGS.map((t) => (
          <button key={t.key} className={`chip ${filterTag === t.key ? 'active' : ''}`} onClick={() => setFilterTag(t.key)}>
            <UiIcon value={t.icon} size={14} className="inline-ic" /> {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="emoji"><UiIcon value="📸" size={40} /></div>
          <div className="title">{childJournal.length === 0 ? 'Aucun souvenir' : 'Aucun résultat'}</div>
          <div className="desc">
            {childJournal.length === 0
              ? `Note les premiers sourires, les grandes étapes et les moments drôles de ${activeChild.nom}.`
              : 'Essaie un autre filtre ou mot-clé.'}
          </div>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day}>
            <div className="day-group-label">{dayLabel(day)}</div>
            {items.map((j) => (
              <JournalCard
                key={j.id}
                entry={j}
                canEdit={canEdit}
                onEdit={() => { setEditing(j); setFormOpen(true); }}
                onDelete={() => handleDelete(j.id)}
              />
            ))}
          </div>
        ))
      )}

      <EntryForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} child={activeChild} editing={editing} />
    </div>
  );
}
