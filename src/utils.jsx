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
  // Labels relatifs jusqu'à 7 jours
  const now = new Date();
  const day = new Date(isoDay + 'T12:00:00');
  const diffDays = Math.round((now - day) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) {
    const joursSemaine = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return `${joursSemaine[day.getDay()]} dernier (il y a ${diffDays} jours)`;
  }
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
// Hook : vitamine D donnée aujourd'hui pour l'enfant actif
// ----------------------------------------------------------------------
export function useVitamineDuJour(entries, child) {
  return React.useMemo(() => {
    if (!child || !entries) return false;
    const ageM = child.birthdate
      ? Math.floor((new Date() - new Date(child.birthdate)) / (1000 * 60 * 60 * 24 * 30.44))
      : 999;
    if (ageM >= 24) return true; // pas de reminder après 24 mois
    const today = new Date().toISOString().slice(0, 10);
    return entries.some(
      (e) => e.type === 'biberon' && e.vitamineD && e.date && e.date.slice(0, 10) === today
    );
  }, [entries, child]);
}


// ----------------------------------------------------------------------
// Hook : persistance état accordéons (mémoire session, pas localStorage)
// Empêche les accordéons de se refermer lors de la navigation entre onglets.
// Usage : const [isOpen, setIsOpen] = useAccordionState('sante.poids', false)
// ----------------------------------------------------------------------
const _accordionState = {};

export function useAccordionState(key, defaultOpen = false) {
  const [open, setOpen] = React.useState(() => {
    if (key in _accordionState) return _accordionState[key];
    return defaultOpen;
  });

  const setOpenPersisted = React.useCallback((val) => {
    const next = typeof val === 'function' ? val(open) : val;
    _accordionState[key] = next;
    setOpen(next);
  }, [key, open]);

  return [open, setOpenPersisted];
}

// ----------------------------------------------------------------------
// Accordion — section repliable réutilisable
// ----------------------------------------------------------------------
export function Accordion({ icon, title, badge, badgeColor, children, defaultOpen = false, stateKey }) {
  const [openKeyed, setOpenKeyed] = useAccordionState(stateKey || ('acc_' + title), defaultOpen);
  const open = openKeyed;
  const setOpen = setOpenKeyed;
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
          fontFamily: 'inherit',
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
          fontSize: '0.7rem',
          color: open ? 'var(--primary-deep)' : 'var(--text-faint)',
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


// ----------------------------------------------------------------------
// Helper : écrire un fichier dans le cache Capacitor puis le partager
// via le sélecteur natif Android, ou téléchargement web en fallback.
// ----------------------------------------------------------------------
async function shareFileNative(filename, mimeType, base64Data) {
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  if (isNative) {
    // 1. Écrire dans le cache (seul dossier partageable par défaut sur Android)
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const writeResult = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
    });

    // 2. Ouvrir le sélecteur natif avec l'URI du fichier
    await Share.share({
      title: filename,
      url: writeResult.uri,
      dialogTitle: 'Partager / Enregistrer',
    });
    return;
  }

  // Fallback web : téléchargement classique via <a>
  const byteString = atob(base64Data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------
// Export JSON via partage natif
// ----------------------------------------------------------------------
export async function shareJSON(store) {
  const data = JSON.stringify(store, null, 2);
  const filename = `omnibaby-export-${new Date().toISOString().slice(0, 10)}.json`;
  // Encoder en base64
  const base64 = btoa(unescape(encodeURIComponent(data)));
  await shareFileNative(filename, 'application/json', base64);
}

// ----------------------------------------------------------------------
// Export PDF résumé pédiatre
// Utilise jsPDF (import dynamique pour ne pas alourdir le bundle)
// ----------------------------------------------------------------------
export async function exportPDF(store, child) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  // Activer le support UTF-8 pour les caractères accentués français
  doc.setLanguage('fr');
  const W = 210; // largeur A4
  const MARGIN = 14;
  const COL = W - MARGIN * 2;
  let y = 0;

  // ── Helpers ──────────────────────────────────────────────────────
  const ageStr = (birthdate) => {
    if (!birthdate) return '';
    const ms = new Date() - new Date(birthdate);
    const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44));
    if (months < 24) return `${months} mois`;
    return `${Math.floor(months / 12)} ans ${months % 12} mois`;
  };

  const fmtDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('fr-FR');
  };

  const todayStr = new Date().toLocaleDateString('fr-FR');
  const childEntries = (store.entries || []).filter((e) => e.childId === child.id || !e.childId);
  const childMesures = (store.mesures || []).filter((e) => e.childId === child.id || !e.childId);
  const childVaccins = (store.vaccins || []).filter((e) => e.childId === child.id || !e.childId);
  const childTemps = (store.temperatures || []).filter((e) => e.childId === child.id || !e.childId);
  const childSommeils = (store.sommeils || []).filter((e) => e.childId === child.id || !e.childId);

  // Données 7 derniers jours
  const limit7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const entries7 = childEntries.filter((e) => e.date >= limit7);
  const biberons7 = entries7.filter((e) => e.type === 'biberon');
  const couches7 = entries7.filter((e) => e.type === 'couche');
  const nuits7 = childSommeils.filter((s) => s.debut >= limit7 && s.type === 'nuit');
  const temps7 = childTemps.filter((t) => t.date >= limit7);

  // ── En-tête ──────────────────────────────────────────────────────
  doc.setFillColor(201, 111, 74); // --primary terracotta
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('OmniBaby - Resume pediatrique', MARGIN, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Genere le ${todayStr}`, MARGIN, 20);
  doc.text(`Donnees : ${todayStr}`, W - MARGIN, 20, { align: 'right' });
  y = 34;

  // ── Profil enfant ─────────────────────────────────────────────────
  doc.setTextColor(43, 35, 32);
  doc.setFillColor(240, 205, 188); // primary-soft
  doc.rect(MARGIN, y, COL, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(child.nom, MARGIN + 4, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 80, 70);
  doc.text([
    `Né(e) le : ${fmtDate(child.birthdate)}  |  Âge : ${ageStr(child.birthdate)}`,
    `Sexe : ${child.sexe === 'garcon' ? 'Garçon' : 'Fille'}  |  Groupe sanguin : ${child.groupeSanguin || '-'}`,
    child.allergies ? ` Allergies : ${child.allergies}` : '',
  ].filter(Boolean), MARGIN + 4, y + 14);
  y += 28;

  // ── Médecin & Urgence ─────────────────────────────────────────────
  if (child.medecinNom || child.contactUrgenceNom) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(43, 35, 32);
    doc.text('Contacts', MARGIN, y + 5);
    doc.setDrawColor(234, 217, 203);
    doc.line(MARGIN, y + 7, W - MARGIN, y + 7);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 65, 58);
    if (child.medecinNom) {
      doc.text(`Medecin / pediatre : ${child.medecinNom}${child.medecinTel ? '  -  ' + child.medecinTel : ''}`, MARGIN, y);
      y += 5;
    }
    if (child.contactUrgenceNom) {
      doc.text(`Contact urgence : ${child.contactUrgenceNom}${child.contactUrgenceTel ? '  -  ' + child.contactUrgenceTel : ''}`, MARGIN, y);
      y += 5;
    }
    y += 4;
  }

  // ── Section résumé 7 jours ────────────────────────────────────────
  const sectionTitle = (title) => {
    doc.setFillColor(251, 244, 238);
    doc.rect(MARGIN, y, COL, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(138, 90, 68);
    doc.text(title, MARGIN + 2, y + 5);
    doc.setDrawColor(201, 111, 74);
    doc.line(MARGIN, y + 7, W - MARGIN, y + 7);
    y += 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(43, 35, 32);
  };

  sectionTitle('Resume - 7 derniers jours');

  const avg = (arr) => arr.length ? (arr.reduce((s, x) => s + x, 0) / 7).toFixed(1) : '-';
  const totalMl = biberons7.filter((b) => b.mode === 'biberon').reduce((s, b) => s + (b.quantite || 0), 0);
  const dureeNuits = nuits7.reduce((s, n) => s + (n.duree || 0), 0);

  const stats = [
    [`Biberons / tétées`, `${biberons7.length} total  (moy. ${avg(Array(7).fill(biberons7.length / 7))} /j)`],
    [`Lait total (biberon)`, totalMl > 0 ? `${totalMl} ml  (moy. ${Math.round(totalMl / 7)} ml/j)` : '-'],
    [`Changes`, `${couches7.length} total  (moy. ${avg(Array(7).fill(couches7.length / 7))} /j)`],
    [`Nuits enregistrées`, `${nuits7.length}  -  durée totale : ${Math.floor(dureeNuits / 60)}h${String(dureeNuits % 60).padStart(2, '0')}`],
    [`Températures relevées`, temps7.length > 0 ? `${temps7.length}  (max : ${Math.max(...temps7.map((t) => t.valeur)).toFixed(1)}°C)` : 'Aucune'],
  ];

  stats.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label + ' :', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val, MARGIN + 52, y);
    y += 5.5;
  });
  y += 4;

  // ── Croissance ────────────────────────────────────────────────────
  if (childMesures.length > 0) {
    sectionTitle('Courbe de croissance');
    const types = [
      { key: 'poids', label: 'Poids', unit: 'kg' },
      { key: 'taille', label: 'Taille', unit: 'cm' },
      { key: 'perimetre', label: 'Perimetre cranien', unit: 'cm' },
    ];
    types.forEach(({ key, label, unit }) => {
      const mesures = childMesures.filter((m) => m.type === key).sort((a, b) => a.date > b.date ? 1 : -1);
      if (!mesures.length) return;
      const last = mesures[mesures.length - 1];
      const prev = mesures[mesures.length - 2];
      const diff = prev ? ` (${(last.valeur - prev.valeur) > 0 ? '+' : ''}${(last.valeur - prev.valeur).toFixed(1)} ${unit} depuis ${fmtDate(prev.date)})` : '';
      doc.setFont('helvetica', 'bold');
      doc.text(`${label} :`, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${last.valeur} ${unit}  -  ${fmtDate(last.date)}${diff}`, MARGIN + 40, y);
      y += 5.5;
    });
    y += 4;
  }

  // ── Vaccins ───────────────────────────────────────────────────────
  if (childVaccins.length > 0) {
    sectionTitle('Vaccinations effectuees');
    childVaccins
      .sort((a, b) => a.date > b.date ? 1 : -1)
      .forEach((v) => {
        doc.text(`- ${v.name}`, MARGIN + 2, y);
        doc.text(fmtDate(v.date), W - MARGIN, y, { align: 'right' });
        y += 5;
        if (y > 270) { doc.addPage(); y = 14; }
      });
    y += 4;
  }

  // ── Notes médicales ────────────────────────────────────────────────
  if (child.notesMedicales) {
    sectionTitle('Notes medicales');
    const lines = doc.splitTextToSize(child.notesMedicales, COL);
    lines.forEach((line) => {
      doc.text(line, MARGIN, y);
      y += 5;
      if (y > 270) { doc.addPage(); y = 14; }
    });
    y += 4;
  }

  // ── Pied de page ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(179, 162, 153);
    doc.text(
      `OmniBaby v${store.settings?.appVersion || '-'}  |  ${todayStr}  |  Page ${i}/${pageCount}  |  Données confidentielles`,
      W / 2, 292, { align: 'center' }
    );
  }


  // ── Export via shareFileNative ─────────────────────────────────────
  const pdfFilename = `OmniBaby-resume-${child.nom}-${new Date().toISOString().slice(0,10)}.pdf`;
  const base64PDF = doc.output('datauristring').split(',')[1];
  await shareFileNative(pdfFilename, 'application/pdf', base64PDF);
}

// ----------------------------------------------------------------------
// Notifications locales (@capacitor/local-notifications)
// ----------------------------------------------------------------------
export async function requestNotifPermission() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch (e) { return false; }
}

export async function scheduleNotif({ id, title, body, at }) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{
        id: typeof id === 'number' ? id : Math.abs(id.toString().split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % 2147483647,
        title,
        body,
        schedule: { at: new Date(at) },
        sound: null,
        smallIcon: 'ic_launcher',
      }],
    });
    return true;
  } catch (e) { console.error('[Notif]', e); return false; }
}

export async function cancelNotif(id) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const numId = typeof id === 'number' ? id : Math.abs(id.toString().split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % 2147483647;
    await LocalNotifications.cancel({ notifications: [{ id: numId }] });
  } catch (e) {}
}

export async function cancelAllNotifs() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch (e) {}
}

