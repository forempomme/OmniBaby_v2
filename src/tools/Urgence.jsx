import React from 'react';
import { useStore, getActiveChild, formatAge } from '../store.jsx';
import { useToast } from '../utils.jsx';

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
  const showToast = useToast();
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

  const handleSharePDF = async () => {
    try {
      const { createPdfDoc, sharePdf } = await import('../pdf.js');
      const doc = await createPdfDoc();
      const W = 210, M = 14;
      let y = 0;

      // Header
      doc.setFillColor(201, 111, 74);
      doc.rect(0, 0, W, 30, 'F');
      doc.setTextColor(255,255,255);
      doc.setFont('Poppins','bold');
      doc.setFontSize(16);
      doc.text('Fiche de garde — OmniBaby', M, 14);
      doc.setFontSize(9); doc.setFont('Poppins','normal');
      doc.text(`Générée le ${new Date().toLocaleDateString('fr-FR')}`, M, 22);
      y = 36;

      // Enfant
      doc.setTextColor(43,35,32);
      doc.setFillColor(240,205,188);
      doc.rect(M, y, W-M*2, 18, 'F');
      doc.setFont('Poppins','bold'); doc.setFontSize(14);
      doc.text(activeChild.nom, M+4, y+8);
      doc.setFont('Poppins','normal'); doc.setFontSize(9);
      doc.setTextColor(100,80,70);
      doc.text(`${formatAge(activeChild.birthdate)} - ${activeChild.sexe==='garcon'?'Garçon':'Fille'}`, M+4, y+15);
      y += 24;

      // Allergies
      if (activeChild.allergies) {
        doc.setFillColor(245,218,211);
        doc.rect(M, y, W-M*2, 16, 'F');
        doc.setTextColor(194,84,63); doc.setFont('Poppins','bold'); doc.setFontSize(10);
        doc.text('ALLERGIES', M+4, y+6);
        doc.setFont('Poppins','normal'); doc.setTextColor(43,35,32); doc.setFontSize(9);
        doc.text(activeChild.allergies, M+4, y+13);
        y += 22;
      }

      // Infos médicales
      doc.setFont('Poppins','bold'); doc.setFontSize(10); doc.setTextColor(138,90,68);
      doc.text('Informations médicales', M, y+5);
      doc.line(M, y+7, W-M, y+7); y += 10;
      const rows = [
        ['Groupe sanguin', activeChild.groupeSanguin||'—'],
        ['Médecin', `${activeChild.medecinNom||'—'}${activeChild.medecinTel?' — '+activeChild.medecinTel:''}`],
        ['Contact urgence', `${activeChild.contactUrgenceNom||'—'}${activeChild.contactUrgenceTel?' — '+activeChild.contactUrgenceTel:''}`],
      ];
      doc.setFont('Poppins','normal'); doc.setFontSize(9); doc.setTextColor(43,35,32);
      rows.forEach(([l,v]) => {
        doc.setFont('Poppins','bold'); doc.text(l+' :', M, y);
        doc.setFont('Poppins','normal'); doc.text(v, M+40, y);
        y += 6;
      });

      // Notes médicales
      if (activeChild.notesMedicales) {
        y += 4;
        doc.setFont('Poppins','bold'); doc.setFontSize(10); doc.setTextColor(138,90,68);
        doc.text('Notes médicales', M, y);
        doc.line(M, y+2, W-M, y+2); y += 6;
        doc.setFont('Poppins','normal'); doc.setFontSize(9); doc.setTextColor(43,35,32);
        doc.splitTextToSize(activeChild.notesMedicales, W-M*2).forEach(l => { doc.text(l, M, y); y += 5; });
      }

      // SAMU
      y += 6;
      doc.setFillColor(194,84,63);
      doc.rect(M, y, W-M*2, 14, 'F');
      doc.setTextColor(255,255,255); doc.setFont('Poppins','bold'); doc.setFontSize(12);
      doc.text('URGENCE VITALE : SAMU 15', W/2, y+9, { align:'center' });

      // Partage
      const safe = String(activeChild.nom || 'bebe').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-');
      await sharePdf(doc, `fiche-garde-${safe}-${new Date().toISOString().slice(0,10)}.pdf`);
      showToast('Fiche partagée', '📄');
    } catch(e) { showToast('Erreur : '+e.message, '⚠️'); }
  };

  return (
    <div>
      {/* Bouton partage en haut */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
        <button className="btn btn-secondary btn-sm" onClick={handleSharePDF}>
          📄 Partager la fiche
        </button>
      </div>
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
