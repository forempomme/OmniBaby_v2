import React, { useState, useEffect, useCallback } from 'react';
import {
  auth, db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  doc, getDoc, setDoc, updateDoc, collection, serverTimestamp,
  getDocs, query, where,
} from './firebase.js';
import { useStore, genId, generateFamilyCode, familyRef, familyDocRef } from './store.jsx';
import { useToast } from './utils.jsx';

const AVATAR_COLORS = {
  purple: '#9B7EBD', orange: '#E0A458', green: '#7C9885',
  blue: '#6E97A8', pink: '#D98A9A', brown: '#A47C5F',
};
export function avatarColor(c) { return AVATAR_COLORS[c] || AVATAR_COLORS.purple; }
export const AVATAR_COLOR_KEYS = Object.keys(AVATAR_COLORS);
function initials(nom) { return (nom || '?').trim().slice(0, 2).toUpperCase(); }

// ── Biometric ─────────────────────────────────────────────────────────
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
export async function biometricVerify(reason) {
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
        { label: 'Medecin', val: child.medecinNom, tel: child.medecinTel },
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

// ── PIN Pad ────────────────────────────────────────────────────────────
function PinPad({ onDigit, onDelete, onBiometric, showBiometric }) {
  return (
    <>
      <div className="numpad">
        {[1,2,3,4,5,6,7,8,9].map((d) => (
          <button key={d} onClick={() => onDigit(d)}>{d}</button>
        ))}
        <div className="numpad-empty" />
        <button onClick={() => onDigit(0)}>0</button>
        <button className="numpad-action" onClick={onDelete}>⌫</button>
      </div>
      {showBiometric && (
        <button className="biometric-btn" onClick={onBiometric}>
          <span className="icon">🔐</span> Empreinte digitale
        </button>
      )}
    </>
  );
}


// ----------------------------------------------------------------------
// Onboarding — 3 écrans au premier lancement absolu
// ----------------------------------------------------------------------
const ONBOARDING_SLIDES = [
  {
    emoji: '🍼',
    title: 'Bienvenue sur OmniBaby',
    desc: "Suivez l'alimentation, le sommeil et la sante de votre bebe. Simple, rapide, toujours a portee de main.",
  },
  {
    emoji: '👨‍👩‍👧',
    title: "Partagez avec l'autre parent",
    desc: "Synchronisation temps reel via Firebase. Papa enregistre un biberon, Maman le voit instantanement.",
  },
  {
    emoji: '🔒',
    title: 'Données sécurisées',
    desc: 'Vos données restent privées. Protégées par un code PIN et optionnellement par empreinte digitale. Aucune publicité.',
  },
];

function OnboardingScreen({ onDone }) {
  const [slide, setSlide] = React.useState(0);
  const current = ONBOARDING_SLIDES[slide];
  const isLast = slide === ONBOARDING_SLIDES.length - 1;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      height: '100%', padding: '40px 28px', textAlign: 'center',
      background: 'linear-gradient(160deg, #3D1F10 0%, #2A1208 100%)',
    }}>
      {/* Indicateurs de progression */}
      <div style={{ display:'flex', gap:6, marginBottom:32 }}>
        {ONBOARDING_SLIDES.map((_, i) => (
          <div key={i} style={{
            height: 4, borderRadius: 2, flex: 1,
            background: i <= slide ? '#E8A07A' : 'rgba(255,255,255,.2)',
            transition: 'background .3s',
          }} />
        ))}
      </div>

      <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>
        <div style={{ fontSize:'4rem', lineHeight:1 }}>{current.emoji}</div>
        <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.3rem', color:'#FFFFFF', textAlign:'center' }}>
          {current.title}
        </div>
        <div style={{ fontSize:'.9rem', color:'rgba(255,255,255,.82)', textAlign:'center', lineHeight:1.6, maxWidth:280 }}>
          {current.desc}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', maxWidth:300 }}>
        <button
          onClick={() => isLast ? onDone() : setSlide(s => s + 1)}
          style={{
            padding:'14px', borderRadius:'var(--radius-pill)',
            background:'rgba(255,255,255,.95)', color:'#7A4530',
            border:'none', fontWeight:700, fontSize:'.95rem', cursor:'pointer', fontFamily:'inherit',
          }}
        >
          {isLast ? 'Commencer →' : 'Suivant →'}
        </button>
        {!isLast && (
          <button onClick={onDone} style={{
            background:'none', border:'none', color:'rgba(255,255,255,.55)',
            fontSize:'.8rem', cursor:'pointer', fontFamily:'inherit',
          }}>
            Passer
          </button>
        )}
      </div>
    </div>
  );
}

// ── Écran de connexion Firebase ────────────────────────────────────────
function FirebaseLoginScreen({ onDone }) {
  const { store, update } = useStore();
  const showToast = useToast();
  const [mode, setMode] = useState('login'); // login | register | join | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Email et mot de passe requis.'); return; }
    setLoading(true); setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Récupérer le familyId depuis Firestore
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (userDoc.exists()) {
        const { familyId } = userDoc.data();
        update((draft) => { draft.familyId = familyId; return draft; });
      }
      onDone();
    } catch (e) {
      setError(firebaseError(e.code));
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!email || !password || !displayName) { setError('Tous les champs sont requis.'); return; }
    if (password.length < 6) { setError('Mot de passe minimum 6 caractères.'); return; }
    setLoading(true); setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });

      // Créer la famille
      const familyId = `family_${cred.user.uid}`;
      const code = generateFamilyCode();

      await setDoc(doc(db, 'families', familyId), {
        memberIds: [cred.user.uid],
        familyCode: code,
        createdAt: serverTimestamp(),
        children: store.children,
        activeChildId: store.activeChildId,
        settings: store.settings,
        etapesDiv: store.etapesDiv,
      });

      await setDoc(doc(db, 'families', familyId, 'members', cred.user.uid), {
        uid: cred.user.uid,
        displayName,
        email,
        role: 'admin',
        joinedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', cred.user.uid), {
        familyId,
        displayName,
        email,
      });

      // Migrer les données locales vers Firestore
      const { SYNC_TABLES } = await import('./store.jsx');
      const batch = [];
      for (const table of ['entries','mesures','vaccins','sommeils','medicaments','temperatures','aliments','journal','rappels']) {
        for (const item of store[table] || []) {
          await setDoc(
            doc(db, 'families', familyId, table, String(item.id)),
            { ...item, _updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
      }

      await callSetFamilyClaim(familyId, 'admin');
      update((draft) => { draft.familyId = familyId; draft.familyCode = code; return draft; });
      showToast('Compte créé ! Données migrées.', '✅');
      onDone();
    } catch (e) {
      setError(firebaseError(e.code));
    } finally { setLoading(false); }
  };

  const handleJoinFamily = async () => {
    if (!email || !password || !displayName || !familyCode) {
      setError('Tous les champs sont requis.'); return;
    }
    setLoading(true); setError('');
    try {
      // Trouver la famille par code
      const q = query(collection(db, 'families'), where('familyCode', '==', familyCode.trim()));
      const snap = await getDocs(q);
      if (snap.empty) { setError('Code famille invalide.'); setLoading(false); return; }

      const familyDoc = snap.docs[0];
      const familyId = familyDoc.id;

      // Créer le compte
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });

      // Rejoindre la famille
      await setDoc(doc(db, 'families', familyId, 'members', cred.user.uid), {
        uid: cred.user.uid,
        displayName,
        email,
        role: 'editeur',
        joinedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'families', familyId), {
        memberIds: [...(familyDoc.data().memberIds || []), cred.user.uid],
      });

      await setDoc(doc(db, 'users', cred.user.uid), { familyId, displayName, email });

      await callSetFamilyClaim(familyId, 'editeur');
      update((draft) => { draft.familyId = familyId; return draft; });
      showToast('Famille rejointe !', '✅');
      onDone();
    } catch (e) {
      setError(firebaseError(e.code));
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!email) { setError('Entre ton adresse email.'); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('Email de réinitialisation envoyé', '📧');
      setMode('login');
    } catch (e) {
      setError(firebaseError(e.code));
    } finally { setLoading(false); }
  };

  return (
    <div className="lock-screen">
      <div className="lock-logo">🍼</div>
      <div className="lock-title">OmniBaby</div>

      <div className="chip-row" style={{ justifyContent: 'center', marginBottom: 16 }}>
        {[
          { key: 'login', label: 'Se connecter' },
          { key: 'register', label: 'Créer un compte' },
          { key: 'join', label: 'Rejoindre une famille' },
        ].map((m) => (
          <button key={m.key} className={`chip ${mode === m.key ? 'active' : ''}`} onClick={() => { setMode(m.key); setError(''); }}>
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(mode === 'register' || mode === 'join') && (
          <div className="field">
            <label>Ton prénom</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Maman, Papa..." />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" autoComplete="email" />
        </div>
        {mode !== 'reset' && (
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
        )}
        {mode === 'join' && (
          <div className="field">
            <label>Code famille (6 chiffres)</label>
            <input type="text" value={familyCode} onChange={(e) => setFamilyCode(e.target.value)} placeholder="123456" maxLength={6} />
          </div>
        )}

        {error && <div style={{ color: 'var(--danger)', fontSize: '.8rem', textAlign: 'center' }}>{error}</div>}

        <button
          className="btn btn-primary btn-block"
          onClick={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : mode === 'join' ? handleJoinFamily : handleReset}
          disabled={loading}
        >
          {loading ? '...' : mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer et synchroniser' : mode === 'join' ? 'Rejoindre la famille' : 'Envoyer le lien'}
        </button>

        {mode === 'login' && (
          <button onClick={() => setMode('reset')} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            Mot de passe oublié ?
          </button>
        )}

        <button
          onClick={onDone}
          style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '.75rem', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}
        >
          Continuer sans synchro →
        </button>
      </div>
    </div>
  );
}


// ----------------------------------------------------------------------
// Appeler la Cloud Function setFamilyClaim pour définir le Custom Claim
// ----------------------------------------------------------------------
async function callSetFamilyClaim(familyId, role) {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions();
    const setFamilyClaim = httpsCallable(functions, 'setFamilyClaim');
    await setFamilyClaim({ familyId, role });
    // Forcer le refresh du token pour que le claim soit disponible immédiatement
    await auth.currentUser?.getIdToken(true);
  } catch (e) {
    console.warn('[Auth] setFamilyClaim failed (non bloquant):', e.message);
    // Non bloquant — l'app fonctionne sans Custom Claims (fallback sur rules Firestore)
  }
}

function firebaseError(code) {
  const map = {
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/invalid-email': 'Adresse email invalide.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/weak-password': 'Mot de passe trop court (6 caractères min).',
    'auth/network-request-failed': 'Pas de connexion réseau.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
  };
  return map[code] || `Erreur : ${code}`;
}

// ── Premier lancement ─────────────────────────────────────────────────
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
  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const handleCreate = () => {
    if (!nom.trim()) { setError('Entre ton prénom.'); return; }
    if (pin.length !== 4) { setError('Choisis un code PIN à 4 chiffres.'); return; }
    const id = genId();
    update((draft) => {
      draft.users.push({ id, nom: nom.trim(), pin, role: 'admin', initiales: initials(nom), couleur: color });
      return draft;
    });
    setSession({ userId: id });
    onCreated();
  };

  return (
    <div className="lock-screen">
      <div className="lock-logo">🍼</div>
      <div className="lock-title">Bienvenue sur OmniBaby</div>
      <div className="lock-sub">Crée ton profil pour commencer.</div>
      <div className="field w-full" style={{ maxWidth: 280 }}>
        <label>Ton prénom</label>
        <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Maman, Papa..." autoFocus />
      </div>
      <div className="field w-full" style={{ maxWidth: 280 }}>
        <label>Couleur</label>
        <div className="pill-group" style={{ justifyContent: 'center' }}>
          {AVATAR_COLOR_KEYS.map((c) => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 34, height: 34, borderRadius: '50%', background: avatarColor(c),
              border: color === c ? '3px solid var(--text)' : '3px solid transparent',
            }} />
          ))}
        </div>
      </div>
      <div className="field w-full" style={{ maxWidth: 280 }}>
        <label>Code PIN (4 chiffres)</label>
        <div className="pin-dots" style={{ justifyContent: 'center' }}>
          {[0,1,2,3].map((i) => <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />)}
        </div>
        <PinPad onDigit={handleDigit} onDelete={handleDelete} showBiometric={false} />
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>}
      <button className="btn btn-primary btn-block" style={{ maxWidth: 280, marginTop: 8 }} onClick={handleCreate}>
        Créer mon profil ✨
      </button>
    </div>
  );
}

// ── Écran de verrouillage PIN ─────────────────────────────────────────
function LockScreen({ onUnlocked }) {
  const { store, setSession } = useStore();
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
    const check = async () => {
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
        if (await isBiometricAvailable()) { setBioAvailable(true); return; }
        await new Promise((r) => setTimeout(r, 300));
      }
    };
    check();
    return () => { cancelled = true; };
  }, [biometrieActivee]);

  const selectedUser = store.users.find((u) => u.id === selectedUserId);

  const handleBiometric = useCallback(async () => {
    const ok = await biometricVerify(`Connexion en tant que ${selectedUser?.nom || ''}`);
    if (ok && selectedUser) { setSession({ userId: selectedUser.id }); onUnlocked(); }
    else showToast('Biometrie annulee ou indisponible', '⚠️');
  }, [selectedUser]);

  useEffect(() => { if (bioAvailable) handleBiometric(); }, [bioAvailable]);

  const handleDigit = useCallback((d) => {
    if (pin.length >= 4) return;
    const newPin = pin + String(d);
    setPin(newPin);
    if (newPin.length === 4) {
      if (selectedUser && newPin === selectedUser.pin) {
        setSession({ userId: selectedUser.id }); onUnlocked();
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setPin(''); }, 400);
      }
    }
  }, [pin, selectedUser]);

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
        {[0,1,2,3].map((i) => (
          <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''} ${shake ? 'error' : ''}`} />
        ))}
      </div>
      <PinPad onDigit={handleDigit} onDelete={() => setPin((p) => p.slice(0, -1))}
        onBiometric={handleBiometric} showBiometric={bioAvailable} />
      <button onClick={() => setBabySitterOpen(true)} style={{
        marginTop: 16, background: 'none', border: 'none',
        color: 'rgba(255,255,255,.55)', fontSize: '.78rem', cursor: 'pointer',
      }}>
        🧑‍🍼 Fiche de garde (sans PIN)
      </button>
      {babySitterOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '16px 16px 32px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>Fiche de garde</div>
              <button onClick={() => setBabySitterOpen(false)} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <BabySitterContent store={store} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auth gate principal ────────────────────────────────────────────────
export default function AuthGate({ children }) {
  const { store, firebaseUser } = useStore();
  const [unlocked, setUnlocked] = useState(false);
  const [showFirebaseLogin, setShowFirebaseLogin] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem('omnibaby_onboarding_done')
  );

  const completeOnboarding = () => {
    localStorage.setItem('omnibaby_onboarding_done', '1');
    setOnboardingDone(true);
  };

  // Onboarding au tout premier lancement (avant même la création de profil)
  if (!onboardingDone) {
    return <OnboardingScreen onDone={completeOnboarding} />;
  }

  // Premier lancement : pas de profil local → créer
  if (store.users.length === 0) {
    return <FirstLaunch onCreated={() => {
      setShowFirebaseLogin(true);
    }} />;
  }

  // Proposer Firebase si pas encore configuré
  if (showFirebaseLogin && !firebaseUser && !store.familyId) {
    return <FirebaseLoginScreen onDone={() => setShowFirebaseLogin(false)} />;
  }

  // Verrouillage PIN
  if (!unlocked) {
    return <LockScreen onUnlocked={() => setUnlocked(true)} />;
  }

  return children;
}
