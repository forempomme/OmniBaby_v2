import React, { useEffect, useMemo, useState } from 'react';
import { useStore, getActiveChild, genId, authorFields } from '../store.jsx';
import { useToast, scheduleNotif, cancelNotif, requestNotifPermission } from '../utils.jsx';
import { Icon } from '../icons.jsx';
import {
  LIEUX, SOON_H, FRIGO_H, CONGEL_MOIS, DECONGELE_H,
  potExpiry, potStatus, stockSummary, sortPots, moveTo, biberonFromPot, expiryText, pumpedText,
} from '../lait.js';

// ----------------------------------------------------------------------
// Notification : pot du frigo (ou décongelé) à utiliser dans les 6 h
// ----------------------------------------------------------------------
export function scheduleLaitNotif(pot, enabled = true) {
  const id = `lait_${pot.id}`;
  cancelNotif(id);
  if (!enabled || (pot.lieu !== 'frigo' && pot.lieu !== 'decongele')) return;
  const exp = potExpiry(pot);
  if (!exp) return;
  const at = new Date(exp.getTime() - SOON_H * 3600000);
  if (at.getTime() <= Date.now()) return;
  requestNotifPermission().then((granted) => {
    if (!granted) return;
    scheduleNotif({
      id,
      title: 'OmniBaby — Stock de lait',
      body: `${pot.quantite} ml ${pot.lieu === 'decongele' ? 'décongelé' : 'au frigo'} à utiliser avant ${String(exp.getHours()).padStart(2, '0')}:${String(exp.getMinutes()).padStart(2, '0')}`,
      at: at.toISOString(),
    });
  });
}

export default function StockLaitTool() {
  const { store, update, firebaseUser, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';
  const notifOn = store.settings?.notifs?.lait !== false;
  const [open, setOpen] = useState(null); // pot dont les actions sont affichées
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const pots = useMemo(
    () => sortPots((store.lait || []).filter((p) => p.childId == null || p.childId === activeChild?.id)),
    [store.lait, activeChild?.id]
  );
  const sum = stockSummary(pots, now);

  const patchPot = (pot, fields, toast) => {
    let after = null;
    update((draft) => {
      const p = (draft.lait || []).find((x) => x.id === pot.id);
      if (p) { Object.assign(p, fields, authorFields(firebaseUser, 'updated')); after = { ...p }; }
      return draft;
    });
    if (after) scheduleLaitNotif(after, notifOn);
    setOpen(null);
    if (toast) showToast(toast, '✅');
  };

  const use = (pot) => {
    const entry = { id: genId(), childId: pot.childId || activeChild?.id, ...biberonFromPot(pot), ...authorFields(firebaseUser, 'created') };
    update((draft) => {
      draft.entries.push(entry);
      const p = (draft.lait || []).find((x) => x.id === pot.id);
      if (p) Object.assign(p, { lieu: 'utilise', usedAt: entry.date, usedEntryId: entry.id }, authorFields(firebaseUser, 'updated'));
      return draft;
    });
    cancelNotif(`lait_${pot.id}`);
    setOpen(null);
    showToast(`Biberon de ${entry.quantite} ml de lait maternel enregistré`, '✅', {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          update((draft) => {
            draft.entries = draft.entries.filter((e) => e.id !== entry.id);
            const p = (draft.lait || []).find((x) => x.id === pot.id);
            if (p) Object.assign(p, { lieu: pot.lieu, usedAt: null, usedEntryId: null });
            return draft;
          });
          scheduleLaitNotif(pot, notifOn);
        },
      },
    });
  };

  const newSession = () => {
    window.dispatchEvent(new CustomEvent('omnibaby-new-entry', { detail: { prefill: { type: 'tirelait' } } }));
  };

  if (!activeChild) {
    return <div className="empty-state"><div className="desc">Ajoute un profil enfant dans Réglages.</div></div>;
  }

  return (
    <div>
      <div className="lait-kpis">
        <div><b className="mono">{sum.frigo.ml} ml</b><span><Icon name="fridge" size={13} /> frigo · {sum.frigo.n} pot{sum.frigo.n > 1 ? 's' : ''}</span></div>
        <div><b className="mono">{sum.congel.ml} ml</b><span><Icon name="snow" size={13} /> congélateur · {sum.congel.n} sachet{sum.congel.n > 1 ? 's' : ''}</span></div>
      </div>

      {canEdit && (
        <button className="btn btn-secondary btn-block" onClick={newSession}><Icon name="pump" size={16} /> Nouveau tire-lait</button>
      )}

      {pots.length === 0 ? (
        <div className="empty-state">
          <div className="emoji"><Icon name="fridge" size={40} /></div>
          <div className="title">Stock vide</div>
          <div className="desc">Enregistre un tire-lait (bouton + du Journal → Tire-lait) et choisis « Frigo » ou « Congélateur ».</div>
        </div>
      ) : (
        <div className="mt-16">
          {pots.map((p) => {
            const st = potStatus(p, now);
            const lieu = LIEUX[p.lieu];
            const tone = st === 'expired' ? 'danger' : st === 'soon' ? 'sun' : p.lieu === 'congel' ? 'sky' : 'sky';
            return (
              <div key={p.id} className={`pot ${st}`}>
                <button className="pot-main" onClick={() => canEdit && setOpen(open === p.id ? null : p.id)}>
                  <span className={`ti tone-${tone}`}><Icon name={lieu.icon} size={18} /></span>
                  <span className="pot-body">
                    <b>{p.quantite} ml · {lieu.label.toLowerCase()}</b>
                    <span>{pumpedText(p, now)} · <span className={`pot-exp ${st}`}>{expiryText(p, now)}</span></span>
                  </span>
                  {canEdit && <Icon name={open === p.id ? 'chevronUp' : 'chevronDown'} size={18} />}
                </button>
                {open === p.id && (
                  <div className="pot-actions">
                    {st !== 'expired' && <button className="btn btn-primary btn-sm" onClick={() => use(p)}><Icon name="bottle" size={14} /> Utiliser → biberon</button>}
                    {p.lieu === 'frigo' && st !== 'expired' && <button className="btn btn-outline btn-sm" onClick={() => patchPot(p, moveTo('congel', new Date()), 'Pot congelé')}><Icon name="snow" size={14} /> Congeler</button>}
                    {p.lieu === 'congel' && st !== 'expired' && <button className="btn btn-outline btn-sm" onClick={() => patchPot(p, moveTo('decongele', new Date()), `Pot décongelé : à utiliser dans les ${DECONGELE_H} h`)}><Icon name="fridge" size={14} /> Décongeler</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => patchPot(p, { lieu: 'jete', jeteAt: new Date().toISOString() }, 'Pot retiré du stock')}><Icon name="trash" size={14} /> Jeter</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="note-muted mt-16">
        Durées utilisées : frigo +4 °C {FRIGO_H} h après le recueil, congélateur −18 °C {CONGEL_MOIS} mois, lait décongelé {DECONGELE_H} h au frigo, jamais recongelé (Direction générale de la santé ; AP-HP Necker). Indications générales : demande conseil à ta sage-femme ou au pédiatre en cas de doute.
      </div>
    </div>
  );
}
