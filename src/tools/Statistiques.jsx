import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild, ageInMonths } from '../store.jsx';
import { toISODate, daysAgo } from '../utils.jsx';
import { useToast } from '../utils.jsx';
import { estimatePercentile, WEIGHT_LMS, HEIGHT_LMS, HEAD_LMS } from '../data/who-growth.js';

const PERIODS = [
  { key: '7d',  label: '7 jours', days: 7  },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '3m',  label: '3 mois',  days: 90 },
];

// ----------------------------------------------------------------------
// Build daily series
// ----------------------------------------------------------------------
function buildDailySeries(items, dateField, days, valueFn) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(toISODate(daysAgo(i)));
  const map = Object.fromEntries(dates.map(d => [d, 0]));
  for (const item of items) {
    const iso = toISODate(new Date(item[dateField] || item.date));
    if (map[iso] !== undefined) map[iso] += valueFn ? valueFn(item) : 1;
  }
  return dates.map(iso => ({ iso, value: map[iso] }));
}

// ----------------------------------------------------------------------
// Bar chart
// ----------------------------------------------------------------------
function BarChart({ series, color, unit, formatValue }) {
  const max = Math.max(1, ...series.map(d => d.value));
  const showLabels = series.length <= 14;
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', gap: series.length > 31 ? 1 : 4, height:110 }}>
        {series.map(d => (
          <div key={d.iso} style={{
            flex:1, background: d.value > 0 ? color : 'var(--border)',
            borderRadius: series.length > 31 ? 1 : 4,
            height:`${Math.max(2, (d.value/max)*100)}%`, minWidth: series.length > 60 ? 1 : 2,
          }} title={`${new Date(d.iso).toLocaleDateString('fr-FR')} : ${formatValue ? formatValue(d.value) : d.value}${unit||''}`} />
        ))}
      </div>
      {showLabels && (
        <div style={{ display:'flex', gap:4, marginTop:4 }}>
          {series.map(d => (
            <div key={d.iso} style={{ flex:1, textAlign:'center', fontSize:'.62rem', color:'var(--text-faint)' }}>
              {new Date(d.iso+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short'}).slice(0,1).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Stat card avec tendance
// ----------------------------------------------------------------------
function StatCard({ title, icon, series, color, unit, formatValue }) {
  const total = series.reduce((s, d) => s + d.value, 0);
  const avg = series.length > 0 ? total / series.length : 0;

  // Tendance : comparer première moitié vs deuxième moitié
  const half = Math.floor(series.length / 2);
  const avg1 = half > 0 ? series.slice(0, half).reduce((s,d)=>s+d.value,0)/half : 0;
  const avg2 = half > 0 ? series.slice(half).reduce((s,d)=>s+d.value,0)/(series.length-half) : 0;
  const trend = avg1 === 0 ? 0 : ((avg2 - avg1) / avg1) * 100;
  const trendLabel = Math.abs(trend) < 5 ? null : trend > 0 ? `↑ +${trend.toFixed(0)}%` : `↓ ${trend.toFixed(0)}%`;
  const trendColor = trend > 0 ? 'var(--accent-sage)' : 'var(--danger)';

  return (
    <div className="card appear">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div className="section-title" style={{ margin:0 }}>{icon} {title}</div>
        {trendLabel && (
          <span style={{ fontSize:'.72rem', fontWeight:700, color:trendColor,
            background: trend > 0 ? 'var(--accent-sage-soft)' : 'var(--danger-soft)',
            padding:'2px 8px', borderRadius:'var(--radius-pill)' }}>
            {trendLabel}
          </span>
        )}
      </div>
      <BarChart series={series} color={color} unit={unit} formatValue={formatValue} />
      <div className="flex-between mt-8" style={{ fontSize:'.8rem' }}>
        <span className="muted">
          Moy. : <strong style={{ color:'var(--text)' }}>{formatValue ? formatValue(avg) : avg.toFixed(1)}</strong>{unit||''}/j
        </span>
        <span className="muted">Total : {formatValue ? formatValue(total) : total}{unit||''}</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Courbe de croissance avec percentiles OMS
// ----------------------------------------------------------------------
function GrowthCurve({ mesures, type, sexe, label, unit, lmsTable }) {
  if (!mesures || mesures.length === 0) return null;

  const sorted = [...mesures]
    .filter(m => m.type === type && m.valeur)
    .sort((a, b) => a.date > b.date ? 1 : -1);

  if (sorted.length === 0) return null;

  const last = sorted[sorted.length-1];
  const prev = sorted[sorted.length-2];

  // Percentile de la dernière mesure
  const lastAgeM = last.ageM ?? 0;
  const lastPct = lmsTable ? estimatePercentile(lmsTable, sexe, lastAgeM, last.valeur) : null;

  // Couleur du percentile
  const pctColor = lastPct == null ? 'var(--text-soft)'
    : lastPct < 3  ? 'var(--danger)'
    : lastPct > 97 ? 'var(--accent-sky)'
    : 'var(--accent-sage)';

  const diff = prev ? (last.valeur - prev.valeur) : null;
  const diffStr = diff != null
    ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${unit} depuis ${new Date(prev.date).toLocaleDateString('fr-FR')}`
    : null;

  // Graphique SVG minimaliste (ligne + points)
  const svgW = 280, svgH = 80, PAD = 12;
  let points = null;
  if (sorted.length >= 2) {
    const vals = sorted.map(m => m.valeur);
    const minV = Math.min(...vals) * 0.98;
    const maxV = Math.max(...vals) * 1.02;
    const dates = sorted.map(m => new Date(m.date).getTime());
    const minD = Math.min(...dates);
    const maxD = Math.max(...dates);
    const scaleX = (d) => PAD + ((d - minD) / (maxD - minD || 1)) * (svgW - PAD*2);
    const scaleY = (v) => svgH - PAD - ((v - minV) / (maxV - minV || 1)) * (svgH - PAD*2);

    const ptArr = sorted.map(m => [scaleX(new Date(m.date).getTime()), scaleY(m.valeur)]);
    const pathD = ptArr.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const lastPt = ptArr[ptArr.length-1];
    points = { pathD, lastPt };
  }

  return (
    <div className="card appear">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div className="section-title" style={{ margin:0 }}>{label}</div>
        {lastPct != null && (
          <span style={{ fontSize:'.72rem', fontWeight:700, color:pctColor,
            padding:'2px 8px', borderRadius:'var(--radius-pill)',
            background: lastPct < 3||lastPct > 97 ? 'var(--danger-soft)' : 'var(--accent-sage-soft)' }}>
            P{lastPct}
          </span>
        )}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:8 }}>
        <div>
          <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'1.4rem', color:'var(--primary-deep)' }}>
            {last.valeur} <span style={{ fontSize:'.8rem', fontWeight:400 }}>{unit}</span>
          </div>
          <div style={{ fontSize:'.72rem', color:'var(--text-soft)', marginTop:2 }}>
            {new Date(last.date).toLocaleDateString('fr-FR')}
            {lastPct != null && ` · ${lastPct}e percentile`}
          </div>
          {diffStr && <div style={{ fontSize:'.7rem', color:diff>0?'var(--accent-sage)':'var(--accent-sun)', marginTop:2, fontWeight:600 }}>{diffStr}</div>}
        </div>
        {/* Graphique SVG */}
        {points && (
          <svg width={svgW} height={svgH} style={{ flex:1, maxWidth:svgW }}>
            <polyline fill="none" stroke="var(--border)" strokeWidth="1"
              points={sorted.map((_,i) => {
                const x = PAD + (i/(sorted.length-1||1))*(svgW-PAD*2);
                return `${x},${PAD}`;
              }).join(' ')} />
            <path d={points.pathD} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {sorted.map((m, i) => {
              const ptArr2 = sorted.map(m2 => {
                const vals = sorted.map(x=>x.valeur);
                const minV = Math.min(...vals)*0.98, maxV = Math.max(...vals)*1.02;
                const dates2 = sorted.map(x=>new Date(x.date).getTime());
                const minD2 = Math.min(...dates2), maxD2 = Math.max(...dates2);
                const x2 = PAD + ((new Date(m2.date).getTime()-minD2)/(maxD2-minD2||1))*(svgW-PAD*2);
                const y2 = svgH-PAD-((m2.valeur-minV)/(maxV-minV||1))*(svgH-PAD*2);
                return [x2, y2];
              });
              const [cx, cy] = ptArr2[i];
              return <circle key={i} cx={cx} cy={cy} r={i===sorted.length-1?4:2.5}
                fill={i===sorted.length-1?'var(--primary)':'var(--surface)'}
                stroke="var(--primary)" strokeWidth="1.5" />;
            })}
          </svg>
        )}
      </div>
      <div style={{ fontSize:'.68rem', color:'var(--text-faint)' }}>
        {sorted.length} mesure{sorted.length>1?'s':''} · Source : OMS 2006
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Export CSV
// ----------------------------------------------------------------------
function exportCSV(entries, childName) {
  const rows = [['Date','Type','Valeur','Unité','Note']];
  for (const e of entries) {
    if (e.type === 'biberon') {
      rows.push([e.date, 'Biberon', e.quantite||'', 'ml', e.note||'']);
    } else if (e.type === 'couche') {
      rows.push([e.date, 'Couche', e.contenu||'', '', e.note||'']);
    } else if (e.type === 'sommeil') {
      rows.push([e.date, e.sousType||'Sommeil', e.duree||'', 'min', e.note||'']);
    }
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `omnibaby-${childName}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------
// Main StatistiquesTool
// ----------------------------------------------------------------------
export default function StatistiquesTool() {
  const { store } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [period, setPeriod] = useState('7d');
  const [tab, setTab] = useState('journal');

  const days = PERIODS.find(p => p.key === period).days;
  const ageM = ageInMonths(activeChild?.birthdate) ?? 0;

  const childEntries = useMemo(
    () => filterByActiveChild(store.entries||[], store.activeChildId),
    [store.entries, store.activeChildId]
  );
  const childMesures = useMemo(
    () => filterByActiveChild(store.mesures||[], store.activeChildId)
      .map(m => ({
        ...m,
        ageM: m.date && activeChild?.birthdate
          ? Math.round((new Date(m.date)-new Date(activeChild.birthdate))/(1000*60*60*24*30.44))
          : 0
      })),
    [store.mesures, store.activeChildId, activeChild]
  );
  const childSommeils = useMemo(
    () => childEntries.filter(e => e.type === 'sommeil'),
    [childEntries]
  );

  // Séries temporelles
  const biberonSeries   = useMemo(() => buildDailySeries(childEntries.filter(e=>e.type==='biberon'),'date',days), [childEntries,days]);
  const biberonMlSeries = useMemo(() => buildDailySeries(childEntries.filter(e=>e.type==='biberon'&&e.mode==='biberon'),'date',days,(e)=>e.quantite||0), [childEntries,days]);
  const coucheSeries    = useMemo(() => buildDailySeries(childEntries.filter(e=>e.type==='couche'),'date',days), [childEntries,days]);
  const sommeilSeries   = useMemo(() => buildDailySeries(childSommeils,'date',days,(s)=>(s.duree||0)/60), [childSommeils,days]);

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour voir ses statistiques.</div>
      </div>
    );
  }

  const hasJournalData = childEntries.length > 0;
  const hasMesures = childMesures.length > 0;

  return (
    <div>
      {/* Onglets */}
      <div className="chip-row">
        <button className={`chip ${tab==='journal'?'active':''}`} onClick={()=>setTab('journal')}>📊 Journal</button>
        <button className={`chip ${tab==='croissance'?'active':''}`} onClick={()=>setTab('croissance')}>📈 Croissance</button>
      </div>

      {tab === 'journal' && (
        <>
          <div className="chip-row">
            {PERIODS.map(p => (
              <button key={p.key} className={`chip ${period===p.key?'active':''}`} onClick={()=>setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>

          {/* Bouton export CSV */}
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              exportCSV(childEntries, activeChild.nom);
              showToast('Export CSV téléchargé', '📥');
            }}>
              📥 Export CSV
            </button>
          </div>

          {!hasJournalData ? (
            <div className="empty-state">
              <div className="emoji">📊</div>
              <div className="title">Pas encore de données</div>
              <div className="desc">Ajoute des entrées dans le Journal pour voir les statistiques.</div>
            </div>
          ) : (
            <>
              <StatCard title="Biberons / tétées" icon="🍼" series={biberonSeries} color="var(--primary)" formatValue={v=>v.toFixed(1)} />
              <StatCard title="Lait biberon" icon="🥛" series={biberonMlSeries} color="var(--accent-sun)" unit=" ml" formatValue={v=>Math.round(v)} />
              <StatCard title="Couches" icon="🧷" series={coucheSeries} color="var(--accent-sage)" formatValue={v=>v.toFixed(1)} />
              <StatCard title="Sommeil" icon="🌙" series={sommeilSeries} color="var(--accent-sky)" unit=" h" formatValue={v=>v.toFixed(1)} />
            </>
          )}
        </>
      )}

      {tab === 'croissance' && (
        <>
          {!hasMesures ? (
            <div className="empty-state">
              <div className="emoji">📏</div>
              <div className="title">Aucune mesure</div>
              <div className="desc">Ajoute des mesures dans l'onglet Santé pour voir les courbes de croissance.</div>
            </div>
          ) : (
            <>
              <div className="muted" style={{ fontSize:'.78rem', marginBottom:12 }}>
                Courbes OMS · {activeChild.nom} · {ageM} mois · {activeChild.sexe === 'garcon' ? 'Garçon' : 'Fille'}
              </div>
              <GrowthCurve mesures={childMesures} type="poids"    sexe={activeChild.sexe} label="⚖️ Poids"             unit="kg" lmsTable={WEIGHT_LMS} />
              <GrowthCurve mesures={childMesures} type="taille"   sexe={activeChild.sexe} label="📏 Taille"            unit="cm" lmsTable={HEIGHT_LMS} />
              <GrowthCurve mesures={childMesures} type="perimetre" sexe={activeChild.sexe} label="🧠 Périmètre crânien" unit="cm" lmsTable={HEAD_LMS}   />
              <div className="muted" style={{ fontSize:'.7rem', marginTop:8 }}>
                P = percentile OMS. P50 = médiane mondiale. P3-P97 = intervalle normal.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
