// ----------------------------------------------------------------------
// Thème du document (v3.15.2 : sorti d'App.jsx pour être appliqué dès le
// démarrage, écran de verrouillage compris) + couleur de la barre d'état
// Android (@capacitor/status-bar), alignée sur le bandeau du haut.
// ----------------------------------------------------------------------
export const DARK_STYLES = ['ardoise', 'moka', 'relief', 'classique'];

// 'light' | 'dark' | 'night'
export function computeTheme(settings, now = new Date()) {
  const { dark, darkHour, nightMode, nightHour, nightSnoozeUntil } = settings || {};
  const hour = now.getHours();
  if (nightMode === true) return 'night';
  if (nightMode == null) {
    const nh = nightHour ?? 22;
    const snoozed = nightSnoozeUntil && now.getTime() < nightSnoozeUntil;
    if ((hour >= nh || hour < 7) && !snoozed) return 'night';
  }
  if (dark == null) {
    const dh = darkHour ?? 21;
    return hour >= dh || hour < 7 ? 'dark' : 'light';
  }
  return dark ? 'dark' : 'light';
}

export function darkStyleOf(settings) {
  return DARK_STYLES.includes(settings?.darkStyle) ? settings.darkStyle : 'ardoise';
}

export function applyTheme(settings, now = new Date()) {
  const t = computeTheme(settings, now);
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  root.setAttribute('data-dark', darkStyleOf(settings));
  scheduleStatusBarSync();
  return t;
}

// Réglages lus avant le chargement du store (main.jsx)
export function storedSettings() {
  try { return JSON.parse(localStorage.getItem('omnibaby_store_v3') || '{}').settings || {}; } catch (e) { return {}; }
}

// « rgb(169, 83, 47) » / « #A9532F » → [r, g, b]
export function parseColor(str) {
  if (!str) return null;
  const m = str.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const h = str.match(/#([0-9a-f]{6})/i);
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16));
  return null;
}
const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
export function isDarkColor(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

let pending = 0;
export function scheduleStatusBarSync() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => { syncStatusBar(); });
  // Écran pas encore affiché au démarrage : seconde passe
  setTimeout(syncStatusBar, 600);
}

// Couleur du haut de l'écran : bandeau (1re couleur du dégradé) ou fond
async function syncStatusBar() {
  try {
    const bar = document.querySelector('.app-topbar') || document.querySelector('.lock-screen, .setup-screen');
    const cs = bar ? getComputedStyle(bar) : getComputedStyle(document.body);
    const rgb = parseColor(cs.backgroundImage) || parseColor(cs.backgroundColor) || parseColor(getComputedStyle(document.body).backgroundColor);
    if (!rgb) return;
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setBackgroundColor({ color: hex(rgb) });
    await StatusBar.setStyle({ style: isDarkColor(rgb) ? Style.Dark : Style.Light });
  } catch (e) { /* plugin absent (aperçu web) : rien */ }
}
