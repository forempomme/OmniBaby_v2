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
export function Modal({ open, onClose, title, icon, children, full = false }) {
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
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`modal-panel ${full ? 'full' : ''}`}>
        <div className="modal-header">
          <h2>{icon && <span>{icon}</span>} {title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
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
