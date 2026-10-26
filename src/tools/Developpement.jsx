import React, { useState, useMemo } from 'react';
import { useStore, getActiveChild, ageInMonths } from '../store.jsx';
import { useToast, scheduleNotif, requestNotifPermission, fireConfetti, parseLocalDate } from '../utils.jsx';
import { DEV_CATEGORIES, DEV_JALONS } from '../data/developpement.js';

import { Icon, UiIcon } from '../icons.jsx';
// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
function formatAgeMonths(months) {
  if (months < 12) return `${months} mois`;
  const y = Math.floor(months / 12), m = months % 12;
  return m > 0 ? `${y} an${y>1?'s':''} ${m} mois` : `${y} an${y>1?'s':''}`;
}

// ----------------------------------------------------------------------
// Carte jalon
// ----------------------------------------------------------------------
function JalonCard({ jalon, done, doneDate, onToggle, ageM }) {
  const cat = DEV_CATEGORIES.find(c => c.key === jalon.cat);
  const isCurrentRange = ageM >= jalon.ageMin / 4 && ageM <= jalon.ageMax / 4;
  const isUpcoming = ageM < jalon.ageMin / 4 && ageM >= (jalon.ageMin / 4) - 2;
  const isLate = ageM > jalon.ageMax / 4 && !done;

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
        background: done ? 'var(--accent-sage-soft)' : isLate ? 'var(--danger-soft)' : 'var(--surface)',
        border: `1.5px solid ${done ? 'var(--accent-sage)' : isLate ? 'var(--danger)' : isCurrentRange ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)', marginBottom: 6, cursor: 'pointer',
        transition: 'all .15s',
      }}
    >
      {/* Emoji jalon */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: done ? 'var(--accent-sage)' : `${cat?.color}22` || 'var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
      }}>
        {done ? <Icon name="check" size={20} /> : jalon.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: '.84rem',
          color: done ? 'var(--accent-sage)' : isLate ? 'var(--danger)' : 'var(--text)',
          textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.8 : 1,
        }}>
          {jalon.label}
        </div>
        <div style={{ fontSize: '.68rem', color: 'var(--text-soft)', marginTop: 2, display: 'flex', gap: 6 }}>
          <span>{formatAgeMonths(Math.round(jalon.ageMin/4))}–{formatAgeMonths(Math.round(jalon.ageMax/4))}</span>
          {done && doneDate && <span style={{ color:'var(--accent-sage)' }}>· {new Date(doneDate).toLocaleDateString('fr-FR')}</span>}
          {isLate && !done && <span style={{ color:'var(--danger)', fontWeight:700 }}>· À surveiller</span>}
          {isCurrentRange && !done && <span style={{ color:'var(--primary)', fontWeight:700 }}>· Attendu</span>}
          {isUpcoming && !done && <span style={{ color:'var(--text-faint)' }}>· Bientôt</span>}
        </div>
      </div>

      {/* Badge catégorie */}
      <span style={{
        fontSize: '.6rem', fontWeight: 700, padding: '2px 6px',
        borderRadius: 'var(--radius-pill)', flexShrink: 0,
        background: `${cat?.color}33`, color: cat?.color || 'var(--text-soft)',
      }}>
        {cat?.icon} {cat?.label}
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main DeveloppementTool
// ----------------------------------------------------------------------
export default function DeveloppementTool() {
  const { store, update } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [filterCat, setFilterCat] = useState('tous');
  const [showDone, setShowDone] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const ageM = ageInMonths(activeChild?.birthdate) ?? 0;

  // Jalons acquis : stockés dans store.settings.developpement[childId][jalonId]
  const doneMap = useMemo(() => {
    const key = `dev_${activeChild?.id}`;
    return store.settings?.[key] || {};
  }, [store.settings, activeChild]);

  const toggleJalon = async (jalon) => {
    const key = `dev_${activeChild?.id}`;
    const alreadyDone = !!doneMap[jalon.id];
    update(draft => {
      if (!draft.settings[key]) draft.settings[key] = {};
      if (alreadyDone) {
        delete draft.settings[key][jalon.id];
      } else {
        draft.settings[key][jalon.id] = new Date().toISOString();
      }
      return draft;
    });

    if (!alreadyDone) {
      fireConfetti();
      showToast(`${jalon.emoji} ${jalon.label} !`, '🎉');

      // Planifier la prochaine étape
      const granted = await requestNotifPermission();
      if (granted && activeChild?.birthdate) {
        const nextJalon = DEV_JALONS
          .filter(j => !doneMap[j.id] && j.id !== jalon.id)
          .filter(j => j.ageMin > jalon.ageMin)
          .sort((a, b) => a.ageMin - b.ageMin)[0];

        if (nextJalon) {
          const notifDate = parseLocalDate(activeChild.birthdate);
          notifDate.setDate(notifDate.getDate() + Math.round((nextJalon.ageMin / 4) * 30.44));
          notifDate.setDate(notifDate.getDate() - 14); // 2 semaines avant
          notifDate.setHours(9, 0, 0, 0); // 9 h, pas en pleine nuit

          if (notifDate > new Date()) {
            await scheduleNotif({
              id: `dev_${nextJalon.id}_${activeChild.id}`,
              title: `Développement — ${activeChild.nom}`,
              body: `Bientôt attendu : ${nextJalon.emoji} ${nextJalon.label}`,
              at: notifDate.toISOString(),
            });
          }
        }
      }
    } else {
      showToast('Étape retirée', '↩️');
    }
  };

  // Filtrage des jalons visibles
  const visibleJalons = useMemo(() => {
    let jalons = DEV_JALONS;

    // Filtre catégorie
    if (filterCat !== 'tous') jalons = jalons.filter(j => j.cat === filterCat);

    // Si pas showAll : montrer la fenêtre ±6 mois + acquis
    if (!showAll) {
      const windowMin = ageM * 4 - 24;
      const windowMax = ageM * 4 + 24;
      jalons = jalons.filter(j =>
        doneMap[j.id] ||
        (j.ageMax >= windowMin && j.ageMin <= windowMax)
      );
    }

    // Masquer les acquis si demandé
    if (!showDone) jalons = jalons.filter(j => !doneMap[j.id]);

    return jalons;
  }, [filterCat, showAll, showDone, ageM, doneMap]);

  // Catégories paramétrables (activées par défaut)
  const enabledCats = store.settings?.devCats || DEV_CATEGORIES.map(c => c.key);

  const toggleCatSetting = (catKey) => {
    update(draft => {
      const current = draft.settings.devCats || DEV_CATEGORIES.map(c => c.key);
      draft.settings.devCats = current.includes(catKey)
        ? current.filter(c => c !== catKey)
        : [...current, catKey];
      return draft;
    });
  };

  // Stats
  const totalDone = Object.keys(doneMap).length;
  const totalVisible = DEV_JALONS.filter(j =>
    enabledCats.includes(j.cat) && j.ageMax / 4 <= ageM + 6
  ).length;

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji"><UiIcon value="👶" size={40} /></div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour suivre son développement.</div>
      </div>
    );
  }

  return (
    <div>
      {/* En-tête */}
      <div className="card appear" style={{ marginBottom: 12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem' }}>
              {activeChild.emoji} {activeChild.nom} · {ageM} mois
            </div>
            <div style={{ fontSize:'.75rem', color:'var(--text-soft)', marginTop:2 }}>
              {totalDone} étape{totalDone>1?'s':''} acquise{totalDone>1?'s':''}
              {totalVisible > 0 && ` sur ${totalVisible} attendues`}
            </div>
          </div>
          {/* Barre de progression */}
          <div style={{ width:60, textAlign:'center' }}>
            <svg width={52} height={52}>
              <circle cx={26} cy={26} r={20} fill="none" stroke="var(--border)" strokeWidth={5} />
              <circle cx={26} cy={26} r={20} fill="none" stroke="var(--accent-sage)" strokeWidth={5}
                strokeDasharray={`${totalVisible>0?(totalDone/totalVisible)*125.6:0} 125.6`}
                strokeLinecap="round" strokeDashoffset="31.4"
                style={{ transition:'stroke-dasharray .5s ease' }} />
            </svg>
            <div style={{ fontSize:'.65rem', marginTop:-6, fontWeight:700, color:'var(--accent-sage)' }}>
              {totalVisible > 0 ? Math.round((totalDone/totalVisible)*100) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Filtres catégorie */}
      <div className="chip-row">
        <button className={`chip ${filterCat==='tous'?'active':''}`} onClick={()=>setFilterCat('tous')}>Toutes</button>
        {DEV_CATEGORIES.filter(c => enabledCats.includes(c.key)).map(c => (
          <button key={c.key} className={`chip ${filterCat===c.key?'active':''}`} onClick={()=>setFilterCat(c.key)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Options d'affichage */}
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
        <button className={`chip ${showDone?'active':''}`} onClick={()=>setShowDone(s=>!s)}>
          <Icon name={showDone ? 'checkSquare' : 'square'} size={14} /> Acquises
        </button>
        <button className={`chip ${showAll?'active':''}`} onClick={()=>setShowAll(s=>!s)}>
          {showAll ? <><Icon name="clipboard" size={14} /> Tout</> : <><Icon name="pin" size={14} /> Autour de l'âge</>}
        </button>
      </div>

      {/* Catégories paramétrables */}
      <details style={{ marginBottom:12 }}>
        <summary style={{ fontSize:'.75rem', color:'var(--text-soft)', cursor:'pointer', fontWeight:600 }}>
          <Icon name="sliders" size={14} /> Catégories à suivre
        </summary>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
          {DEV_CATEGORIES.map(c => (
            <button key={c.key}
              onClick={() => toggleCatSetting(c.key)}
              style={{
                padding:'4px 10px', borderRadius:'var(--radius-pill)', fontSize:'.72rem', fontWeight:600,
                cursor:'pointer', fontFamily:'inherit', border:'1.5px solid',
                background: enabledCats.includes(c.key) ? c.color : 'var(--surface)',
                color: enabledCats.includes(c.key) ? '#fff' : 'var(--text-soft)',
                borderColor: enabledCats.includes(c.key) ? c.color : 'var(--border)',
              }}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize:'.68rem', marginTop:6 }}>
          Les catégories désactivées n'envoient pas de notifications et ne comptent pas dans la progression.
        </div>
      </details>

      {/* Liste jalons */}
      {visibleJalons.length === 0 ? (
        <div className="empty-state">
          <div className="emoji"><UiIcon value="🎯" size={40} /></div>
          <div className="title">Aucune étape à afficher</div>
          <div className="desc">Ajuste les filtres ou active "Tout" pour voir tous les jalons.</div>
        </div>
      ) : (
        visibleJalons.map(j => (
          <JalonCard
            key={j.id}
            jalon={j}
            done={!!doneMap[j.id]}
            doneDate={doneMap[j.id]}
            onToggle={() => toggleJalon(j)}
            ageM={ageM}
          />
        ))
      )}

      <div className="muted" style={{ fontSize:'.7rem', marginTop:12 }}>
        Source : OMS / SFP / HAS · Les âges sont des fourchettes normales — variations individuelles fréquentes. Consulte un pédiatre en cas de doute.
      </div>
    </div>
  );
}
