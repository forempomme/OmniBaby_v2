import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  auth, db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion,
} from './firebase.js';
import {
  useStore, genId, generateFamilyCode, familyCodeRef, sharedSettings, SYNC_TABLES,
} from './store.jsx';
import { useToast, toISODate } from './utils.jsx';
import { Icon } from './icons.jsx';

const AVATAR_COLORS = {
  purple: '#9B7EBD', orange: '#E0A458', green: '#7C9885',
  blue: '#6E97A8', pink: '#D98A9A', brown: '#A47C5F',
};
export function avatarColor(c) { return AVATAR_COLORS[c] || AVATAR_COLORS.purple; }
export const AVATAR_COLOR_KEYS = Object.keys(AVATAR_COLORS);
export function initials(nom) { return (nom || '?').trim().slice(0, 2).toUpperCase(); }

// ── Code PIN haché ────────────────────────────────────────────────────
// Le PIN n'est plus stocké en clair (il apparaissait dans l'export JSON).
// Limite assumée : 4 chiffres = 10 000 combinaisons, le hash protège d'une
// lecture directe, pas d'une attaque par force brute sur le téléphone.
export async function hashPin(userId, pin) {
  const data = new TextEncoder().encode(`omnibaby:${userId}:${pin}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Repli sans WebCrypto (très ancien WebView) : FNV-1a 32 bits
  let h = 0x811c9dc5;
  for (const b of data) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return 'fnv' + h.toString(16);
}

async function checkPin(user, pin) {
  if (!user) return false;
  if (user.pinHash) return (await hashPin(user.id, pin)) === user.pinHash;
  return user.pin != null && String(user.pin) === pin;
}

// ── Biométrie ─────────────────────────────────────────────────────────
function getPlugin() {
  try {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.NativeBiometric || null;
  } catch (e) { return null; }
}
export async function isBiometricAvailable() {
  try {
    const plugin = getPlugin();
    if (!plugin) return false;
    const result = await plugin.isAvailable();
    return !!(result?.isAvailable);
  } catch (e) { return false; }
}
async function biometricVerify(reason) {
  try {
    const plugin = getPlugin();
    if (!plugin) return false;
    await plugin.verifyIdentity({
      reason: reason || 'Connexion à OmniBaby',
      title: 'OmniBaby', subtitle: 'Connexion sécurisée',
      description: '', useFallback: false,
    });
    return true;
  } catch (e) { return false; }
}

// ── Fiche baby-sitter ─────────────────────────────────────────────────
function BabySitterContent({ store }) {
  const child = store.children.find((c) => c.id === store.activeChildId) || store.children[0];
  if (!child) return (
    <div style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '24px 0' }}>
      Aucun profil enfant configuré.
    </div>
  );
  return (
    <div>
      <div style={{ background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-lg)', padding: '14px', textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '2rem' }}>{child.emoji || '👶'}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', marginTop: 4 }}>{child.nom}</div>
      </div>
      {child.allergies && (
        <div style={{ background: 'var(--danger-soft)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '.85rem' }}>Allergies</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{child.allergies}</div>
        </div>
      )}
      {[
        { label: 'Groupe sanguin', val: child.groupeSanguin },
        { label: 'Médecin', val: child.medecinNom, tel: child.medecinTel },
        { label: 'Urgence famille', val: child.contactUrgenceNom, tel: child.contactUrgenceTel },
      ].map((r, i) => r.val && (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '.65rem', color: 'var(--text-soft)', fontWeight: 700, textTransform: 'uppercase' }}>{r.label}</div>
            <div style={{ fontWeight: 600, fontSize: '.86rem', marginTop: 1 }}>{r.val}</div>
          </div>
          {r.tel && <a href={`tel:${r.tel}`} style={{ background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: '.75rem', fontWeight: 600, textDecoration: 'none' }}>Appeler</a>}
        </div>
      ))}
      <a href="tel:15" style={{ display: 'block', textAlign: 'center', marginTop: 14, background: 'var(--danger)', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '10px', fontWeight: 700, fontSize: '.88rem', textDecoration: 'none' }}>
        SAMU — 15
      </a>
    </div>
  );
}

// ── Pavé PIN ──────────────────────────────────────────────────────────
function PinPad({ onDigit, onDelete, onBiometric, showBiometric }) {
  return (
    <>
      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => onDigit(d)}>{d}</button>
        ))}
        <div className="numpad-empty" />
        <button onClick={() => onDigit(0)}>0</button>
        <button className="numpad-action" onClick={onDelete} aria-label="Effacer">⌫</button>
      </div>
      {showBiometric && (
        <button className="biometric-btn" onClick={onBiometric}>
          <span className="icon">🔐</span> Empreinte digitale
        </button>
      )}
    </>
  );
}

// ── En-tête d'étape du premier lancement ──────────────────────────────
function StepHeader({ step, label }) {
  return (
    <div className="setup-steps">
      <div className="setup-bars">
        {[1, 2, 3, 4].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}
      </div>
      <span className="setup-step-label">Étape {step} sur 4 · {label}</span>
    </div>
  );
}

// ----------------------------------------------------------------------
// Étape 1 — Présentation (3 écrans)
// ----------------------------------------------------------------------
const ONBOARDING_SLIDES = [
  {
    emoji: '🍼',
    title: 'Bienvenue sur OmniBaby',
    desc: "Suis l'alimentation, le sommeil et la santé de ton bébé. Simple, rapide, toujours à portée de main.",
  },
  {
    emoji: '👨‍👩‍👧',
    title: "Partage avec l'autre parent",
    desc: 'Synchronisation en temps réel : un biberon noté sur un téléphone apparaît aussitôt sur l’autre.',
  },
  {
    emoji: '🔒',
    title: 'Données protégées',
    desc: 'Accès par code PIN et, si tu veux, par empreinte digitale. Aucune publicité.',
  },
];

function OnboardingScreen({ onDone }) {
  const [slide, setSlide] = useState(0);
  const current = ONBOARDING_SLIDES[slide];
  const isLast = slide === ONBOARDING_SLIDES.length - 1;

  return (
    <div className="setup-screen" style={{ textAlign: 'center' }}>
      <div className="setup-bars" style={{ marginBottom: 32 }}>
        {ONBOARDING_SLIDES.map((_, i) => <span key={i} className={i <= slide ? 'on' : ''} />)}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ fontSize: '4rem', lineHeight: 1 }}>{current.emoji}</div>
        <h1 className="setup-title" style={{ fontSize: '1.5rem' }}>{current.title}</h1>
        <p className="setup-desc" style={{ maxWidth: 290 }}>{current.desc}</p>
      </div>

      <div className="setup-actions">
        <button className="setup-cta" onClick={() => (isLast ? onDone() : setSlide((s) => s + 1))}>
          {isLast ? 'Commencer' : 'Suivant'}
        </button>
        {!isLast && <button className="setup-link" onClick={onDone}>Passer</button>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Étape 2 — Profil parent + PIN
// ----------------------------------------------------------------------
function FirstLaunch({ onCreated }) {
  const { update, setSession } = useStore();
  const [nom, setNom] = useState('');
  const [pin, setPin] = useState('');
  const [color, setColor] = useState('purple');
  const [error, setError] = useState('');

  const handleDigit = (d) => {
    if (pin.length >= 4) return;
    setError('');
    setPin((p) => p + String(d));
  };

  const handleCreate = async () => {
    if (!nom.trim()) { setError('Entre ton prénom.'); return; }
    if (pin.length !== 4) { setError('Choisis un code PIN à 4 chiffres.'); return; }
    const id = genId();
    const pinHash = await hashPin(id, pin);
    update((draft) => {
      draft.users.push({ id, nom: nom.trim(), pinHash, role: 'admin', initiales: initials(nom), couleur: color });
      return draft;
    });
    setSession({ userId: id });
    onCreated();
  };

  return (
    <div className="setup-screen">
      <StepHeader step={2} label="Ton profil" />
      <h1 className="setup-title">Qui utilise ce téléphone&nbsp;?</h1>
      <p className="setup-desc">Ton prénom et un code PIN pour ouvrir l'appli.</p>

      <div className="field">
        <label>Ton prénom</label>
        <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Julien" autoFocus />
      </div>
      <div className="field">
        <label>Couleur</label>
        <div className="pill-group">
          {AVATAR_COLOR_KEYS.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={c} style={{
              width: 36, height: 36, borderRadius: '50%', background: avatarColor(c),
              border: color === c ? '3px solid #fff' : '3px solid transparent',
            }} />
          ))}
        </div>
      </div>
      <div className="field" style={{ textAlign: 'center' }}>
        <label style={{ textAlign: 'left' }}>Code PIN (4 chiffres)</label>
        <div className="pin-dots" style={{ justifyContent: 'center' }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />)}
        </div>
        <PinPad onDigit={handleDigit} onDelete={() => setPin((p) => p.slice(0, -1))} showBiometric={false} />
      </div>
      {error && <div className="setup-error">{error}</div>}
      <div className="setup-actions">
        <button className="setup-cta" onClick={handleCreate}>Continuer</button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Étape 3 — Compte Firebase : connexion, création, rejoindre une famille
// Exporté : réutilisé en surimpression depuis Réglages et l'état vide.
// onDone(result) : 'login' | 'registered' | 'joined' | 'skip'
// ----------------------------------------------------------------------
function firebaseError(code) {
  const map = {
    'auth/email-already-in-use': 'Cet email a déjà un compte : utilise « Se connecter ».',
    'auth/invalid-email': 'Adresse email invalide.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/wrong-password': 'Email ou mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
    'auth/network-request-failed': 'Pas de connexion réseau.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.',
    'permission-denied': 'Accès refusé par le serveur (règles Firestore à jour ?).',
    'unavailable': 'Serveur injoignable. Vérifie ta connexion.',
  };
  return map[code] || `Erreur : ${code || 'inconnue'}`;
}

async function pickFreeFamilyCode() {
  for (let i = 0; i < 6; i++) {
    const code = generateFamilyCode();
    const snap = await getDoc(familyCodeRef(code));
    if (!snap.exists()) return code;
  }
  throw Object.assign(new Error('code'), { code: 'unavailable' });
}

function FirebaseLoginScreen({ onDone, onCancel, initialMode = 'login', setupStep }) {
  const { store, update, firebaseUser } = useStore();
  const showToast = useToast();
  const [mode, setMode] = useState(initialMode); // login | register | join | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(() => store.users[0]?.nom || '');
  const [familyCode, setFamilyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Déjà connecté (ex. compte créé sans bébé) : rejoindre avec ce compte
  const joinWithCurrent = mode === 'join' && !!firebaseUser;

  const run = async (fn) => {
    setLoading(true); setError('');
    try { await fn(); }
    catch (e) { console.error('[Auth]', e); setError(firebaseError(e.code)); }
    finally { setLoading(false); }
  };

  const handleLogin = () => run(async () => {
    if (!email || !password) { setError('Email et mot de passe requis.'); return; }
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    const familyId = userDoc.exists() ? userDoc.data().familyId : null;
    let code = null;
    if (familyId) {
      try {
        const fam = await getDoc(doc(db, 'families', familyId));
        code = fam.exists() ? fam.data().familyCode || null : null;
      } catch (e) { /* hors-ligne : récupéré au premier snapshot */ }
    }
    update((draft) => { draft.familyId = familyId; draft.familyCode = code; return draft; });
    onDone('login');
  });

  const handleRegister = () => run(async () => {
    if (!email || !password || !displayName.trim()) { setError('Tous les champs sont requis.'); return; }
    if (password.length < 6) { setError('Mot de passe : 6 caractères minimum.'); return; }
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const uid = cred.user.uid;
    await updateProfile(cred.user, { displayName: displayName.trim() });

    const familyId = `family_${uid}`;
    const code = await pickFreeFamilyCode();
    await setDoc(doc(db, 'families', familyId), {
      memberIds: [uid],
      familyCode: code,
      createdAt: serverTimestamp(),
      children: store.children,
      activeChildId: store.activeChildId,
      settings: sharedSettings(store.settings),
      etapesDiv: store.etapesDiv,
    });
    await setDoc(doc(db, 'families', familyId, 'members', uid), {
      uid, displayName: displayName.trim(), email: email.trim(), role: 'admin', joinedAt: serverTimestamp(),
    });
    await setDoc(familyCodeRef(code), { familyId });
    await setDoc(doc(db, 'users', uid), { familyId, displayName: displayName.trim(), email: email.trim() });

    // Migration des données locales existantes (par paquets de 40 écritures)
    const writes = [];
    for (const table of SYNC_TABLES) {
      for (const item of store[table] || []) {
        const data = {};
        for (const [k, v] of Object.entries(item)) if (v !== undefined) data[k] = v;
        writes.push(() => setDoc(doc(db, 'families', familyId, table, String(item.id)), { ...data, _updatedAt: serverTimestamp() }));
      }
    }
    for (let i = 0; i < writes.length; i += 40) await Promise.all(writes.slice(i, i + 40).map((w) => w()));

    update((draft) => { draft.familyId = familyId; draft.familyCode = code; return draft; });
    showToast(writes.length ? `Compte créé · ${writes.length} données synchronisées` : 'Compte créé', '✅');
    onDone('registered');
  });

  const handleJoin = () => run(async () => {
    const code = familyCode.replace(/\D/g, '');
    if (code.length !== 6) { setError('Le code famille fait 6 chiffres.'); return; }
    if (!joinWithCurrent && (!email || !password || !displayName.trim())) { setError('Tous les champs sont requis.'); return; }

    let user = auth.currentUser;
    let createdNow = false;
    if (!joinWithCurrent) {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      user = cred.user;
      createdNow = true;
      await updateProfile(user, { displayName: displayName.trim() });
    }
    const name = displayName.trim() || user.displayName || user.email?.split('@')[0] || 'Parent';

    const codeSnap = await getDoc(familyCodeRef(code));
    if (!codeSnap.exists()) {
      // Pas de compte orphelin si le code est faux
      if (createdNow) await deleteUser(user).catch(() => {});
      setError("Code introuvable. Vérifie-le avec l'autre parent (Réglages → Famille & synchro).");
      return;
    }
    const familyId = codeSnap.data().familyId;
    await setDoc(doc(db, 'families', familyId, 'members', user.uid), {
      uid: user.uid, displayName: name, email: user.email || email.trim(),
      role: 'editeur', joinCode: code, joinedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'families', familyId), { memberIds: arrayUnion(user.uid) });
    await setDoc(doc(db, 'users', user.uid), { familyId, displayName: name, email: user.email || email.trim() });

    update((draft) => { draft.familyId = familyId; draft.familyCode = code; return draft; });
    showToast('Famille rejointe', '✅');
    onDone('joined');
  });

  const handleReset = () => run(async () => {
    if (!email) { setError('Entre ton adresse email.'); return; }
    await sendPasswordResetEmail(auth, email.trim());
    showToast('Email de réinitialisation envoyé', '📧');
    setMode('login');
  });

  const submit = { login: handleLogin, register: handleRegister, join: handleJoin, reset: handleReset }[mode];
  const label = {
    login: 'Se connecter', register: 'Créer le compte', join: 'Rejoindre la famille', reset: 'Envoyer le lien',
  }[mode];

  return (
    <div className="setup-screen">
      {setupStep ? <StepHeader step={setupStep} label="Synchronisation" /> : (
        onCancel && (
          <button className="setup-back" onClick={onCancel} aria-label="Retour">
            <Icon name="chevronLeft" size={20} />
          </button>
        )
      )}
      <h1 className="setup-title">
        {mode === 'join' ? 'Rejoindre une famille' : mode === 'reset' ? 'Mot de passe oublié' : "Partage avec l'autre parent"}
      </h1>
      <p className="setup-desc">
        {mode === 'join'
          ? "Entre le code à 6 chiffres affiché chez l'autre parent (Réglages → Famille & synchro)."
          : 'Un compte email synchronise le journal entre vos téléphones, en temps réel.'}
      </p>

      {mode !== 'reset' && (
        <div className="seg">
          {[
            { key: 'login', label: 'Connexion' },
            { key: 'register', label: 'Nouveau compte' },
            { key: 'join', label: 'Rejoindre' },
          ].map((m) => (
            <button key={m.key} className={mode === m.key ? 'on' : ''} onClick={() => { setMode(m.key); setError(''); }}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'join' && (
        <div className="field">
          <label>Code famille</label>
          <input type="text" inputMode="numeric" value={familyCode} maxLength={6} placeholder="123456"
            onChange={(e) => setFamilyCode(e.target.value.replace(/\D/g, ''))}
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: 6, fontSize: '1.2rem', textAlign: 'center' }} />
        </div>
      )}
      {joinWithCurrent && (
        <p className="setup-desc" style={{ fontSize: '.8rem' }}>
          Tu rejoins avec ton compte actuel ({firebaseUser.email}).
        </p>
      )}
      {(mode === 'register' || (mode === 'join' && !joinWithCurrent)) && (
        <div className="field">
          <label>Ton prénom</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Julien" />
        </div>
      )}
      {!joinWithCurrent && (
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" autoComplete="email" />
        </div>
      )}
      {mode !== 'reset' && !joinWithCurrent && (
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </div>
      )}

      {error && <div className="setup-error">{error}</div>}

      <div className="setup-actions">
        <button className="setup-cta" onClick={submit} disabled={loading}>{loading ? 'Patiente…' : label}</button>
        {mode === 'login' && <button className="setup-link" onClick={() => { setMode('reset'); setError(''); }}>Mot de passe oublié ?</button>}
        {mode === 'reset' && <button className="setup-link" onClick={() => setMode('login')}>Retour à la connexion</button>}
        {setupStep && <button className="setup-link" onClick={() => onDone('skip')}>Plus tard, utiliser sans synchro</button>}
      </div>
    </div>
  );
}

// Connexion / rejoindre en plein écran depuis l'appli (Réglages, état vide)
export function AuthOverlay({ mode, onClose }) {
  return createPortal(
    <div className="auth-overlay">
      <FirebaseLoginScreen initialMode={mode} onCancel={onClose} onDone={onClose} />
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------
// Étape 4 — Bébé
// ----------------------------------------------------------------------
const BABY_SKIP_KEY = 'omnibaby_baby_skip';

function ChildSetup({ onDone }) {
  const { update } = useStore();
  const [nom, setNom] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [sexe, setSexe] = useState('fille');
  const [alimentation, setAlimentation] = useState('allaitement');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!nom.trim()) { setError('Entre le prénom de bébé.'); return; }
    if (!birthdate) { setError('Indique la date de naissance (repères OMS).'); return; }
    if (birthdate > toISODate()) { setError('La date de naissance est dans le futur.'); return; }
    const id = genId();
    update((draft) => {
      draft.children.push({
        id, nom: nom.trim(), emoji: '👶', sexe, birthdate, alimentation,
        typeLait: alimentation === 'allaitement' ? 'maternel' : '1er_age',
        allergies: '', groupeSanguin: '', medecinNom: '', medecinTel: '',
        contactUrgenceNom: '', contactUrgenceTel: '', notesMedicales: '', lastVitDDate: null,
      });
      draft.activeChildId = id;
      return draft;
    });
    onDone();
  };

  const skip = () => {
    try { localStorage.setItem(BABY_SKIP_KEY, '1'); } catch (e) {}
    onDone();
  };

  const choice = (value, current, set, label) => (
    <button key={value} type="button" className={`setup-choice ${current === value ? 'on' : ''}`} onClick={() => set(value)}>{label}</button>
  );

  return (
    <div className="setup-screen">
      <StepHeader step={4} label="Ton bébé" />
      <span className="setup-badge"><Icon name="baby" size={30} /></span>
      <h1 className="setup-title">Présente-nous ton bébé</h1>
      <p className="setup-desc">Ces infos servent aux repères OMS (sommeil, croissance, vaccins). Tu pourras tout modifier plus tard.</p>

      <div className="field">
        <label htmlFor="setup-prenom">Prénom</label>
        <input id="setup-prenom" type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Léa" />
      </div>
      <div className="field">
        <label htmlFor="setup-naissance">Date de naissance</label>
        <input id="setup-naissance" type="date" value={birthdate} max={toISODate()} onChange={(e) => setBirthdate(e.target.value)} />
      </div>
      <div className="field">
        <label>Sexe (pour les courbes OMS)</label>
        <div className="setup-choices cols-2">
          {choice('fille', sexe, setSexe, 'Fille')}
          {choice('garcon', sexe, setSexe, 'Garçon')}
        </div>
      </div>
      <div className="field">
        <label>Alimentation</label>
        <div className="setup-choices cols-3">
          {choice('allaitement', alimentation, setAlimentation, 'Sein')}
          {choice('mixte', alimentation, setAlimentation, 'Mixte')}
          {choice('lait_infantile', alimentation, setAlimentation, 'Biberon')}
        </div>
      </div>
      {error && <div className="setup-error">{error}</div>}
      <div className="setup-actions">
        <button className="setup-cta" onClick={handleSave}>Continuer</button>
        <button className="setup-link" onClick={skip}>J'attends encore bébé</button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Verrouillage PIN
// ----------------------------------------------------------------------
function LockScreen({ onUnlocked }) {
  const { store, update, setSession } = useStore();
  const showToast = useToast();
  const [selectedUserId, setSelectedUserId] = useState(store.users[0]?.id ?? null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [babySitterOpen, setBabySitterOpen] = useState(false);

  const biometrieActivee = store.settings?.biometrie !== false;
  useEffect(() => {
    if (!biometrieActivee) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
        if (await isBiometricAvailable()) { setBioAvailable(true); return; }
        await new Promise((r) => setTimeout(r, 300));
      }
    })();
    return () => { cancelled = true; };
  }, [biometrieActivee]);

  const selectedUser = store.users.find((u) => u.id === selectedUserId);

  const unlock = useCallback((user) => {
    setSession({ userId: user.id });
    onUnlocked();
  }, [setSession, onUnlocked]);

  const handleBiometric = useCallback(async () => {
    const ok = await biometricVerify(`Connexion en tant que ${selectedUser?.nom || ''}`);
    if (ok && selectedUser) unlock(selectedUser);
    else showToast('Biométrie annulée ou indisponible', '⚠️');
  }, [selectedUser, unlock, showToast]);

  useEffect(() => { if (bioAvailable) handleBiometric(); }, [bioAvailable]);

  const handleDigit = async (d) => {
    if (pin.length >= 4) return;
    const newPin = pin + String(d);
    setPin(newPin);
    if (newPin.length < 4) return;
    if (await checkPin(selectedUser, newPin)) {
      // Ancien PIN en clair → remplacé par son hash
      if (selectedUser.pin != null) {
        const pinHash = await hashPin(selectedUser.id, newPin);
        update((draft) => {
          const u = draft.users.find((x) => x.id === selectedUser.id);
          if (u) { u.pinHash = pinHash; delete u.pin; }
          return draft;
        });
      }
      unlock(selectedUser);
    } else {
      setShake(true);
      setTimeout(() => { setShake(false); setPin(''); }, 400);
    }
  };

  return (
    <div className="lock-screen">
      <div className="lock-logo">🍼</div>
      <div className="lock-title">OmniBaby</div>
      <div className="lock-sub">Qui es-tu ?</div>
      <div className="profile-row">
        {store.users.map((u) => (
          <button key={u.id} className={`profile-avatar ${u.id === selectedUserId ? 'active' : ''}`}
            onClick={() => { setSelectedUserId(u.id); setPin(''); }}>
            <div className="avatar-circle" style={{ background: avatarColor(u.couleur) }}>
              {u.initiales || initials(u.nom)}
            </div>
            <span>{u.nom}</span>
          </button>
        ))}
      </div>
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''} ${shake ? 'error' : ''}`} />
        ))}
      </div>
      <PinPad onDigit={handleDigit} onDelete={() => setPin((p) => p.slice(0, -1))}
        onBiometric={handleBiometric} showBiometric={bioAvailable} />
      <button onClick={() => setBabySitterOpen(true)} style={{
        marginTop: 16, background: 'none', border: 'none',
        color: 'rgba(255,255,255,.7)', fontSize: '.82rem', cursor: 'pointer', minHeight: 44,
      }}>
        🧑‍🍼 Fiche de garde (sans PIN)
      </button>
      {babySitterOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '16px 16px 32px', maxHeight: '80vh', overflowY: 'auto', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>Fiche de garde</div>
              <button onClick={() => setBabySitterOpen(false)} aria-label="Fermer" style={{ background: 'var(--surface-2)', border: 'none', borderRadius: 'var(--radius-pill)', width: 40, height: 40, cursor: 'pointer', color: 'var(--text)' }}>✕</button>
            </div>
            <BabySitterContent store={store} />
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Porte d'entrée : présentation → profil → synchro → bébé → PIN
// ----------------------------------------------------------------------
export default function AuthGate({ children }) {
  const { store, update, firebaseUser } = useStore();
  const [unlocked, setUnlocked] = useState(false);
  const [step, setStep] = useState(null); // null | 'sync' | 'baby'
  const [onboardingDone, setOnboardingDone] = useState(() => {
    try { return !!localStorage.getItem('omnibaby_onboarding_done'); } catch (e) { return true; }
  });

  // Migration : PIN en clair (≤ v3.7) → hash, pour tous les profils locaux
  useEffect(() => {
    const legacy = store.users.filter((u) => u.pin != null && !u.pinHash);
    if (!legacy.length) return;
    (async () => {
      const hashes = await Promise.all(legacy.map((u) => hashPin(u.id, String(u.pin))));
      update((draft) => {
        legacy.forEach((u, i) => {
          const x = draft.users.find((y) => y.id === u.id);
          if (x) { x.pinHash = hashes[i]; delete x.pin; }
        });
        return draft;
      });
    })();
  }, [store.users]);

  const completeOnboarding = () => {
    try { localStorage.setItem('omnibaby_onboarding_done', '1'); } catch (e) {}
    setOnboardingDone(true);
  };

  if (!onboardingDone) return <OnboardingScreen onDone={completeOnboarding} />;

  if (store.users.length === 0) {
    return <FirstLaunch onCreated={() => { setUnlocked(true); setStep('sync'); }} />;
  }

  if (step === 'sync' && !firebaseUser && !store.familyId) {
    return (
      <FirebaseLoginScreen
        setupStep={3}
        onDone={(result) => setStep(result === 'joined' || result === 'login' ? null : 'baby')}
      />
    );
  }

  const babySkipped = (() => { try { return !!localStorage.getItem(BABY_SKIP_KEY); } catch (e) { return false; } })();
  if ((step === 'baby' || step === 'sync') && store.children.length === 0 && !babySkipped && !(step === 'sync' && store.familyId)) {
    return <ChildSetup onDone={() => setStep(null)} />;
  }

  if (!unlocked) return <LockScreen onUnlocked={() => setUnlocked(true)} />;

  return children;
}
