import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

// ----------------------------------------------------------------------
// Modal stack context — provides a LIFO stack so the Android back button
// can close the topmost modal first.
// ----------------------------------------------------------------------
const ModalStackContext = createContext(null);

export function ModalStackProvider({ children }) {
  const [stack, setStack] = useState([]); // array of close callbacks

  const push = useCallback((closeFn) => {
    setStack((s) => [...s, closeFn]);
  }, []);

  const pop = useCallback((closeFn) => {
    setStack((s) => s.filter((f) => f !== closeFn));
  }, []);

  const closeTop = useCallback(() => {
    setStack((s) => {
      if (s.length === 0) return s;
      const top = s[s.length - 1];
      top();
      return s.slice(0, -1);
    });
  }, []);

  return (
    <ModalStackContext.Provider value={{ push, pop, closeTop, depth: stack.length }}>
      {children}
    </ModalStackContext.Provider>
  );
}

export function useModalStack() {
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
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const closeFn = () => closeRef.current();
    push(closeFn);
    return () => pop(closeFn);
  }, [open, push, pop]);

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={handleClose} />
      <div className={`modal-panel ${full ? 'full' : ''}`}>
        <div className="modal-header">
          <h2>{icon && <span>{icon}</span>} {title}</h2>
          <button className="modal-close" onClick={handleClose}>✕</button>
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
                <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>⚠️</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 6 }}>
                  Abandonner les modifications ?
                </div>
                <div style={{ fontSize: '.82rem', color: 'var(--text-soft)', marginBottom: 16 }}>
                  Les données saisies seront perdues.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
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
  );
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
