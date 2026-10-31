import React, { useMemo } from 'react';
import { useStore, getActiveChild, ageInMonths } from '../store.jsx';
import { useToast, toISODate, formatDateFR } from '../utils.jsx';
import { Icon } from '../icons.jsx';
import { demarchesFor, demarcheStatus } from '../demarches.js';

const STATUS_TEXT = { late: 'Date dépassée', soon: 'Bientôt', todo: '', done: 'Fait' };

// ----------------------------------------------------------------------
// Démarches autour de la naissance : dates limites calculées depuis la
// date de naissance (ou prévue), cases partagées entre les parents
// (settings.demarches = { date, done }).
// ----------------------------------------------------------------------
export default function DemarchesTool() {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const child = getActiveChild(store);
  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';
  const saved = store.settings?.demarches || {};
  // Date par défaut : naissance de l'enfant actif s'il a moins d'un an
  const childDate = child?.birthdate && (ageInMonths(child.birthdate) ?? 99) < 12 ? child.birthdate : '';
  const date = saved.date || childDate;
  const items = useMemo(() => demarchesFor(date, saved.done), [date, saved.done]);
  const now = new Date();
  const future = date && date > toISODate();

  const setDemarches = (patch) => update((d) => {
    d.settings.demarches = { ...(d.settings.demarches || {}), ...patch };
    return d;
  });
  const toggle = (key) => {
    if (!canEdit) return;
    const done = { ...(saved.done || {}) };
    if (done[key]) delete done[key]; else done[key] = toISODate();
    setDemarches({ done, ...(saved.date ? {} : { date }) });
    showToast(done[key] ? 'Démarche cochée' : 'Démarche décochée', done[key] ? '✅' : '↩️');
  };

  const left = items.filter((it) => !it.done).length;
  return (
    <div>
      <div className="field">
        <label>{future ? 'Date prévue de la naissance' : 'Date de naissance'}</label>
        <input type="date" value={date} disabled={!canEdit} onChange={(e) => setDemarches({ date: e.target.value })} />
        <div className="set-hint muted">
          {date ? (future ? 'Dates calculées sur la date prévue : remplace-la par la vraie date le jour J.' : `${left} démarche${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''} · cases partagées avec l’autre parent`) : 'Indique la date de naissance (ou prévue) pour calculer les dates limites.'}
        </div>
      </div>

      {items.map((it) => {
        const st = demarcheStatus(it, now);
        return (
          <button key={it.key} className={`dem-item ${st}`} onClick={() => toggle(it.key)} disabled={!canEdit}>
            <span className="dem-box">{it.done ? <Icon name="check" size={15} /> : null}</span>
            <span className="dem-body">
              <span className="dem-top">
                <b>{it.title}</b>
                {STATUS_TEXT[st] && <em className={`dem-tag ${st}`}>{STATUS_TEXT[st]}</em>}
              </span>
              <span className="dem-when">
                {it.done ? `Fait le ${formatDateFR(it.done)}` : it.due ? `Avant le ${formatDateFR(toISODate(it.due))}` : 'Dès que possible'}
                {' · '}{it.where}
              </span>
              <span className="dem-detail">{it.detail}</span>
            </span>
          </button>
        );
      })}

      <div className="note-muted mt-16">
        Repères généraux (France, octobre 2026) : déclaration de naissance (Code civil), congé de paternité et congé supplémentaire de naissance (Code du travail numérique). Les règles évoluent et peuvent dépendre de ta convention collective : vérifie auprès de l’employeur, de la CPAM ou de la CAF.
      </div>
    </div>
  );
}
