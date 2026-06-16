import React from 'react';
import { useStore, getActiveChild, formatAge } from '../store.jsx';

// ----------------------------------------------------------------------
// Call button
// ----------------------------------------------------------------------
function CallButton({ tel }) {
  if (!tel) return null;
  return (
    <a className="btn btn-primary btn-sm" href={`tel:${tel.replace(/\s+/g, '')}`}>
      📞 Appeler
    </a>
  );
}

// ----------------------------------------------------------------------
// Info row
// ----------------------------------------------------------------------
function InfoRow({ icon, label, value, tel }) {
  return (
    <div className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-soft)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {icon} {label}
        </div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>{value || '—'}</div>
      </div>
      {tel && <CallButton tel={tel} />}
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Urgence module
// ----------------------------------------------------------------------
export default function UrgenceTool() {
  const { store } = useStore();
  const activeChild = getActiveChild(store);

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour créer sa fiche d'urgence.</div>
      </div>
    );
  }

  const hasAllergies = activeChild.allergies && activeChild.allergies.trim();

  return (
    <div>
      <div className="card appear" style={{ textAlign: 'center', background: 'var(--primary)', color: 'var(--on-primary)', border: 'none' }}>
        <div style={{ fontSize: '2.4rem' }}>{activeChild.emoji || '👶'}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>{activeChild.nom}</div>
        <div style={{ opacity: 0.9, fontSize: '0.85rem', marginTop: 2 }}>
          {formatAge(activeChild.birthdate)} · {activeChild.sexe === 'garcon' ? 'Garçon' : 'Fille'}
        </div>
      </div>

      {hasAllergies && (
        <div className="card appear" style={{ background: 'var(--danger-soft)', border: 'none' }}>
          <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.9rem' }}>⚠️ Allergies</div>
          <div style={{ marginTop: 4, fontWeight: 600 }}>{activeChild.allergies}</div>
        </div>
      )}

      <div className="card appear">
        <div className="section-title" style={{ marginBottom: 4 }}>🩺 Informations médicales</div>
        <InfoRow icon="🩸" label="Groupe sanguin" value={activeChild.groupeSanguin} />
        <InfoRow icon="⚠️" label="Allergies" value={activeChild.allergies || 'Aucune connue'} />
        <InfoRow icon="👨‍⚕️" label="Médecin / pédiatre" value={activeChild.medecinNom} tel={activeChild.medecinTel} />
        {activeChild.medecinTel && (
          <div className="muted" style={{ fontSize: '0.78rem', paddingTop: 6 }}>{activeChild.medecinTel}</div>
        )}
      </div>

      <div className="card appear">
        <div className="section-title" style={{ marginBottom: 4 }}>📞 Contact d'urgence</div>
        <InfoRow icon="👤" label="Nom" value={activeChild.contactUrgenceNom} tel={activeChild.contactUrgenceTel} />
        {activeChild.contactUrgenceTel && (
          <div className="muted" style={{ fontSize: '0.78rem', paddingTop: 6 }}>{activeChild.contactUrgenceTel}</div>
        )}
      </div>

      <div className="card appear">
        <div className="section-title" style={{ marginBottom: 6 }}>📝 Notes médicales</div>
        {activeChild.notesMedicales ? (
          <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{activeChild.notesMedicales}</div>
        ) : (
          <div className="muted" style={{ fontSize: '0.85rem' }}>Aucune note particulière.</div>
        )}
      </div>

      <div className="card appear" style={{ background: 'var(--danger-soft)', border: 'none', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, color: 'var(--danger)' }}>🚨 Urgence vitale</div>
        <div className="muted" style={{ fontSize: '0.8rem', margin: '6px 0 10px' }}>En cas d'urgence vitale, contacte les secours :</div>
        <a className="btn btn-danger btn-block" href="tel:15">📞 SAMU — 15</a>
      </div>

      <div className="muted text-center" style={{ fontSize: '0.78rem', marginBottom: 16 }}>
        Ces informations proviennent du profil de {activeChild.nom}. Modifie-les dans Réglages → Profils enfants.
      </div>
    </div>
  );
}
