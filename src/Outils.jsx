import React, { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Icon } from './icons.jsx';
import MinuteurTool from './tools/Minuteur.jsx';
import MedicamentsTool from './tools/Medicaments.jsx';
import FievreTool from './tools/Fievre.jsx';
import AlimentationTool from './tools/Alimentation.jsx';
import StatistiquesTool from './tools/Statistiques.jsx';
import RappelsTool from './tools/Rappels.jsx';
import FamilleTool from './tools/Famille.jsx';
import UrgenceTool from './tools/Urgence.jsx';
import RechercheTool from './tools/Recherche.jsx';
import DeveloppementTool from './tools/Developpement.jsx';
import HistoriqueTool from './tools/Historique.jsx';
import JournalBordTool from './tools/JournalBord.jsx';
import StockLaitTool from './tools/StockLait.jsx';

// ----------------------------------------------------------------------
// Tool definitions
// ----------------------------------------------------------------------
// tone : couleur de la pastille (primary | sage | sun | sky | danger)
const TOOLS = [
  { key: 'minuteur', icon: 'clock', tone: 'primary', name: 'Minuteur', desc: 'Chrono de tétée par sein avec alternance' },
  { key: 'medicaments', icon: 'pill', tone: 'sage', name: 'Médicaments', desc: 'Traitements en cours et alertes de dose' },
  { key: 'fievre', icon: 'thermo', tone: 'danger', name: 'Fièvre', desc: 'Courbe de température et alertes' },
  { key: 'stocklait', icon: 'fridge', tone: 'sky', name: 'Stock de lait', desc: 'Tire-lait, frigo, congélateur et dates limites' },
  { key: 'alimentation', icon: 'leaf', tone: 'sage', name: 'Alimentation', desc: 'Diversification, aliments testés, conseils lait' },
  { key: 'statistiques', icon: 'chart', tone: 'sky', name: 'Statistiques', desc: 'Graphiques biberons, sommeil, couches' },
  { key: 'journalbord', icon: 'camera', tone: 'sun', name: 'Journal de bord', desc: 'Souvenirs, premières fois, moments drôles' },
  { key: 'developpement', icon: 'puzzle', tone: 'sky', name: 'Développement', desc: 'Repères moteurs, langage et éveil par âge' },
  { key: 'rappels', icon: 'bell', tone: 'sun', name: 'Rappels', desc: 'RDV, courses, visites médicales' },
  { key: 'historique', icon: 'history', tone: 'primary', name: 'Historique', desc: 'Toutes les entrées, chronologique' },
  { key: 'famille', icon: 'users', tone: 'sage', name: 'Famille', desc: 'Utilisateurs et rôles' },
  { key: 'urgence', icon: 'alert', tone: 'danger', name: 'Urgence', desc: 'Fiche allergies, médecin, contacts' },
  { key: 'recherche', icon: 'search', tone: 'primary', name: 'Recherche', desc: "Recherche globale dans toute l'app" },
];

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
      case 'rappels':
        return <RappelsTool />;
      case 'famille':
        return <FamilleTool />;
      case 'urgence':
        return <UrgenceTool />;
      case 'recherche':
        return <RechercheTool />;
      case 'developpement':
        return <DeveloppementTool />;
      case 'historique':
        return <HistoriqueTool />;
      case 'journalbord':
        return <JournalBordTool />;
      case 'stocklait':
        return <StockLaitTool />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="section-title">Outils</div>
      <div className="tools-grid">
        {TOOLS.map((t) => (
          <button key={t.key} className="tool-card appear" onClick={() => open(t.key)}>
            <div className={`tool-icon tone-${t.tone}`}><Icon name={t.icon} size={24} /></div>
            <div className="tool-name">{t.name}</div>
            <div className="tool-desc">{t.desc}</div>
          </button>
        ))}
      </div>

      <Modal open={!!activeTool} onClose={close} title={activeTool?.name || ''}
        icon={activeTool ? <span className={`modal-tool-icon tone-${activeTool.tone}`}><Icon name={activeTool.icon} size={18} /></span> : null} full>
        {renderTool()}
      </Modal>
    </div>
  );
}
