import React, { useEffect, useRef, useState } from 'react';
import { formatTimeFR, formatElapsed, isToday, shareText, useToast } from '../utils.jsx';
import { Icon } from '../icons.jsx';
import { ENTRY_TYPES, entryStart, entryTime, formatMinutes } from './entryTypes.js';

// Horloge qui se rafraîchit chaque minute (temps écoulé des tampons)
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function estimateNextFeed(feeds) {
  if (feeds.length < 2) return null;
  const recent = feeds.slice(0, 5);
  let total = 0;
  let count = 0;
  for (let i = 0; i < recent.length - 1; i++) {
    const diff = entryTime(recent[i]) - entryTime(recent[i + 1]);
    if (diff > 0 && diff < 8 * 3600000) { total += diff; count++; }
  }
  if (!count) return null;
  return new Date(entryTime(feeds[0]) + total / count);
}

function buildShareSummary(today, child) {
  const feeds = today.filter((e) => e.type === 'biberon');
  const diapers = today.filter((e) => e.type === 'couche');
  const sleeps = today.filter((e) => e.type === 'sommeil' && !e.enCours);
  const milk = feeds.filter((b) => b.mode !== 'sein').reduce((s, b) => s + (Number(b.quantite) || 0), 0);
  const sleepMin = sleeps.reduce((s, e) => s + (Number(e.duree) || 0), 0);
  let txt = `Résumé du jour${child ? ` — ${child.nom}` : ''}\n`;
  txt += `Biberons / tétées : ${feeds.length}${milk ? ` (${milk} ml)` : ''}\n`;
  txt += `Changes : ${diapers.length}\n`;
  txt += `Sommeil : ${sleeps.length} période(s)${sleepMin ? ` (${formatMinutes(sleepMin)})` : ''}\n`;
  txt += '\nEnvoyé depuis OmniBaby';
  return txt;
}

// Appui long (≥ 500 ms) sans déclencher le clic qui suit
export function useLongPress(onLongPress, onClick) {
  const timer = useRef(null);
  const fired = useRef(false);
  const start = () => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      if (navigator.vibrate) navigator.vibrate(15);
      onLongPress();
    }, 500);
  };
  const cancel = () => clearTimeout(timer.current);
  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e) => e.preventDefault(),
    onClick: (e) => { if (fired.current) { e.preventDefault(); return; } onClick(); },
  };
}

// Tampon réutilisé par Dodo (icon / detailColor : variantes facultatives)
export function Stamp({ type, label, value, since, detail, active, live, onClick, onLongPress, ariaLabel, icon, detailColor }) {
  const def = ENTRY_TYPES[type];
  const handlers = useLongPress(onLongPress, onClick);
  return (
    <button
      className={`stamp ${active ? 'filter-active' : ''} ${live ? 'stamp-live' : ''}`}
      aria-label={ariaLabel}
      {...handlers}
    >
      <span className="stamp-icon" style={{ color: def.iconColor }}><Icon name={icon || def.svg} size={22} /></span>
      <span className="stamp-label">{label}</span>
      <span className="stamp-value">{value}</span>
      <span className="stamp-since">{since}</span>
      {detail && <span className="stamp-detail" style={{ color: detailColor || def.iconColor }}>{detail}</span>}
    </button>
  );
}

// ----------------------------------------------------------------------
// « Aujourd'hui en un coup d'œil » : temps écoulé depuis le dernier repas,
// le dernier change, et sommeil en cours. Tap = filtrer la liste,
// appui long = ajouter ce type d'entrée.
// ----------------------------------------------------------------------
export default function TodayOverview({ entries, child, filterType, setFilterType, onQuickAdd, onWake }) {
  const now = useNow();
  const showToast = useToast();
  const sorted = entries; // déjà triées du plus récent au plus ancien
  const today = sorted.filter((e) => isToday(entryStart(e)));

  const feeds = sorted.filter((e) => e.type === 'biberon');
  const lastFeed = feeds[0];
  const todayFeeds = today.filter((e) => e.type === 'biberon');
  const milk = todayFeeds.filter((b) => b.mode !== 'sein').reduce((s, b) => s + (Number(b.quantite) || 0), 0);
  const feedDetail = todayFeeds.length ? `${todayFeeds.length}×${milk ? ` · ${milk} ml` : ''}` : null;

  const lastDiaper = sorted.find((e) => e.type === 'couche');
  const todayDiapers = today.filter((e) => e.type === 'couche').length;

  const sleeping = sorted.find((e) => e.type === 'sommeil' && e.enCours);
  const lastSleep = sorted.find((e) => e.type === 'sommeil' && !e.enCours);
  const todaySleepMin = today.filter((e) => e.type === 'sommeil' && !e.enCours)
    .reduce((s, e) => s + (Number(e.duree) || 0), 0);
  const awakeSince = lastSleep ? (lastSleep.fin || entryStart(lastSleep)) : null;

  const nextFeed = estimateNextFeed(feeds);
  const toggle = (t) => setFilterType(filterType === t ? 'tous' : t);

  const handleShare = async () => {
    const r = await shareText(buildShareSummary(today, child), 'Résumé du jour');
    if (r === 'copied') showToast('Résumé copié', '📋');
  };

  return (
    <div className="card appear today-card">
      <div className="flex-between">
        <div className="section-title mb-0">Aujourd'hui</div>
        <button className="btn btn-ghost btn-sm" onClick={handleShare}>
          <Icon name="share" size={16} /> Partager
        </button>
      </div>
      <div className="stamp-row mt-8">
        <Stamp
          type="biberon" label="Repas"
          value={lastFeed ? formatElapsed(now - entryTime(lastFeed)) : '—'}
          since={lastFeed ? `depuis ${formatTimeFR(entryStart(lastFeed))}` : 'aucun'}
          detail={feedDetail}
          active={filterType === 'biberon'}
          onClick={() => toggle('biberon')}
          onLongPress={() => onQuickAdd('biberon')}
          ariaLabel="Dernier repas. Appui long pour ajouter."
        />
        <Stamp
          type="couche" label="Change"
          value={lastDiaper ? formatElapsed(now - entryTime(lastDiaper)) : '—'}
          since={lastDiaper ? `depuis ${formatTimeFR(entryStart(lastDiaper))}` : 'aucun'}
          detail={todayDiapers ? `${todayDiapers} change${todayDiapers > 1 ? 's' : ''}` : null}
          active={filterType === 'couche'}
          onClick={() => toggle('couche')}
          onLongPress={() => onQuickAdd('couche')}
          ariaLabel="Dernier change. Appui long pour ajouter."
        />
        {sleeping ? (
          <Stamp
            type="sommeil" label="Dort" live
            value={formatElapsed(now - entryTime(sleeping))}
            since={`depuis ${formatTimeFR(entryStart(sleeping))}`}
            detail="Réveil ›"
            onClick={() => onWake(sleeping)}
            onLongPress={() => onWake(sleeping)}
            ariaLabel="Sommeil en cours. Toucher pour noter le réveil."
          />
        ) : (
          <Stamp
            type="sommeil" label={lastSleep ? 'Éveillé' : 'Sommeil'}
            value={awakeSince ? formatElapsed(now - new Date(awakeSince).getTime()) : '—'}
            since={awakeSince ? `depuis ${formatTimeFR(awakeSince)}` : 'aucun'}
            detail={todaySleepMin ? formatMinutes(todaySleepMin) : null}
            active={filterType === 'sommeil'}
            onClick={() => toggle('sommeil')}
            onLongPress={() => onQuickAdd('sommeil')}
            ariaLabel="Sommeil. Appui long pour démarrer un sommeil."
          />
        )}
      </div>
      {nextFeed && nextFeed.getTime() > now - 3600000 && (
        <div className="muted" style={{ fontSize: '0.82rem' }}>
          Prochain repas estimé vers <strong style={{ color: 'var(--text)' }}>{formatTimeFR(nextFeed)}</strong>
          <span style={{ color: 'var(--text-faint)' }}> · appui long = ajouter</span>
        </div>
      )}
    </div>
  );
}
