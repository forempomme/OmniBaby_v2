import React, { useState, useMemo, useEffect } from 'react';
import { HistoryNotice } from './HistoryNotice.jsx';
import { useStore, filterByActiveChild, getActiveChild, ageInMonths } from './store.jsx';
import { groupByDay, dayLabel, daysAgo, isToday, toISODate, toLocalDT, toISODateTime, useToast } from './utils.jsx';
import { Icon } from './icons.jsx';
import { SommeilForm } from './Dodo.jsx';
import NoChildState from './NoChildState.jsx';
import { ENTRY_TYPES, entryStart, entryTime, entrySearchText } from './journal/entryTypes.js';
import { EntryForm, EditEntryModal } from './journal/EntryForm.jsx';
import TodayOverview from './journal/TodayOverview.jsx';
import EntryItem from './journal/EntryItem.jsx';
import QuickEntryBar from './journal/QuickEntryBar.jsx';
import LiveBanner from './journal/LiveBanner.jsx';
import WeekSummary from './journal/WeekSummary.jsx';

// Ré-export : utilisé par les outils Historique et Recherche
export { ENTRY_TYPES };

const PERIOD_OPTIONS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: '7days', label: '7 jours' },
  { key: 'all', label: 'Tout' },
];

// ----------------------------------------------------------------------
// Onglet Journal
// intent (depuis App) : { kind: 'new', prefill } | { kind: 'edit', entryId }
// ----------------------------------------------------------------------
export default function JournalTab({ intent, clearIntent }) {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [period, setPeriod] = useState('today');
  const [filterType, setFilterType] = useState('tous');
  const [search, setSearch] = useState(null);
  const [entryForm, setEntryForm] = useState(null);        // { prefill } | null
  const [editingEntry, setEditingEntry] = useState(null);
  const [sommeilForm, setSommeilForm] = useState(null);    // { editing } | null

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';
  const compact = !!store.settings?.journalCompact;

  const childEntries = useMemo(
    () => filterByActiveChild(store.entries, store.activeChildId).sort((a, b) => entryTime(b) - entryTime(a)),
    [store.entries, store.activeChildId]
  );

  // Ouvertures demandées par App (bouton +, rappel vitamine D, minuteur)
  useEffect(() => {
    if (!intent) return;
    if (intent.kind === 'new') {
      if (intent.prefill?.type === 'sommeil') setSommeilForm({ editing: null });
      else setEntryForm({ prefill: intent.prefill || null });
    } else if (intent.kind === 'edit') {
      const e = store.entries.find((x) => x.id === intent.entryId);
      if (e) openEdit(e);
    }
    clearIntent && clearIntent();
  }, [intent]);

  const openEdit = (entry) => {
    if (!canEdit) return;
    if (entry.type === 'sommeil') setSommeilForm({ editing: entry });
    else setEditingEntry(entry);
  };

  // Réveil : sommeil en cours → formulaire pré-rempli avec fin = maintenant
  const wake = (entry) => {
    if (!canEdit) return;
    setSommeilForm({ editing: { ...entry, fin: toISODateTime(), enCours: false, debut: toLocalDT(entry.debut || entry.date) } });
  };

  const quickAdd = (type) => {
    if (!canEdit) return;
    if (type === 'sommeil') setSommeilForm({ editing: null });
    else setEntryForm({ prefill: { type } });
  };

  const periodFiltered = useMemo(() => {
    if (period === 'today') return childEntries.filter((e) => isToday(entryStart(e)));
    if (period === 'yesterday') {
      const y = toISODate(daysAgo(1));
      return childEntries.filter((e) => toISODate(new Date(entryStart(e))) === y);
    }
    if (period === '7days') {
      const cutoff = daysAgo(7).getTime();
      return childEntries.filter((e) => entryTime(e) >= cutoff);
    }
    return childEntries;
  }, [childEntries, period]);

  const visible = useMemo(() => {
    let result = filterType === 'tous' ? periodFiltered : periodFiltered.filter((e) => e.type === filterType);
    const q = (search || '').trim().toLowerCase();
    if (q) result = result.filter((e) => entrySearchText(e).includes(q));
    return result.map((e) => ({ ...e, _day: entryStart(e) }));
  }, [periodFiltered, filterType, search]);

  const grouped = useMemo(() => groupByDay(visible, '_day'), [visible]);

  // Rappel vitamine D (jusqu'à 24 mois) : 1 tap pour la noter
  const today = toISODate();
  const ageM = activeChild ? ageInMonths(activeChild.birthdate) : null;
  const vitDDue = !!activeChild && canEdit && ageM != null && ageM < 24
    && activeChild.lastVitDDate !== today
    && !childEntries.some((e) => e.type === 'biberon' && e.vitamineD && isToday(e.date));
  const giveVitD = () => {
    update((draft) => {
      const c = draft.children.find((x) => x.id === activeChild.id);
      if (c) c.lastVitDDate = today;
      return draft;
    });
    showToast('Vitamine D notée pour aujourd’hui', '💊');
  };

  const handleDelete = (id) => {
    update((draft) => { draft.entries = draft.entries.filter((e) => e.id !== id); return draft; });
    showToast('Entrée supprimée', '🗑️');
  };

  if (!activeChild) return <NoChildState />;

  return (
    <div>
      <TodayOverview
        entries={childEntries}
        child={activeChild}
        filterType={filterType}
        setFilterType={setFilterType}
        onQuickAdd={quickAdd}
        onWake={wake}
      />

      {vitDDue && (
        <div className="vitd-banner">
          <span>Vitamine D pas encore notée aujourd'hui</span>
          <button className="btn btn-secondary btn-sm" onClick={giveVitD}>Donnée</button>
        </div>
      )}

      <div className="period-bar">
        <div className="period-chips">
          {PERIOD_OPTIONS.map((p) => (
            <button key={p.key} className={`chip ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <button
          className={`icon-btn ${search !== null ? 'on' : ''}`}
          onClick={() => setSearch((s) => (s === null ? '' : null))}
          aria-label="Rechercher dans le journal"
        >
          <Icon name="search" size={18} />
        </button>
      </div>

      {search !== null && (
        <div className="search-field">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher : selles, 150, Marie…" autoFocus />
          {search && <button onClick={() => setSearch('')} aria-label="Effacer la recherche"><Icon name="x" size={16} /></button>}
        </div>
      )}

      <LiveBanner />
      {period === 'today' && canEdit && <QuickEntryBar entries={childEntries} onLongPress={(prefill) => setEntryForm({ prefill })} />}
      {period === '7days' && <WeekSummary entries={periodFiltered} store={store} child={activeChild} />}

      {filterType !== 'tous' && (
        <div className="chip-row">
          <button className="chip active" onClick={() => setFilterType('tous')}>
            Filtre : {ENTRY_TYPES[filterType]?.short} <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="title">{filterType !== 'tous' || search ? 'Aucun résultat' : 'Aucune entrée'}</div>
          <div className="desc">
            {filterType !== 'tous' || search
              ? 'Rien pour ce filtre sur cette période.'
              : 'Utilise les boutons rapides ou le bouton + pour noter un repas, un change ou un sommeil.'}
          </div>
          {filterType !== 'tous' && (
            <button className="btn btn-primary btn-sm" onClick={() => setFilterType('tous')}>Voir toutes les entrées</button>
          )}
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day}>
            <div className="day-group-label">
              <span>{dayLabel(day)}</span>
              <span className="day-count">{items.length} entrée{items.length > 1 ? 's' : ''}</span>
            </div>
            <div className="entry-list">
              {items.map((entry) => (
                <EntryItem
                  key={entry.id}
                  entry={entry}
                  compact={compact}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => canEdit && handleDelete(entry.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {period === 'all' && <HistoryNotice variant="card" />}

      <EntryForm
        open={!!entryForm}
        prefill={entryForm?.prefill || null}
        onClose={() => setEntryForm(null)}
        onPickSommeil={() => { setEntryForm(null); setSommeilForm({ editing: null }); }}
      />

      <SommeilForm
        open={!!sommeilForm}
        onClose={() => setSommeilForm(null)}
        child={activeChild}
        editing={sommeilForm?.editing || null}
      />

      {editingEntry && <EditEntryModal entry={editingEntry} onClose={() => setEditingEntry(null)} />}
    </div>
  );
}
