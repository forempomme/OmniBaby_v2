import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild, ageInMonths, HISTORY_WINDOW_DAYS } from '../store.jsx';
import { useFullHistory, HistoryNotice } from '../HistoryNotice.jsx';
import { toISODate, useToast, toTime, formatDateFR } from '../utils.jsx';
import { Icon, UiIcon } from '../icons.jsx';
import { estimatePercentile, WEIGHT_LMS, HEIGHT_LMS, HEAD_LMS } from '../data/who-growth.js';

const PERIODS = [
  { key: '7d',  label: '7 jours', days: 7  },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '3m',  label: '3 mois',  days: 90 },
];

// ----------------------------------------------------------------------
// Build daily series
// ----------------------------------------------------------------------
function buildDailySeries(items, dateField, days, valueFn, now = new Date()) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(toISODate(d));
  }
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
// Tétées au sein (v3.16) : durée moyenne, intervalle entre repas, côtés
// ----------------------------------------------------------------------
export function feedStats(entries, days, now = new Date()) {
  const since = new Date(now); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1));
  const feeds = (entries || []).filter((e) => e.type === 'biberon' && new Date(e.date) >= since && new Date(e.date) <= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const seins = feeds.filter((e) => e.mode === 'sein');
  const timed = seins.filter((e) => Number(e.duree) > 0);
  const avgDuree = timed.length ? timed.reduce((s, e) => s + Number(e.duree), 0) / timed.length : null;
  // Intervalle médian entre deux repas (tétées et biberons) : moins
  // sensible qu'une moyenne aux nuits longues
  const gaps = [];
  for (let i = 1; i < feeds.length; i++) gaps.push((new Date(feeds[i].date) - new Date(feeds[i - 1].date)) / 60000);
  gaps.sort((a, b) => a - b);
  const medianGap = gaps.length ? (gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2) : null;
  const sides = { gauche: 0, droit: 0, deux: 0 };
  for (const e of seins) if (sides[e.cote] !== undefined) sides[e.cote]++;
  return { count: seins.length, perDay: seins.length / days, avgDuree, medianGap, sides };
}

const hm = (min) => (min == null ? '—' : min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`);

function FeedCard({ entries, days, series }) {
  const st = feedStats(entries, days);
  if (!st.count) return null;
  const total = st.sides.gauche + st.sides.droit + st.sides.deux || 1;
  const pct = (n) => Math.round((n / total) * 100);
  return (
    <div className="card appear">
      <div className="section-title"><Icon name="baby" size={18} style={{ color: 'var(--primary)' }} /> Tétées au sein</div>
      <BarChart series={series} color="var(--primary)" formatValue={(v) => v} />
      <div className="feed-kpis">
        <div><b>{st.perDay.toFixed(1)}</b><span>par jour</span></div>
        <div><b>{hm(st.avgDuree)}</b><span>durée moyenne</span></div>
        <div><b>{hm(st.medianGap)}</b><span>entre 2 repas</span></div>
      </div>
      <div className="side-split" aria-label="Répartition des côtés">
        {st.sides.gauche > 0 && <i className="g" style={{ flex: st.sides.gauche }} />}
        {st.sides.deux > 0 && <i className="b" style={{ flex: st.sides.deux }} />}
        {st.sides.droit > 0 && <i className="d" style={{ flex: st.sides.droit }} />}
      </div>
      <div className="flex-between muted fs-78 mt-8">
        <span>Gauche {pct(st.sides.gauche)} %</span>
        {st.sides.deux > 0 && <span>Les deux {pct(st.sides.deux)} %</span>}
        <span>Droit {pct(st.sides.droit)} %</span>
      </div>
      <div className="muted fs-78 mt-8">Durée moyenne calculée sur les tétées chronométrées ou dont la durée est notée. Intervalle : médiane entre deux repas (tétées et biberons).</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Stat card avec tendance
// ----------------------------------------------------------------------
function StatCard({ title, iconName, series, color, unit, formatValue }) {
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
        <div className="section-title m-0"><Icon name={iconName} size={18} style={{ color }} /> {title}</div>
        {trendLabel && (
          <span style={{ fontSize:'.72rem', fontWeight:700, color:trendColor,
            background: trend > 0 ? 'var(--accent-sage-soft)' : 'var(--danger-soft)',
            padding:'2px 8px', borderRadius:'var(--radius-pill)' }}>
            {trendLabel}
          </span>
        )}
      </div>
      <BarChart series={series} color={color} unit={unit} formatValue={formatValue} />
      <div className="flex-between mt-8 fs-80">
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
    .sort((a, b) => toTime(a.date) - toTime(b.date));

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
        <div className="section-title m-0">{label}</div>
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
// Lait au biberon par kilo (v3.10)
// Repère indicatif : règle d'Appert, poids (g) ÷ 10 + 250 ml/j, jusqu'à 6 mois.
// ----------------------------------------------------------------------
export function milkStats(entries, mesures, days, now = new Date()) {
  const today = toISODate(now);
  const series = buildDailySeries(entries.filter((e) => e.type === 'biberon' && e.mode !== 'sein'), 'date', days, (e) => Number(e.quantite) || 0, now);
  // Moyenne sur les jours terminés ayant au moins un biberon (aujourd'hui exclu)
  const complete = series.filter((d) => d.iso !== today && d.value > 0);
  const avg = complete.length ? complete.reduce((s, d) => s + d.value, 0) / complete.length : null;
  const poids = mesures.filter((m) => m.type === 'poids' && Number(m.valeur) > 0)
    .sort((a, b) => toTime(b.date) - toTime(a.date))[0] || null;
  const kg = poids ? Number(poids.valeur) : null;
  return {
    series,
    avg,
    kg,
    poidsDate: poids?.date || null,
    perKg: avg != null && kg ? avg / kg : null,
    appert: kg ? Math.round(kg * 1000 / 10 + 250) : null,
    daysCounted: complete.length,
  };
}

function MilkCard({ child, entries, mesures, days }) {
  const ageM = ageInMonths(child.birthdate) ?? 0;
  const st = useMemo(() => milkStats(entries, mesures, days), [entries, mesures, days]);
  if (child.alimentation === 'allaitement') return null; // quantités inconnues au sein
  const showAppert = ageM < 6 && st.appert;
  const max = Math.max(1, ...st.series.map((d) => d.value), showAppert ? st.appert : 0);
  const today = toISODate();
  return (
    <div className="card appear">
      <div className="flex-between" style={{ marginBottom: 10 }}>
        <div className="section-title m-0"><Icon name="bottle" size={18} style={{ color: 'var(--primary)' }} /> Lait au biberon</div>
        {st.kg && <span className="muted" style={{ fontSize: '.74rem' }}>poids {String(st.kg).replace('.', ',')} kg · {formatDateFR(st.poidsDate)}</span>}
      </div>
      <div className="milk-kpis">
        <div><strong>{st.avg != null ? `${Math.round(st.avg)} ml` : '—'}</strong><span>par jour (moyenne)</span></div>
        <div><strong>{st.perKg != null ? `${Math.round(st.perKg)} ml` : '—'}</strong><span>par kg et par jour</span></div>
      </div>
      {days <= 31 && (
        <div className="milk-bars">
          {showAppert && (
            <div className="milk-guide" style={{ bottom: `${(st.appert / max) * 100}%` }}>
              <span>repère {st.appert} ml</span>
            </div>
          )}
          {st.series.map((d) => (
            <div key={d.iso} className={`milk-bar ${d.iso === today ? 'today' : ''}`}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
              title={`${formatDateFR(d.iso)} : ${d.value} ml`} />
          ))}
        </div>
      )}
      {!st.kg && <div className="muted mt-8 fs-78">Ajoute une pesée (Santé → Poids) pour le calcul par kilo.</div>}
      <div className="info-box warn mt-8 mb-0">
        <Icon name="info" size={18} />
        <span>
          {child.alimentation === 'mixte' && <><strong>Allaitement mixte :</strong> les tétées ne sont pas comptées, ce total est partiel. </>}
          {showAppert
            ? <>Repère indicatif (règle d'Appert, jusqu'à 6 mois) : {Math.round(st.kg * 1000)} g ÷ 10 + 250 = {st.appert} ml/j.</>
            : <>Moyenne des jours terminés avec au moins un biberon ({st.daysCounted} j).</>}
          {' '}Indication seulement : l'appétit varie, demande au pédiatre en cas de doute.
        </span>
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
    if (e.type === 'biberon' && e.mode === 'sein') {
      rows.push([e.date, 'Tétée ' + (e.cote||''), e.duree||'', 'min', e.note||'']);
    } else if (e.type === 'biberon') {
      rows.push([e.date, 'Biberon', e.quantite||'', 'ml', e.note||'']);
    } else if (e.type === 'tirelait') {
      rows.push([e.date, 'Tire-lait', e.quantite||'', 'ml', e.note||'']);
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
  a.download = `omnibaby-${childName}-${toISODate()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------
// Main StatistiquesTool
// ----------------------------------------------------------------------
export default function StatistiquesTool() {
  const { store, loadHistory, getStore } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [period, setPeriod] = useState('7d');
  const [tab, setTab] = useState('journal');

  const days = PERIODS.find(p => p.key === period).days;
  // Au-delà de 60 jours : historique complet nécessaire
  useFullHistory(tab === 'journal' && days > HISTORY_WINDOW_DAYS);
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
  const biberonMlSeries = useMemo(() => buildDailySeries(childEntries.filter(e=>e.type==='biberon'&&e.mode!=='sein'),'date',days,(e)=>Number(e.quantite)||0), [childEntries,days]);
  const coucheSeries    = useMemo(() => buildDailySeries(childEntries.filter(e=>e.type==='couche'),'date',days), [childEntries,days]);
  const sommeilSeries   = useMemo(() => buildDailySeries(childSommeils,'date',days,(s)=>(s.duree||0)/60), [childSommeils,days]);
  const teteeSeries     = useMemo(() => buildDailySeries(childEntries.filter(e=>e.type==='biberon'&&e.mode==='sein'),'date',days), [childEntries,days]);
  const tirelait        = useMemo(() => childEntries.filter(e=>e.type==='tirelait'), [childEntries]);
  const tirelaitSeries  = useMemo(() => buildDailySeries(tirelait,'date',days,(e)=>Number(e.quantite)||0), [tirelait,days]);

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji"><UiIcon value="👶" size={40} /></div>
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
        <button className={`chip ${tab==='journal'?'active':''}`} onClick={()=>setTab('journal')}>Journal</button>
        <button className={`chip ${tab==='croissance'?'active':''}`} onClick={()=>setTab('croissance')}>Croissance</button>
      </div>

      {tab === 'journal' && (
        <>
          <div className="chip-row">
            {PERIODS.map(p => (
              <button key={p.key} className={`chip ${period===p.key?'active':''}`} onClick={()=>setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>

          {/* Bouton export CSV */}
          <div className="row-end">
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              // Le CSV contient tout l'historique : on le charge d'abord
              const complete = await loadHistory();
              const s = getStore();
              exportCSV(filterByActiveChild(s.entries || [], s.activeChildId), activeChild.nom);
              showToast(complete ? 'Export CSV téléchargé' : 'Export CSV (historique ancien indisponible hors connexion)', complete ? '📥' : '⚠️');
            }}>
              Export CSV
            </button>
          </div>

          {days > HISTORY_WINDOW_DAYS && <HistoryNotice compact />}

          {!hasJournalData ? (
            <div className="empty-state">
              <div className="emoji"><UiIcon value="📊" size={40} /></div>
              <div className="title">Pas encore de données</div>
              <div className="desc">Ajoute des entrées dans le Journal pour voir les statistiques.</div>
            </div>
          ) : (
            <>
              <MilkCard child={activeChild} entries={childEntries} mesures={childMesures} days={days} />
              <StatCard title="Biberons / tétées" iconName="bottle" series={biberonSeries} color="var(--primary)" formatValue={v=>v.toFixed(1)} />
              <FeedCard entries={childEntries} days={days} series={teteeSeries} />
              <StatCard title="Lait biberon" iconName="bottle" series={biberonMlSeries} color="var(--accent-sun)" unit=" ml" formatValue={v=>Math.round(v)} />
              <StatCard title="Couches" iconName="droplet" series={coucheSeries} color="var(--accent-sage)" formatValue={v=>v.toFixed(1)} />
              <StatCard title="Sommeil" iconName="moon" series={sommeilSeries} color="var(--accent-sky)" unit=" h" formatValue={v=>v.toFixed(1)} />
              {tirelait.length > 0 && <StatCard title="Tire-lait" iconName="pump" series={tirelaitSeries} color="var(--accent-sky)" unit=" ml" formatValue={v=>Math.round(v)} />}
            </>
          )}
        </>
      )}

      {tab === 'croissance' && (
        <>
          {!hasMesures ? (
            <div className="empty-state">
              <div className="emoji"><UiIcon value="📏" size={40} /></div>
              <div className="title">Aucune mesure</div>
              <div className="desc">Ajoute des mesures dans l'onglet Santé pour voir les courbes de croissance.</div>
            </div>
          ) : (
            <>
              <div className="muted" style={{ fontSize:'.78rem', marginBottom:12 }}>
                Courbes OMS · {activeChild.nom} · {ageM} mois · {activeChild.sexe === 'garcon' ? 'Garçon' : 'Fille'}
              </div>
              <GrowthCurve mesures={childMesures} type="poids"    sexe={activeChild.sexe} label="Poids"             unit="kg" lmsTable={WEIGHT_LMS} />
              <GrowthCurve mesures={childMesures} type="taille"   sexe={activeChild.sexe} label="Taille"            unit="cm" lmsTable={HEIGHT_LMS} />
              <GrowthCurve mesures={childMesures} type="perimetre" sexe={activeChild.sexe} label="Périmètre crânien" unit="cm" lmsTable={HEAD_LMS}   />
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
