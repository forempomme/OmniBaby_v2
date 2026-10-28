import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Icon, UiIcon } from './icons.jsx';

// ----------------------------------------------------------------------
// Dates
// ----------------------------------------------------------------------
export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// « YYYY-MM-DD » → minuit HEURE LOCALE (new Date('YYYY-MM-DD') donne
// minuit UTC, soit 1 h ou 2 h du matin en France : âge faux d'un jour
// la nuit, rappels programmés en pleine nuit). Autres formats : Date().
export function parseLocalDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const m = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

// Format « datetime-local » (heure locale, sans fuseau)
export function toISODateTime(d = new Date()) {
  return `${toISODate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Date stockée (ISO UTC ou locale) → valeur pour <input type="datetime-local">
export function toLocalDT(value) {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : toISODateTime(d);
}

// Horodatage numérique quel que soit le format stocké. Les anciennes entrées
// mélangent « 2026-10-19T14:05 » (local) et « 2026-10-19T12:05:00.000Z »
// (UTC) : un tri par comparaison de chaînes les mettait dans le désordre.
export function toTime(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return isNaN(t) ? 0 : t;
}

export function sortByDateDesc(list, field = 'date') {
  return [...list].sort((a, b) => toTime(b[field]) - toTime(a[field]));
}

export function formatDateFR(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + (isoDate.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateLongFR(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + (isoDate.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatTimeFR(isoDateTime) {
  if (!isoDateTime) return '—';
  const d = new Date(isoDateTime);
  if (isNaN(d.getTime())) return '—';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDateTimeFR(isoDateTime) {
  if (!isoDateTime) return '—';
  return `${formatDateFR(toISODate(new Date(isoDateTime)))} ${formatTimeFR(isoDateTime)}`;
}

// Durée écoulée lisible : « 38 min », « 2 h 15 », « 1 j 3 h »
export function formatElapsed(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return '< 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${pad2(min % 60)}`;
  return `${Math.floor(h / 24)} j ${h % 24} h`;
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isSameDay(a, b) {
  return toISODate(new Date(a)) === toISODate(new Date(b));
}

export function isToday(dateLike) {
  return isSameDay(new Date(dateLike), new Date());
}

export function groupByDay(items, dateField) {
  const groups = {};
  for (const item of items) {
    const day = toISODate(new Date(item[dateField]));
    if (!groups[day]) groups[day] = [];
    groups[day].push(item);
  }
  return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export function dayLabel(isoDay) {
  const today = toISODate();
  if (isoDay === today) return "Aujourd'hui";
  if (isoDay === toISODate(daysAgo(1))) return 'Hier';
  const day = new Date(isoDay + 'T12:00:00');
  const diffDays = Math.round((new Date(today + 'T12:00:00') - day) / 86400000);
  if (diffDays > 1 && diffDays < 7) {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return `${jours[day.getDay()]} (il y a ${diffDays} jours)`;
  }
  return formatDateLongFR(isoDay);
}

// ----------------------------------------------------------------------
// Toast
// ----------------------------------------------------------------------
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  // opts : { duration: ms, action: { label, onClick } } — ex. « Annuler » 5 s
  const showToast = useCallback((message, icon = '✅', opts = {}) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const duration = opts.duration || (opts.action ? 5000 : 2200);
    setToast({ message, icon, action: opts.action || null, duration, key: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  const runAction = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const a = toast?.action;
    setToast(null);
    if (a) a.onClick();
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div className={`toast ${toast.action ? 'toast-action' : ''}`} role="status" key={toast.key}>
          {!toast.action && <span className="toast-icon"><UiIcon value={toast.icon} size={18} /></span>}
          <span className="toast-msg">{toast.message}</span>
          {toast.action && <button className="toast-btn" onClick={runAction}>{toast.action.label}</button>}
          {toast.action && <span className="toast-progress" style={{ animationDuration: `${toast.duration}ms` }} />}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider');
  return ctx;
}

// ----------------------------------------------------------------------
// Confirmation inline (✕ → « Confirmer »)
// ----------------------------------------------------------------------
export function ConfirmInline({ onConfirm, icon = '🗑️' }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="btn btn-ghost btn-sm" aria-label="Supprimer" onClick={(e) => { e.stopPropagation(); setConfirming(true); }}>
        <Icon name="x" size={18} />
      </button>
    );
  }

  return (
    <span className="confirm-inline">
      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setConfirming(false); }}>
        Annuler
      </button>
      <button
        className="btn btn-danger btn-sm"
        onClick={(e) => { e.stopPropagation(); onConfirm(); setConfirming(false); }}
      >
        <UiIcon value={icon} size={15} /> Confirmer
      </button>
    </span>
  );
}

// ----------------------------------------------------------------------
// Glisser pour supprimer (listes secondaires : mesures, fièvre, historique)
// ----------------------------------------------------------------------
export function SwipeToDelete({ onDelete, children, disabled = false }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const startX = useRef(0);
  const THRESHOLD = -72;

  if (disabled) return <div className="swipe-wrap"><div className="swipe-content">{children}</div></div>;

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; setDragging(true); };
  const onTouchMove = (e) => {
    if (!dragging) return;
    const diff = e.touches[0].clientX - startX.current;
    setDragX(Math.max(-90, Math.min(0, diff)));
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (dragX < THRESHOLD) { setConfirming(true); setDragX(-90); }
    else setDragX(0);
  };

  return (
    <div className="swipe-wrap">
      {confirming && (
        <div className="swipe-action">
          <button className="btn btn-sm" style={{ background: 'transparent', color: '#fff', fontWeight: 700 }} onClick={() => onDelete()}>
            Supprimer
          </button>
          <button className="btn btn-sm" style={{ background: 'transparent', color: '#fff' }} onClick={() => { setConfirming(false); setDragX(0); }}>
            Annuler
          </button>
        </div>
      )}
      <div
        className="swipe-content"
        style={{ transform: `translateX(${dragX}px)` }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Confettis
// ----------------------------------------------------------------------
export function fireConfetti() {
  const emojis = ['🎉', '✨', '🎊', '⭐', '💫'];
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = `${Math.random() * 100}%`;
    el.style.animationDuration = `${1.2 + Math.random() * 1.2}s`;
    el.style.fontSize = `${0.9 + Math.random() * 1}rem`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
}

// ----------------------------------------------------------------------
// Accordéon — l'état ouvert/fermé survit aux changements d'onglet
// (mémoire de session, pas localStorage)
// ----------------------------------------------------------------------
const accordionState = {};

function useAccordionState(key, defaultOpen = false) {
  const [open, setOpen] = React.useState(() => (key in accordionState ? accordionState[key] : defaultOpen));
  const toggle = React.useCallback(() => {
    setOpen((o) => { accordionState[key] = !o; return !o; });
  }, [key]);
  return [open, toggle];
}

// icon : emoji (texte) ; iconName : nom d'icône SVG (icons.jsx), prioritaire
export function Accordion({ icon, iconName, title, subtitle, badge, badgeColor, children, defaultOpen = false, stateKey }) {
  const [open, toggle] = useAccordionState(stateKey || ('acc_' + title), defaultOpen);
  return (
    <div className={`acc ${open ? 'open' : ''}`}>
      <button className={`acc-h ${open ? 'open' : ''}`} onClick={toggle} aria-expanded={open}>
        {(iconName || icon) && (
          <span className="acc-icon">
            {iconName ? <Icon name={iconName} size={18} /> : <span style={{ fontSize: '1.05rem' }}>{icon}</span>}
          </span>
        )}
        <span className="acc-text">
          <span className="acc-title">
            {title}
            {badge != null && (
              <span className="acc-badge" style={badgeColor ? { background: badgeColor } : undefined}>{badge}</span>
            )}
          </span>
          {subtitle && <span className="acc-sub">{subtitle}</span>}
        </span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} className="acc-chev" />
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------
// Partage de fichiers : cache Capacitor + sélecteur natif Android,
// téléchargement classique dans un navigateur.
// ----------------------------------------------------------------------
function isNativePlatform() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export async function shareFileNative(filename, mimeType, base64Data) {
  if (isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const writeResult = await Filesystem.writeFile({ path: filename, data: base64Data, directory: Directory.Cache });
    await Share.share({ title: filename, url: writeResult.uri, dialogTitle: 'Partager / Enregistrer' });
    return;
  }
  const byteString = atob(base64Data);
  const ia = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([ia], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Partage de texte (code d'invitation, résumé du jour)
// Retourne 'shared' | 'copied' | 'cancelled'
export async function shareText(text, title = 'OmniBaby') {
  try {
    if (isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) { await navigator.share({ title, text }); return 'shared'; }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    return 'cancelled';
  }
}

export async function shareJSON(store) {
  const data = JSON.stringify(store, null, 2);
  const filename = `omnibaby-export-${toISODate()}.json`;
  const base64 = btoa(unescape(encodeURIComponent(data)));
  await shareFileNative(filename, 'application/json', base64);
}

// PDF pédiatre : module chargé à la demande (jsPDF + police ≈ 500 ko)
export async function exportPDF(store, child) {
  const { exportPediatricPDF } = await import('./pdf.js');
  return exportPediatricPDF(store, child);
}

// ----------------------------------------------------------------------
// Notifications locales (@capacitor/local-notifications)
// ----------------------------------------------------------------------
// Identifiant numérique de notification (Android exige un entier 32 bits).
// ≤ v3.9 : somme des codes de caractères → deux rappels pouvaient obtenir le
// même numéro et le second remplaçait le premier. Désormais : hash FNV-1a.
function legacyNotifId(id) {
  return Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 2147483647;
}
function notifNumericId(id) {
  if (typeof id === 'number') return id;
  let h = 0x811c9dc5;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % 2147483646) + 1;
}

export async function requestNotifPermission() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch (e) { return false; }
}

// extra : données rendues au toucher (localNotificationActionPerformed)
// allowWhileIdle : rappel proche (quelques minutes) à tenir même écran éteint
export async function scheduleNotif({ id, title, body, at, extra, allowWhileIdle = false }) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{
        id: notifNumericId(id),
        title,
        body,
        schedule: { at: new Date(at), ...(allowWhileIdle ? { allowWhileIdle: true } : {}) },
        ...(extra ? { extra } : {}),
        sound: null,
        smallIcon: 'ic_stat_omnibaby', // android-res/drawable (pieds + cœur, blanc)
        iconColor: '#C96F4A',
      }],
    });
    return true;
  } catch (e) { console.error('[Notif]', e); return false; }
}

export async function cancelNotif(id) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const ids = typeof id === 'number' ? [id] : [notifNumericId(id), legacyNotifId(id)];
    await LocalNotifications.cancel({ notifications: ids.map((n) => ({ id: n })) });
  } catch (e) {}
}
