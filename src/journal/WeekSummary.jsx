import React, { useMemo } from 'react';
import { toISODate, exportPDF, useToast } from '../utils.jsx';
import { entryStart, formatMinutes } from './entryTypes.js';

// ----------------------------------------------------------------------
// Moyennes sur la période affichée (vue « 7 jours »)
// ----------------------------------------------------------------------
export default function WeekSummary({ entries, store, child }) {
  const showToast = useToast();
  const stats = useMemo(() => {
    if (!entries.length) return null;
    const days = {};
    entries.forEach((e) => {
      const d = toISODate(new Date(entryStart(e)));
      if (!days[d]) days[d] = { feeds: 0, ml: 0, diapers: 0, sleepMin: 0 };
      if (e.type === 'biberon') { days[d].feeds++; if (e.mode !== 'sein') days[d].ml += Number(e.quantite) || 0; }
      if (e.type === 'couche') days[d].diapers++;
      if (e.type === 'sommeil' && !e.enCours) days[d].sleepMin += Number(e.duree) || 0;
    });
    const ds = Object.values(days);
    const n = ds.length;
    const avg = (k) => ds.reduce((s, d) => s + d[k], 0) / n;
    return {
      feeds: avg('feeds').toFixed(1).replace('.', ','),
      ml: Math.round(avg('ml')),
      diapers: avg('diapers').toFixed(1).replace('.', ','),
      sleep: avg('sleepMin') > 0 ? formatMinutes(avg('sleepMin')) : null,
      days: n,
    };
  }, [entries]);

  if (!stats) return null;

  const handlePDF = async () => {
    if (!child) return;
    try { await exportPDF(store, child); }
    catch (e) { showToast('Erreur PDF : ' + e.message, '⚠️'); }
  };

  const cells = [
    { val: stats.feeds, label: 'repas / j' },
    { val: stats.ml > 0 ? `${stats.ml} ml` : '—', label: 'lait / j' },
    { val: stats.diapers, label: 'changes / j' },
    ...(stats.sleep ? [{ val: stats.sleep, label: 'sommeil / j' }] : []),
  ];

  return (
    <div className="card appear" style={{ background: 'var(--surface-2)', marginBottom: 12 }}>
      <div className="section-title" style={{ marginBottom: 8 }}>
        Moyennes sur {stats.days} jour{stats.days > 1 ? 's' : ''} saisi{stats.days > 1 ? 's' : ''}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 8 }}>
        {cells.map((s) => (
          <div key={s.label} style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '.95rem' }}>{s.val}</div>
            <div style={{ fontSize: '.68rem', color: 'var(--text-soft)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="flex-between" style={{ marginTop: 8 }}>
        <div style={{ fontSize: '.72rem', color: 'var(--text-faint)' }}>Moyenne des jours avec au moins une saisie</div>
        <button className="btn btn-secondary btn-sm" onClick={handlePDF}>PDF pédiatre</button>
      </div>
    </div>
  );
}
