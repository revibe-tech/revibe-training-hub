'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PARTNER_TYPES, SELF_SERVE_TEAMS } from '@/lib/categories';
import { FormAlert, ModalShell } from '@/components/UploadZone';
import { Spinner } from '@/components/ui';

const PARTNER_DESCRIPTIONS = {
  seller: 'You sell devices on Revibe.',
  repair: 'You repair or refurbish devices for Revibe.',
};

/**
 * Shown once on sign-in until the person picks their role: partners choose
 * Seller / Repair partner, Revibe staff choose their team. The choice is
 * locked afterwards (a trainer can change it; Management is trainer-assigned).
 */
export default function RolePicker() {
  const { user, isPartner, partnerType, choosePartnerType, isRevibeMember, team, chooseTeam } = useAuth();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const needsPartnerType = isPartner && !partnerType;
  const needsTeam = isRevibeMember && !team;
  if (!user || (!needsPartnerType && !needsTeam)) return null;

  const options = needsPartnerType
    ? PARTNER_TYPES.map((p) => ({ id: p.id, icon: p.icon, label: p.short, desc: PARTNER_DESCRIPTIONS[p.id] }))
    : SELF_SERVE_TEAMS.map((t) => ({ id: t.id, icon: t.icon, label: t.label }));

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      await (needsPartnerType ? choosePartnerType(selected) : chooseTeam(selected));
    } catch (err) {
      console.error('Failed to save role:', err);
      setError('Could not save your choice. Please try again.');
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Welcome to Revibe Training 👋"
      subtitle={needsPartnerType
        ? 'Which of these describes you? We use it to show you the right training.'
        : 'Which team are you on? We use it to show you the right training.'}
      icon="waving_hand"
      onClose={() => {}}
      dismissible={false}
      className="partner-modal"
    >
      <div className="partner-options" role="radiogroup" aria-label={needsPartnerType ? 'Partner type' : 'Team'}>
        {options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected === o.id}
            className={`partner-option ${selected === o.id ? 'active' : ''}`}
            onClick={() => setSelected(o.id)}
            data-autofocus={i === 0 ? true : undefined}
          >
            <i className="material-icons" aria-hidden="true">{o.icon}</i>
            <span className="partner-option-label">{o.label}</span>
            {o.desc && <span className="partner-option-desc">{o.desc}</span>}
          </button>
        ))}
      </div>

      <p className="field-hint partner-hint">
        You can only choose once. If you need to change it later{needsTeam ? ' or need Management access' : ''}, ask a trainer.
      </p>
      <FormAlert>{error}</FormAlert>

      <div className="modal-footer up-modal-footer">
        <button type="button" className="btn btn-gradient partner-continue" disabled={!selected || saving} onClick={handleConfirm}>
          {saving ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">arrow_forward</i>}
          {saving ? 'Saving' : 'Continue'}
        </button>
      </div>
    </ModalShell>
  );
}
