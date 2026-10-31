import React from 'react';
import { useStore } from '../store.jsx';
import { useToast, toISODate, formatDateFR } from '../utils.jsx';
import { Icon } from '../icons.jsx';
import { VITK_DOSES, vitKCase, thirdDoseDate, scheduleVitKNotif } from '../vitaminK.js';

// ----------------------------------------------------------------------
// Vitamine K (allaitement) : 3 doses, la 3e à 1 mois
// ----------------------------------------------------------------------
export default function VitaminKCard({ child, canEdit }) {
  const { store, update } = useStore();
  const showToast = useToast();
  const kase = vitKCase(child);
  const third = thirdDoseDate(child);

  const toggle = (key) => {
    if (!canEdit) return;
    const was = child.vitK?.[key];
    const vitK = { ...(child.vitK || {}), [key]: was ? null : toISODate() };
    update((d) => {
      const c = d.children.find((x) => x.id === child.id);
      if (c) c.vitK = vitK;
      return d;
    });
    scheduleVitKNotif({ ...child, vitK }, store.settings?.notifs?.vaccin !== false);
    showToast(was ? 'Dose retirée' : 'Dose notée', was ? '↩️' : '✅');
  };

  return (
    <div className="vitk">
      <div className="fd-h"><Icon name="pill" size={15} /> Vitamine K</div>
      <div className="vitk-list">
        {VITK_DOSES.map((d) => {
          const done = child.vitK?.[d.key];
          const optional = d.key === 'd3' && kase !== 'exclusif';
          return (
            <button key={d.key} className={`vitk-dose ${done ? 'done' : ''}`} onClick={() => toggle(d.key)} disabled={!canEdit}>
              <span className="vitk-box">{done ? <Icon name="check" size={14} /> : null}</span>
              <span className="vitk-txt">
                <b>{d.label}</b>
                <span>{done ? `donnée le ${formatDateFR(done)}` : d.key === 'd3' && third ? `${d.when}, vers le ${formatDateFR(toISODate(third))}` : d.when}{optional && !done ? ' · à voir avec le pédiatre' : ''}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="muted fs-78 mt-8">
        {kase === 'exclusif'
          ? 'Bébé allaité : 3 doses de 2 mg par la bouche. Les 2 premières sont données à la maternité, la 3e à 1 mois, à la maison (rappel prévu ce jour-là à 9 h).'
          : 'Allaitement mixte : la 3e dose (1 mois) est recommandée en allaitement exclusif et peut être omise en lait infantile exclusif. Demande au pédiatre.'}
      </div>
    </div>
  );
}
