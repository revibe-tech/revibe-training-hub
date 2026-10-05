'use client';

import { useState } from 'react';
import { saveCategory, deleteCategory, PARTNER_TYPES } from '@/lib/categories';
import { FormAlert, ModalShell } from '@/components/UploadZone';
import { Spinner, useConfirm } from '@/components/ui';

const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function AudienceChips({ value, onToggle, disabled }) {
  return PARTNER_TYPES.map((p) => (
    <button
      key={p.id}
      type="button"
      className={`chip cat-chip ${value.includes(p.id) ? 'active' : ''}`}
      aria-pressed={value.includes(p.id)}
      disabled={disabled}
      onClick={() => onToggle(p.id)}
      title={`Visible to ${p.label}`}
    >
      <i className="material-icons" aria-hidden="true">{p.icon}</i>
      {p.label}
    </button>
  ));
}

/**
 * Trainer modal: create categories and tag which partner groups can see them.
 * Revibe members always see every category.
 */
export default function CategoryManager({ categories, onClose, onChanged }) {
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');
  const [newAudiences, setNewAudiences] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await onChanged();
    } catch (err) {
      console.error('Category update failed:', err);
      setError(err.message || 'Something went wrong');
    }
    setBusy(null);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setError(`“${name}” already exists`);
      return;
    }
    run('new', async () => {
      await saveCategory(name, newAudiences);
      setNewName('');
      setNewAudiences([]);
    });
  };

  const handleDelete = async (cat) => {
    const ok = await confirm({
      title: `Delete “${cat.name}”?`,
      body: 'Only empty categories can be deleted. Move its materials first.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) run(cat.id, () => deleteCategory(cat.name));
  };

  return (
    <ModalShell
      title="Categories"
      subtitle="Revibe agents see everything. Toggling a partner here applies to every material in the category; fine-tune single materials in Edit details."
      icon="label"
      onClose={onClose}
      dismissible={!busy}
      className="cat-modal"
    >
      <ul className="cat-list">
        {categories.map((cat) => (
          <li key={cat.id} className="cat-row">
            <span className="cat-row-name">{cat.name}</span>
            <div className="cat-row-tags">
              <AudienceChips
                value={cat.audiences}
                disabled={!!busy}
                onToggle={(id) => run(cat.id, () => saveCategory(cat.name, toggle(cat.audiences, id)))}
              />
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm cat-row-delete"
                disabled={!!busy}
                onClick={() => handleDelete(cat)}
                aria-label={`Delete ${cat.name}`}
              >
                {busy === cat.id ? <Spinner size="sm" /> : <i className="material-icons">delete_outline</i>}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form className="cat-add" onSubmit={handleAdd}>
        <label className="field-label" htmlFor="cat-new-name">New category</label>
        <input
          id="cat-new-name"
          className="input"
          placeholder="e.g. Grading guide"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
          data-autofocus
        />
        <div className="cat-row-tags">
          <AudienceChips value={newAudiences} onToggle={(id) => setNewAudiences(toggle(newAudiences, id))} />
          <button type="submit" className="btn btn-dark btn-sm cat-add-btn" disabled={!newName.trim() || !!busy}>
            {busy === 'new' ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">add</i>}
            Add
          </button>
        </div>
      </form>

      <FormAlert>{error}</FormAlert>
    </ModalShell>
  );
}
