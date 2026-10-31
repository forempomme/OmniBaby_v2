import { Icon, UiIcon } from './icons.jsx';
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ----------------------------------------------------------------------
// Modal stack context — provides a LIFO stack so the Android back button
// can close the topmost modal first.
// ----------------------------------------------------------------------
const ModalStackContext = createContext(null);

export function ModalStackProvider({ children }) {
  // Pile dans une ref : fermer la modale du dessus ne doit pas se faire dans
  // un updater setState (rejoué deux fois en StrictMode → double fermeture).
  const stackRef = useRef([]);
  const [depth, setDepth] = useState(0);

  const push = useCallback((closeFn) => {
    stackRef.current = [...stackRef.current, closeFn];
    setDepth(stackRef.current.length);
  }, []);

  const pop = useCallback((closeFn) => {
    stackRef.current = stackRef.current.filter((f) => f !== closeFn);
    setDepth(stackRef.current.length);
  }, []);

  const closeTop = useCallback(() => {
    const top = stackRef.current[stackRef.current.length - 1];
    if (top) top();
  }, []);

  return (
    <ModalStackContext.Provider value={{ push, pop, closeTop, depth }}>
      {children}
    </ModalStackContext.Provider>
  );
}

function useModalStack() {
  const ctx = useContext(ModalStackContext);
  if (!ctx) throw new Error('useModalStack doit être utilisé dans un ModalStackProvider');
  return ctx;
}

// ----------------------------------------------------------------------
// Sliding panel (bottom sheet style modal)
// ----------------------------------------------------------------------
export function Modal({ open, onClose, title, icon, children, full = false, dirty = false }) {
  const [confirmClose, setConfirmClose] = React.useState(false);

  const handleClose = () => {
    if (dirty) { setConfirmClose(true); }
    else { onClose(); }
  };

  const handleConfirmAbandon = () => { setConfirmClose(false); onClose(); };
  const handleCancelAbandon = () => setConfirmClose(false);
  const { push, pop } = useModalStack();
  // Bouton retour Android : même comportement que la croix (confirmation si saisie en cours)
  const closeRef = useRef(handleClose);
  closeRef.current = handleClose;

  useEffect(() => {
    if (!open) return;
    const closeFn = () => closeRef.current();
    push(closeFn);
    return () => pop(closeFn);
  }, [open, push, pop]);

  if (!open) return null;

  // Rendu dans <body> : la modale passe au-dessus du bouton + et de la barre
  // d'onglets (avant, l'animation de l'onglet la confinait sous ceux-ci).
  return createPortal((
    <>
      <div className="modal-backdrop" onClick={handleClose} />
      <div className={`modal-panel ${full ? 'full' : ''}`}>
        <div className="modal-header">
          <h2>{icon && <span className="modal-title-icon"><UiIcon value={icon} size={20} /></span>} {title}</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Fermer"><Icon name="x" size={20} /></button>
        </div>
        <div className="modal-body">
          {children}
          {confirmClose && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(43,35,32,.6)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', zIndex: 60, borderRadius: 'inherit', gap: 12,
            }}>
              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                padding: '20px 24px', textAlign: 'center', maxWidth: 260,
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 8 }}><UiIcon value="⚠️" size={20} /></div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 6 }}>
                  Abandonner les modifications ?
                </div>
                <div style={{ fontSize: '.82rem', color: 'var(--text-soft)', marginBottom: 16 }}>
                  Les données saisies seront perdues.
                </div>
                <div className="row-8">
                  <button onClick={handleCancelAbandon} style={{
                    flex: 1, padding: '8px', borderRadius: 'var(--radius-pill)',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    fontWeight: 600, cursor: 'pointer', fontSize: '.82rem', fontFamily: 'inherit',
                  }}>
                    Continuer
                  </button>
                  <button onClick={handleConfirmAbandon} style={{
                    flex: 1, padding: '8px', borderRadius: 'var(--radius-pill)',
                    background: 'var(--danger)', color: '#fff',
                    border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '.82rem', fontFamily: 'inherit',
                  }}>
                    Abandonner
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  ), document.body);
}

// ----------------------------------------------------------------------
// Android back button handling (+ double-press to exit)
// ----------------------------------------------------------------------
export function useAndroidBack({ activeTab, setActiveTab, defaultTab = 'journal' }) {
  const { closeTop, depth } = useModalStack();
  const [showExitHint, setShowExitHint] = useState(false);
  const lastBackRef = useRef(0);

  useEffect(() => {
    let listenerHandle = null;
    let CapacitorApp = null;

    (async () => {
      try {
        const mod = await import('@capacitor/app');
        CapacitorApp = mod.App;
        listenerHandle = await CapacitorApp.addListener('backButton', () => {
          handleBack();
        });
      } catch (e) {
        // Not running in Capacitor (e.g. browser) — ignore
      }
    })();

    function handleBack() {
      if (depth > 0) {
        closeTop();
        return;
      }
      if (activeTab !== defaultTab) {
        setActiveTab(defaultTab);
        return;
      }
      const now = Date.now();
      if (now - lastBackRef.current < 2000) {
        CapacitorApp && CapacitorApp.exitApp && CapacitorApp.exitApp();
      } else {
        lastBackRef.current = now;
        setShowExitHint(true);
        setTimeout(() => setShowExitHint(false), 2000);
      }
    }

    return () => {
      if (listenerHandle && listenerHandle.remove) listenerHandle.remove();
    };
  }, [depth, activeTab, defaultTab, closeTop, setActiveTab]);

  return { showExitHint };
}
