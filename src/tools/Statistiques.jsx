import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild } from '../store.jsx';
import { toISODate, daysAgo } from '../utils.jsx';

const PERIODS = [
  { key: '7d', label: '7 jours', days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '3m', label: '3 mois', days: 90 },
];

// ----------------------------------------------------------------------
// Build daily series for a given list of entries / sommeils
// ----------------------------------------------------------------------
function buildDailySeries(items, dateField, days, valueFn) {
  const cutoffDates = [];
  for (let i = days - 1; i >= 0; i--) {
    cutoffDates.push(toISODate(daysAgo(i)));
  }
  const map = {};
  for (const iso of cutoffDates) map[iso] = 0;

  for (const item of items) {
    const iso = toISODate(new Date(item[dateField]));
    if (map[iso] !== undefined) {
      map[iso] += valueFn ? valueFn(item) : 1;
    }
  }

  return cutoffDates.map((iso) => ({ iso, value: map[iso] }));
}

// ----------------------------------------------------------------------
// Bar chart component
// ----------------------------------------------------------------------
function BarChart({ series, color, unit, formatValue }) {
  const max = Math.max(1, ...series.map((d) => d.value));
  const showLabels = series.length <= 14;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: series.length > 31 ? 1 : 4, height: 110 }}>
        {series.map((d) => (
          <div
            key={d.iso}
            style={{
              flex: 1,
              background: d.value > 0 ? color : 'var(--border)',
              borderRadius: series.length > 31 ? 1 : 4,
              height: `${Math.max(2, (d.value / max) * 100)}%`,
              minWidth: series.length > 60 ? 1 : 2,
            }}
            title={`${new Date(d.iso).toLocaleDateString('fr-FR')} : ${formatValue ? formatValue(d.value) : d.value}${unit || ''}`}
          />
        ))}
      </div>
      {showLabels && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {series.map((d) => (
            <div key={d.iso} style={{ flex: 1, textAlign: 'center', fontSize: '0.62rem', color: 'var(--text-faint)' }}>
              {new Date(d.iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 1).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Stat card with average
// ----------------------------------------------------------------------
function StatCard({ title, icon, series, color, unit, formatValue }) {
  const total = series.reduce((sum, d) => sum + d.value, 0);
  const avg = series.length > 0 ? total / series.length : 0;

  return (
    <div className="card appear">
      <div className="section-title" style={{ marginBottom: 10 }}>{icon} {title}</div>
      <BarChart series={series} color={color} unit={unit} formatValue={formatValue} />
      <div className="flex-between mt-8" style={{ fontSize: '0.8rem' }}>
        <span className="muted">
          Moyenne : <strong style={{ color: 'var(--text)' }}>{formatValue ? formatValue(avg) : avg.toFixed(1)}</strong>{unit || ''} / jour
        </span>
        <span className="muted">Total : {formatValue ? formatValue(total) : total}{unit || ''}</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Statistiques module
// ----------------------------------------------------------------------
export default function StatistiquesTool() {
  const { store } = useStore();
  const activeChild = getActiveChild(store);
  const [period, setPeriod] = useState('7d');

  const days = PERIODS.find((p) => p.key === period).days;

  const childEntries = useMemo(
    () => filterByActiveChild(store.entries, store.activeChildId),
    [store.entries, store.activeChildId]
  );
  const childSommeils = useMemo(
    () => filterByActiveChild(store.sommeils, store.activeChildId),
    [store.sommeils, store.activeChildId]
  );

  const biberonSeries = useMemo(
    () => buildDailySeries(childEntries.filter((e) => e.type === 'biberon'), 'date', days),
    [childEntries, days]
  );

  const biberonMlSeries = useMemo(
    () => buildDailySeries(
      childEntries.filter((e) => e.type === 'biberon' && e.mode === 'biberon'),
      'date',
      days,
      (e) => e.quantite || 0
    ),
    [childEntries, days]
  );

  const coucheSeries = useMemo(
    () => buildDailySeries(childEntries.filter((e) => e.type === 'couche'), 'date', days),
    [childEntries, days]
  );

  const sommeilSeries = useMemo(
    () => buildDailySeries(childSommeils, 'debut', days, (s) => (s.duree || 0) / 60),
    [childSommeils, days]
  );

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour voir ses statistiques.</div>
      </div>
    );
  }

  const hasData = childEntries.length > 0 || childSommeils.length > 0;

  return (
    <div>
      <div className="chip-row">
        {PERIODS.map((p) => (
          <button key={p.key} className={`chip ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
        ))}
      </div>

      {!hasData ? (
        <div className="empty-state">
          <div className="emoji">📊</div>
          <div className="title">Pas encore de données</div>
          <div className="desc">Ajoute des entrées dans le Journal pour voir apparaître les statistiques.</div>
        </div>
      ) : (
        <>
          <StatCard
            title="Biberons / tétées par jour"
            icon="🍼"
            series={biberonSeries}
            color="var(--primary)"
            formatValue={(v) => v.toFixed(1)}
          />
          <StatCard
            title="Quantité de lait (ml/jour)"
            icon="🥛"
            series={biberonMlSeries}
            color="var(--accent-sun)"
            unit=" ml"
            formatValue={(v) => Math.round(v)}
          />
          <StatCard
            title="Couches par jour"
            icon="🧷"
            series={coucheSeries}
            color="var(--accent-sage)"
            formatValue={(v) => v.toFixed(1)}
          />
          <StatCard
            title="Sommeil (heures/jour)"
            icon="🌙"
            series={sommeilSeries}
            color="var(--accent-sky)"
            unit=" h"
            formatValue={(v) => v.toFixed(1)}
          />
        </>
      )}
    </div>
  );
}
