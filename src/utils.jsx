import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

// ----------------------------------------------------------------------
// Date / time formatting helpers
// ----------------------------------------------------------------------
export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toISODateTime(d = new Date()) {
  return `${toISODate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDateFR(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + (isoDate.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateLongFR(isoDate) {
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
  return `${formatDateFR(isoDateTime)} ${formatTimeFR(isoDateTime)}`;
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function isSameDay(a, b) {
  return toISODate(new Date(a)) === toISODate(new Date(b));
}

export function isToday(dateLike) {
  return isSameDay(new Date(dateLike), new Date());
}

export function isYesterday(dateLike) {
  const y = daysAgo(1);
  return isSameDay(new Date(dateLike), y);
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
  if (isToday(isoDay + 'T12:00:00')) return "Aujourd'hui";
  if (isYesterday(isoDay + 'T12:00:00')) return 'Hier';
  return formatDateLongFR(isoDay);
}

// ----------------------------------------------------------------------
// Toast context
// ----------------------------------------------------------------------
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message, icon = '✅') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, icon });
    timerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div className="toast">
          <span>{toast.icon}</span>
          <span>{toast.message}</span>
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
// Confirm inline (✕ -> "Confirmer ✓")
// ----------------------------------------------------------------------
export function ConfirmInline({ onConfirm, label = 'Supprimer', icon = '🗑️' }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setConfirming(true); }}>
        ✕
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
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
          setConfirming(false);
        }}
      >
        {icon} Confirmer ✓
      </button>
    </span>
  );
}

// ----------------------------------------------------------------------
// Swipe to delete wrapper
// ----------------------------------------------------------------------
export function SwipeToDelete({ onDelete, children, disabled = false }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const startX = useRef(0);
  const THRESHOLD = -72;

  if (disabled) return <div className="swipe-wrap"><div className="swipe-content">{children}</div></div>;

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    setDragging(true);
  };
  const onTouchMove = (e) => {
    if (!dragging) return;
    const diff = e.touches[0].clientX - startX.current;
    setDragX(Math.max(-90, Math.min(0, diff)));
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (dragX < THRESHOLD) {
      setConfirming(true);
      setDragX(-90);
    } else {
      setDragX(0);
    }
  };

  return (
    <div className="swipe-wrap">
      {confirming && (
        <div className="swipe-action">
          <button
            className="btn btn-sm"
            style={{ background: 'transparent', color: '#fff', fontWeight: 700 }}
            onClick={() => {
              onDelete();
            }}
          >
            ✕ Supprimer ✓
          </button>
          <button
            className="btn btn-sm"
            style={{ background: 'transparent', color: '#fff' }}
            onClick={() => {
              setConfirming(false);
              setDragX(0);
            }}
          >
            Annuler
          </button>
        </div>
      )}
      <div
        className="swipe-content"
        style={{ transform: `translateX(${dragX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Confetti effect
// ----------------------------------------------------------------------
export function fireConfetti() {
  const emojis = ['🎉', '✨', '🎊', '⭐', '💫'];
  const container = document.body;
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = `${Math.random() * 100}%`;
    el.style.animationDuration = `${1.2 + Math.random() * 1.2}s`;
    el.style.fontSize = `${0.9 + Math.random() * 1}rem`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
}

// ----------------------------------------------------------------------
// Accordion component (section repliable)
// ----------------------------------------------------------------------
export function Accordion({ icon, title, badge, badgeColor, children, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{
      marginBottom: 8,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      border: '1px solid var(--border)',
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '12px 14px',
          background: open ? 'var(--primary-soft)' : 'var(--surface)',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <span style={{ fontSize: '1.1rem' }}>{icon}</span>}
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.92rem',
            color: open ? 'var(--primary-deep)' : 'var(--text)',
          }}>{title}</span>
          {badge != null && (
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px',
              borderRadius: 'var(--radius-pill)',
              background: badgeColor || (open ? 'var(--primary-deep)' : 'var(--primary)'),
              color: '#fff',
            }}>{badge}</span>
          )}
        </div>
        <span style={{
          fontSize: '0.7rem', color: open ? 'var(--primary-deep)' : 'var(--text-faint)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          display: 'inline-block',
        }}>▼</span>
      </button>
      {open && (
        <div style={{
          padding: '12px 14px 14px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
