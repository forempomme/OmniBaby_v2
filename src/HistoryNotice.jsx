import React, { useEffect } from 'react';
import { useStore, HISTORY_WINDOW_DAYS } from './store.jsx';
import { Icon } from './icons.jsx';

// ----------------------------------------------------------------------
// Historique au-delà de 60 jours (repas, changes, sommeil, températures)
// chargé à la demande. useFullHistory(true) le demande dès l'ouverture
// d'un écran qui en a besoin (Historique, Recherche, Stats 3 mois…).
// ----------------------------------------------------------------------
export function useFullHistory(active = true) {
  const { historyStatus, loadHistory } = useStore();
  useEffect(() => {
    if (active && historyStatus === 'partial') loadHistory();
  }, [active, historyStatus, loadHistory]);
  return historyStatus;
}

// Bandeau d'état : rien quand l'historique est complet.
// variant="card" : carte en fin de liste (Journal, vue « Tout »)
export function HistoryNotice({ compact = false, variant = 'bar' }) {
  const { historyStatus, loadHistory } = useStore();
  if (historyStatus === 'complete') return null;
  if (variant === 'card') {
    const loading = historyStatus === 'loading';
    return (
      <div className="history-card">
        <Icon name="history" size={26} />
        <strong>Entrées de plus de {HISTORY_WINDOW_DAYS} jours</strong>
        <span className="muted">
          {historyStatus === 'error'
            ? 'Chargement impossible pour l’instant (hors connexion ?).'
            : 'Pas chargées en direct pour rester sous le quota gratuit de Firebase (50 000 lectures par jour).'}
        </span>
        <button className="btn btn-primary btn-block" onClick={() => loadHistory()} disabled={loading}>
          {loading ? 'Chargement…' : historyStatus === 'error' ? 'Réessayer' : "Charger l'historique"}
        </button>
      </div>
    );
  }
  if (historyStatus === 'loading') {
    return (
      <div className="history-notice">
        <span className="history-spin" aria-hidden="true" />
        <span>Chargement de l'historique complet…</span>
      </div>
    );
  }
  return (
    <div className={`history-notice ${historyStatus === 'error' ? 'warn' : ''}`}>
      <Icon name="history" size={18} />
      <span className="flex-1">
        {historyStatus === 'error'
          ? 'Historique ancien indisponible (hors connexion ?).'
          : compact
            ? `Affichage : ${HISTORY_WINDOW_DAYS} derniers jours.`
            : `Les ${HISTORY_WINDOW_DAYS} derniers jours sont synchronisés en continu. L'historique plus ancien se charge à la demande.`}
      </span>
      <button className="btn btn-outline btn-sm" onClick={() => loadHistory()}>
        {historyStatus === 'error' ? 'Réessayer' : "Charger l'historique"}
      </button>
    </div>
  );
}
