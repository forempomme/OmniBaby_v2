import React, { useState, useEffect, useCallback } from 'react';
import { useStore, genId } from './store.jsx';
import { useToast } from './utils.jsx';

const AVATAR_COLORS = {
  purple: '#9B7EBD',
  orange: '#E0A458',
  green: '#7C9885',
  blue: '#6E97A8',
  pink: '#D98A9A',
  brown: '#A47C5F',
};

export function avatarColor(c) {
  return AVATAR_COLORS[c] || AVATAR_COLORS.purple;
}

export const AVATAR_COLOR_KEYS = Object.keys(AVATAR_COLORS);

function initials(nom) {
  return (nom || '?').trim().slice(0, 2).toUpperCase();
}

// ----------------------------------------------------------------------
// Biometric helper
// On attend que Capacitor soit prêt avant d'appeler le plugin.
// Le plugin est enregistré nativement par Capacitor sur Android —
// window.Capacitor.Plugins.NativeBiometric est disponible après init.
// ----------------------------------------------------------------------
function getPlugin() {
  try {
    const cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    // Le plugin est accessible via le bridge natif Capacitor
    const plugin = cap.Plugins && cap.Plugins.NativeBiometric;
    return plugin || null;
  } catch (e) {
    return null;
  }
}

export async function isBiometricAvailable() {
  try {
    const plugin = getPlugin();
    if (!plugin) return false;
    const result = await plugin.isAvailable();
    return !!(result && result.isAvailable);
  } catch (e) {
    return false;
  }
}

export async function biometricVerify(reason) {
  try {
    const plugin = getPlugin();
    if (!plugin) return false;
    await plugin.verifyIdentity({
      reason: reason || 'Connexion à OmniBaby',
      title: 'OmniBaby',
      subtitle: 'Connexion par empreinte digitale',
      description: '',
      useFallback: false,
    });
    return true;
  } catch (e) {
    return false;
  }
}

// ----------------------------------------------------------------------
// PIN pad
// ----------------------------------------------------------------------
function PinPad({ onDigit, onDelete, onBiometric, showBiometric }) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return (
    <>
      <div className="numpad">
        {digits.map((d) => (
          <button key={d} onClick={() => onDigit(d)}>{d}</button>
        ))}
        <div className="numpad-empty" />
        <button onClick={() => onDigit(0)}>0</button>
        <button className="numpad-action" onClick={onDelete}>⌫</button>
      </div>
      {showBiometric && (
        <button className="biometric-btn" onClick={onBiometric}>
          <span className="icon">🔐</span>
          Empreinte digitale
        </button>
      )}
    </>
  );
}

// ----------------------------------------------------------------------
// First launch
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
  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const handleCreate = () => {
    if (!nom.trim()) { setError('Entre ton prénom pour continuer.'); return; }
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
      <div className="lock-sub">Crée ton profil pour commencer. Tu seras l'administrateur de la famille.</div>

      <div className="field w-full" style={{ maxWidth: 280 }}>
        <label>Ton prénom</label>
        <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Maman, Papa, Mamie..." autoFocus />
      </div>

      <div className="field w-full" style={{ maxWidth: 280 }}>
        <label>Couleur de ton avatar</label>
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
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
          ))}
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


// ----------------------------------------------------------------------
// BabySitterContent : fiche de garde accessible sans PIN
// Affiche les infos essentielles de l'enfant actif
// ----------------------------------------------------------------------
function BabySitterContent({ store }) {
  const activeChild = store.children.find((c) => c.id === store.activeChildId) || store.children[0];
  if (!activeChild) return (
    <div style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '24px 0' }}>
      Aucun profil enfant configuré.
    </div>
  );
  return (
    <div>
      <div style={{ background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-lg)',
        padding: '14px', textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '2rem' }}>{activeChild.emoji || '👶'}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', marginTop: 4 }}>
          {activeChild.nom}
        </div>
      </div>
      {activeChild.allergies && (
        <div style={{ background: 'var(--danger-soft)', borderRadius: 'var(--radius-md)',
          padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '.85rem' }}>⚠️ Allergies</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{activeChild.allergies}</div>
        </div>
      )}
      {[
        { label: '🩸 Groupe sanguin', val: activeChild.groupeSanguin },
        { label: '👨‍⚕️ Médecin', val: activeChild.medecinNom, tel: activeChild.medecinTel },
        { label: '👤 Urgence famille', val: activeChild.contactUrgenceNom, tel: activeChild.contactUrgenceTel },
      ].map((r, i) => r.val && (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '.65rem', color: 'var(--text-soft)', fontWeight: 700, textTransform: 'uppercase' }}>{r.label}</div>
            <div style={{ fontWeight: 600, fontSize: '.86rem', marginTop: 1 }}>{r.val}</div>
          </div>
          {r.tel && <a href={`tel:${r.tel.replace(/\s+/g,'')}`} style={{
            background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-pill)',
            padding: '5px 12px', fontSize: '.75rem', fontWeight: 600, textDecoration: 'none',
          }}>📞 Appeler</a>}
        </div>
      ))}
      <a href="tel:15" style={{ display: 'block', textAlign: 'center', marginTop: 14,
        background: 'var(--danger)', color: '#fff', borderRadius: 'var(--radius-pill)',
        padding: '10px', fontWeight: 700, fontSize: '.88rem', textDecoration: 'none' }}>
        🚨 SAMU — 15
      </a>
    </div>
  );
}

// ----------------------------------------------------------------------
// Lock screen
// ----------------------------------------------------------------------
function LockScreen({ onUnlocked }) {
  const { store, setSession } = useStore();
  const showToast = useToast();
  const [selectedUserId, setSelectedUserId] = useState(store.users[0]?.id ?? null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [babySitterOpen, setBabySitterOpen] = useState(false);

  const biometrieActivee = store.settings?.biometrie !== false;

  // Attendre que Capacitor soit initialisé avant de vérifier la biométrie
  useEffect(() => {
    if (!biometrieActivee) return;

    let cancelled = false;

    const check = async () => {
      // Réessayer jusqu'à 10 fois avec 300ms d'intervalle
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
        const ok = await isBiometricAvailable();
        if (ok) {
          setBioAvailable(true);
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    };

    check();
    return () => { cancelled = true; };
  }, [biometrieActivee]);

  const selectedUser = store.users.find((u) => u.id === selectedUserId);

  const handleBiometric = useCallback(async () => {
    const ok = await biometricVerify(`Connexion en tant que ${selectedUser?.nom || ''}`);
    if (ok && selectedUser) {
      setSession({ userId: selectedUser.id });
      onUnlocked();
    } else {
      showToast('Biométrie annulée ou indisponible', '⚠️');
    }
  }, [selectedUser, setSession, onUnlocked, showToast]);

  // Proposer automatiquement la biométrie dès qu'elle est détectée
  useEffect(() => {
    if (bioAvailable) {
      handleBiometric();
    }
  }, [bioAvailable]);

  const handleDigit = useCallback((d) => {
    if (pin.length >= 4) return;
    const newPin = pin + String(d);
    setPin(newPin);
    if (newPin.length === 4) {
      if (selectedUser && newPin === selectedUser.pin) {
        setSession({ userId: selectedUser.id });
        onUnlocked();
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setPin(''); }, 400);
      }
    }
  }, [pin, selectedUser, setSession, onUnlocked]);

  const handleDelete = () => setPin((p) => p.slice(0, -1));

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

      <PinPad
        onDigit={handleDigit}
        onDelete={handleDelete}
        onBiometric={handleBiometric}
        showBiometric={bioAvailable}
      />

      <button
        onClick={() => setBabySitterOpen(true)}
        style={{
          marginTop: 16, background: 'none', border: 'none',
          color: 'rgba(255,255,255,.6)', fontSize: '.78rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        🧑‍🍼 Fiche de garde (sans PIN)
      </button>

      {babySitterOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          <div style={{
            background: 'var(--bg)', borderRadius: '20px 20px 0 0',
            padding: '16px 16px 32px', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
                🧑‍🍼 Fiche de garde
              </div>
              <button onClick={() => setBabySitterOpen(false)} style={{
                background: 'var(--surface-2)', border: 'none',
                borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontSize: '.8rem',
              }}>✕ Fermer</button>
            </div>
            <BabySitterContent store={store} />
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Auth gate
// ----------------------------------------------------------------------
export default function AuthGate({ children }) {
  const { store } = useStore();
  const [unlocked, setUnlocked] = useState(false);

  if (store.users.length === 0) return <FirstLaunch onCreated={() => setUnlocked(true)} />;
  if (!unlocked) return <LockScreen onUnlocked={() => setUnlocked(true)} />;
  return children;
}
