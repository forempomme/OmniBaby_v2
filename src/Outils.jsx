import React, { useState } from 'react';
import { Modal } from './Modal.jsx';
import MinuteurTool from './tools/Minuteur.jsx';
import MedicamentsTool from './tools/Medicaments.jsx';
import FievreTool from './tools/Fievre.jsx';
import AlimentationTool from './tools/Alimentation.jsx';
import StatistiquesTool from './tools/Statistiques.jsx';
import RappelsTool from './tools/Rappels.jsx';
import FamilleTool from './tools/Famille.jsx';
import UrgenceTool from './tools/Urgence.jsx';
import RechercheTool from './tools/Recherche.jsx';
import HistoriqueTool from './tools/Historique.jsx';
import JournalBordTool from './tools/JournalBord.jsx';

// ----------------------------------------------------------------------
// Tool definitions
// ----------------------------------------------------------------------
export const TOOLS = [
  { key: 'minuteur', icon: '⏱️', name: 'Minuteur', desc: 'Chrono de tétée par sein avec alternance' },
  { key: 'medicaments', icon: '💊', name: 'Médicaments', desc: 'Traitements en cours et alertes de dose' },
  { key: 'fievre', icon: '🌡️', name: 'Fièvre', desc: 'Courbe de température et alertes' },
  { key: 'alimentation', icon: '🥦', name: 'Alimentation', desc: 'Diversification, aliments testés, conseils lait' },
  { key: 'statistiques', icon: '📊', name: 'Statistiques', desc: 'Graphiques biberons, sommeil, couches' },
  { key: 'journalbord', icon: '📸', name: 'Journal de bord', desc: 'Souvenirs et étapes de développement' },
  { key: 'rappels', icon: '🎯', name: 'Rappels', desc: 'RDV, courses, visites médicales' },
  { key: 'historique', icon: '🗂️', name: 'Historique', desc: 'Toutes les entrées, chronologique' },
  { key: 'famille', icon: '👨‍👩‍👧', name: 'Famille', desc: 'Utilisateurs et rôles' },
  { key: 'urgence', icon: '🆘', name: 'Urgence', desc: 'Fiche allergies, médecin, contacts' },
  { key: 'recherche', icon: '🔍', name: 'Recherche', desc: "Recherche globale dans toute l'app" },
];

// ----------------------------------------------------------------------
// Placeholder for tools not yet implemented
// ----------------------------------------------------------------------
function ToolPlaceholder({ icon, name }) {
  return (
    <div className="empty-state">
      <div className="emoji">{icon}</div>
      <div className="title">{name}</div>
      <div className="desc">Ce module arrive dans une prochaine étape.</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Outils tab
// ----------------------------------------------------------------------
export default function OutilsTab({ openToolKey, setOpenToolKey, onTimerFinish }) {
  const [internalOpen, setInternalOpen] = useState(null);
  const activeKey = openToolKey || internalOpen;

  const close = () => {
    setInternalOpen(null);
    if (setOpenToolKey) setOpenToolKey(null);
  };

  const open = (key) => {
    if (setOpenToolKey) setOpenToolKey(key);
    else setInternalOpen(key);
  };

  const activeTool = TOOLS.find((t) => t.key === activeKey);

  const renderTool = () => {
    if (!activeTool) return null;
    switch (activeTool.key) {
      case 'minuteur':
        return (
          <MinuteurTool
            onFinish={(prefill) => {
              close();
              onTimerFinish && onTimerFinish(prefill);
            }}
          />
        );
      case 'medicaments':
        return <MedicamentsTool />;
      case 'fievre':
        return <FievreTool />;
      case 'alimentation':
        return <AlimentationTool />;
      case 'statistiques':
        return <StatistiquesTool />;
      case 'journalbord':
        return <JournalBordTool />;
      case 'rappels':
        return <RappelsTool />;
      case 'historique':
        return <HistoriqueTool />;
      case 'famille':
        return <FamilleTool />;
      case 'urgence':
        return <UrgenceTool />;
      case 'recherche':
        return <RechercheTool />;
      default:
        return <ToolPlaceholder icon={activeTool.icon} name={activeTool.name} />;
    }
  };

  return (
    <div>
      <div className="section-title">🛠️ Outils</div>
      <div className="tools-grid">
        {TOOLS.map((t) => (
          <button key={t.key} className="tool-card appear" onClick={() => open(t.key)}>
            <div className="tool-icon">{t.icon}</div>
            <div className="tool-name">{t.name}</div>
            <div className="tool-desc">{t.desc}</div>
          </button>
        ))}
      </div>

      <Modal open={!!activeTool} onClose={close} title={activeTool?.name || ''} icon={activeTool?.icon} full>
        {renderTool()}
      </Modal>
    </div>
  );
}
