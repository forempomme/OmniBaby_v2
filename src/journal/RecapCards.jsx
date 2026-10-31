import React, { useState } from 'react';
import { Icon } from '../icons.jsx';
import { formatTimeFR, formatElapsed } from '../utils.jsx';
import { durationText } from '../recap.js';

const KIND_ICON = { repas: 'bottle', change: 'droplet', sommeil: 'moon', tirelait: 'pump', note: 'note' };

// ----------------------------------------------------------------------
// « Pendant ton absence » : notes de l'autre parent depuis ta dernière
// ouverture de l'appli sur ce téléphone
// ----------------------------------------------------------------------
export function AbsenceCard({ summary, onDismiss }) {
  if (!summary) return null;
  const who = summary.names.length ? summary.names.join(' et ') : "L'autre parent";
  return (
    <div className="recap-card absence appear">
      <div className="recap-head">
        <span className="recap-ic"><Icon name="users" size={18} /></span>
        <div className="flex-1 min-w-0">
          <b>Pendant ton absence</b>
          <span>Depuis {formatTimeFR(summary.since)} (il y a {formatElapsed(Date.now() - summary.since)}) · {who} a noté :</span>
        </div>
        <button className="recap-x" onClick={onDismiss} aria-label="Fermer le résumé"><Icon name="x" size={18} /></button>
      </div>
      <ul className="recap-lines">
        {summary.lines.map((l, i) => (
          <li key={i}><Icon name={KIND_ICON[l.kind] || 'note'} size={15} /> {l.text}</li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------------
// Bilan de la nuit (affiché de 5 h à 12 h, une fois fermé : jusqu'au
// lendemain)
// ----------------------------------------------------------------------
const NIGHT_KEY = 'omnibaby_night_recap_closed';
const closedDay = () => { try { return localStorage.getItem(NIGHT_KEY); } catch (e) { return null; } };

export function NightRecapCard({ recap }) {
  const [closed, setClosed] = useState(() => closedDay());
  if (!recap || closed === recap.day) return null;
  const close = () => {
    try { localStorage.setItem(NIGHT_KEY, recap.day); } catch (e) { /* rien */ }
    setClosed(recap.day);
  };
  const meals = [recap.seins ? `${recap.seins} tétée${recap.seins > 1 ? 's' : ''}` : null, recap.bibs ? `${recap.bibs} biberon${recap.bibs > 1 ? 's' : ''}${recap.ml ? ` (${recap.ml} ml)` : ''}` : null].filter(Boolean).join(' · ');
  return (
    <div className="recap-card night appear">
      <div className="recap-head">
        <span className="recap-ic"><Icon name="moon" size={18} /></span>
        <div className="flex-1 min-w-0">
          <b>Bilan de la nuit</b>
          <span>{recap.bedtime ? `Coucher ${recap.bedtime}` : 'Depuis 19 h'}{recap.sleepingNow ? ' · dort encore' : recap.wake ? ` → lever ${recap.wake}` : ''}</span>
        </div>
        <button className="recap-x" onClick={close} aria-label="Fermer le bilan"><Icon name="x" size={18} /></button>
      </div>
      <div className="recap-kpis">
        <div><b>{recap.total ? durationText(recap.total) : '—'}</b><span>de sommeil</span></div>
        <div><b>{recap.longest ? durationText(recap.longest) : '—'}</b><span>plus long</span></div>
        <div><b>{recap.wakeups}</b><span>réveil{recap.wakeups > 1 ? 's' : ''}</span></div>
      </div>
      {(meals || recap.changes > 0) && (
        <div className="recap-foot">
          {meals && <span><Icon name="bottle" size={14} /> {meals}</span>}
          {recap.changes > 0 && <span><Icon name="droplet" size={14} /> {recap.changes} change{recap.changes > 1 ? 's' : ''}</span>}
        </div>
      )}
    </div>
  );
}
