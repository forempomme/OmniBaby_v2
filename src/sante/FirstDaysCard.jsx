import React, { useState } from 'react';
import { useStore, authorFields } from '../store.jsx';
import { useToast, formatDateFR } from '../utils.jsx';
import { Icon } from '../icons.jsx';
import { lifeDay, weightSummary, diaperDays } from '../firstDays.js';

const kg = (v) => `${Number(v).toFixed(2).replace('.', ',')} kg`;
const pctText = (p) => `${p > 0 ? '−' : '+'}${Math.abs(p).toString().replace('.', ',')} %`;

// ----------------------------------------------------------------------
// Premiers jours (J1 → J21) : poids / poids de naissance + couches par jour
// ----------------------------------------------------------------------
export default function FirstDaysCard({ child, mesures, entries, canEdit }) {
  const { update, nextId, firebaseUser } = useStore();
  const showToast = useToast();
  const [birthKg, setBirthKg] = useState('');
  const now = new Date();
  const day = lifeDay(child.birthdate, now);
  const w = weightSummary(mesures, child, now);
  const diapers = diaperDays(entries, child, now, 5);
  const breastfed = child.alimentation === 'allaitement' || child.alimentation === 'mixte';

  const saveBirth = () => {
    const v = parseFloat(String(birthKg).replace(',', '.'));
    if (!(v > 1 && v < 7)) { showToast('Entre le poids en kg (ex. 3,4)', '⚠️'); return; }
    update((d) => { d.mesures.push({ id: nextId(), childId: child.id, type: 'poids', date: child.birthdate, valeur: v, ...authorFields(firebaseUser, 'created') }); return d; });
    setBirthKg('');
    showToast('Poids de naissance enregistré', '✅');
  };

  const level = w.lateReturn ? 'alert' : w.last?.level;
  return (
    <div className="card appear first-days">
      <div className="flex-between">
        <div className="section-title mb-0"><Icon name="baby" size={18} /> Premiers jours</div>
        <span className="fd-day">J{day}</span>
      </div>

      <div className="fd-block">
        <div className="fd-h"><Icon name="scale" size={15} /> Poids</div>
        {!w.birth ? (
          canEdit ? (
            <div className="fd-birth">
              <input type="number" inputMode="decimal" step="0.01" placeholder="Poids de naissance (kg)" value={birthKg} onChange={(e) => setBirthKg(e.target.value)} />
              <button className="btn btn-secondary btn-sm" onClick={saveBirth}>Enregistrer</button>
            </div>
          ) : <div className="muted fs-80">Poids de naissance non renseigné.</div>
        ) : (
          <>
            <div className="fd-weights">
              <div><span>Naissance</span><b>{kg(w.birth.valeur)}</b></div>
              {w.last && <div><span>J{w.last.day} · {formatDateFR(w.last.date)}</span><b>{kg(w.last.valeur)}</b></div>}
              {w.last && <div className={`fd-pct ${level}`}><span>Écart</span><b>{pctText(w.last.pct)}</b></div>}
            </div>
            {w.backOn ? (
              <div className="fd-msg ok"><Icon name="check" size={15} /> Poids de naissance retrouvé à J{w.backOn.day}</div>
            ) : w.lateReturn ? (
              <div className="fd-msg alert"><Icon name="alert" size={15} /> Pas encore revenu au poids de naissance après 3 semaines : à signaler à la sage-femme ou au pédiatre.</div>
            ) : w.last?.level === 'alert' ? (
              <div className="fd-msg alert"><Icon name="alert" size={15} /> Perte de 10 % ou plus : à signaler à la sage-femme ou au pédiatre.</div>
            ) : w.last?.level === 'watch' ? (
              <div className="fd-msg watch"><Icon name="alert" size={15} /> Perte proche de 10 % : à surveiller, repèse dans 1 à 2 jours.</div>
            ) : !w.last ? (
              <div className="muted fs-80">Ajoute une pesée (Poids, ci-dessous) pour suivre l’écart.</div>
            ) : (
              <div className="muted fs-80">Perte habituelle : 3 à 9 % les premiers jours, poids de naissance retrouvé en 2 à 3 semaines.</div>
            )}
          </>
        )}
      </div>

      <div className="fd-block">
        <div className="fd-h"><Icon name="droplet" size={15} /> Couches par jour</div>
        <div className="fd-table">
          <div className="fd-row head"><span>Jour</span><span>Mouillées</span><span>Selles</span></div>
          {diapers.map((d) => {
            const low = breastfed && !d.today && d.wet < d.target;
            return (
              <div key={d.day} className={`fd-row ${d.today ? 'today' : ''}`}>
                <span>J{d.day}{d.today ? ' (auj.)' : ''}</span>
                <span className={low ? 'low' : ''}>{d.wet}{breastfed ? <em> / {d.target}{d.day >= 6 ? '+' : ''}</em> : null}</span>
                <span>{d.stool}</span>
              </div>
            );
          })}
        </div>
        {breastfed && (
          <div className="muted fs-78 mt-8">
            Repère bébé allaité : 1 couche mouillée le 1er jour, une de plus chaque jour, puis au moins 6 par jour après le 5e jour ; 3 à 10 selles par jour les premières semaines. En dessous, ou si bébé paraît somnolent et tète peu : appelle la sage-femme.
          </div>
        )}
      </div>
    </div>
  );
}
