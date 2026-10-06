'use client';

// Trainer upload flow: a modal with a drop zone, display name + category
// fields, upload progress and a success toast. Also exports the small modal
// building blocks reused by ReuploadModal and the Library's "Edit details".
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { uploadMaterial, updateMaterialDetails, logMaterialUpdate } from '@/lib/materials';
import { audienceSummary, AUDIENCES, DEFAULT_AUDIENCES } from '@/lib/categories';
import {
  ACCEPT_ATTR,
  describeUploadError,
  displayNameFromFile,
  extractDeck,
  formatBytes,
  isPptxFile,
  validateDeckFile,
} from '@/lib/thumbnails';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui';
import '@/app/dashboard/dashboard.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* --------------------------------------------------------------------------
   ModalShell: portal + backdrop + Escape/focus handling on top of .modal
   -------------------------------------------------------------------------- */
export function ModalShell({ title, subtitle, icon, onClose, dismissible = true, footer, children, className = '' }) {
  const [shown, setShown] = useState(false);
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => setShown(true));
    const t = setTimeout(() => {
      const root = dialogRef.current;
      const target = root?.querySelector('[data-autofocus]') || root?.querySelector(FOCUSABLE);
      target?.focus();
    }, 40);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      // Let the shared confirm dialog handle its own keys when it's on top.
      if (document.querySelector('[role="alertdialog"]')) return;
      if (e.key === 'Escape') {
        if (dismissible) {
          e.preventDefault();
          onClose();
        }
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el.type === 'file');
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, onClose]);

  return createPortal(
    <div
      className={`modal-backdrop ${shown ? 'active' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div ref={dialogRef} className={`modal up-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header up-modal-header">
          <div className="up-modal-heading">
            {icon && (
              <span className="up-modal-icon" aria-hidden="true">
                <i className="material-icons">{icon}</i>
              </span>
            )}
            <div className="up-modal-titles">
              <h2 id={titleId} className="modal-title">{title}</h2>
              {subtitle && <p className="up-modal-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={!dismissible} aria-label="Close">
            <i className="material-icons">close</i>
          </button>
        </div>
        {children}
        {footer && <div className="modal-footer up-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------------------------------------------------
   DropArea: keyboard-accessible file picker with drag-and-drop
   -------------------------------------------------------------------------- */
export function DropArea({ onFile, disabled = false, icon = 'cloud_upload', title, hint }) {
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`up-drop ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
      onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <input
        id={inputId}
        type="file"
        className="sr-only"
        accept={ACCEPT_ATTR}
        disabled={disabled}
        data-autofocus
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
      <label htmlFor={inputId} className="up-drop-inner">
        <span className="up-drop-icon" aria-hidden="true">
          <i className="material-icons">{dragging ? 'file_download' : icon}</i>
        </span>
        <span className="up-drop-title">{dragging ? 'Drop it here' : title}</span>
        <span className="up-drop-text">
          Drag a PDF or PPTX here, or <span className="up-drop-link">browse files</span>
        </span>
        {hint && <span className="up-drop-hint">{hint}</span>}
      </label>
    </div>
  );
}

/** File summary row: icon, name, size and an optional "Change" action. */
export function FileRow({ file, meta, onChange, disabled }) {
  const pptx = isPptxFile(file);
  return (
    <div className="up-file">
      <span className={`up-file-icon ${pptx ? 'is-pptx' : ''}`} aria-hidden="true">
        <i className="material-icons">{pptx ? 'co_present' : 'picture_as_pdf'}</i>
      </span>
      <div className="up-file-meta">
        <span className="up-file-name" title={file.name}>{file.name}</span>
        <span className="up-file-sub">
          {pptx ? 'PowerPoint' : 'PDF'} · {formatBytes(file.size)}
          {meta ? ` · ${meta}` : ''}
        </span>
      </div>
      {onChange && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onChange} disabled={disabled}>
          Change
        </button>
      )}
    </div>
  );
}

export function UploadProgress({ phase, progress, verb = 'Uploading' }) {
  const extracting = phase === 'extract';
  const pct = extracting ? 0 : progress;
  return (
    <div className="up-progress" aria-live="polite">
      <div className="up-progress-head">
        <span className="up-progress-label">
          <Spinner size="sm" />
          {extracting ? 'Reading slides and building the preview…' : `${verb}…`}
        </span>
        {!extracting && <span className="up-progress-pct">{pct}%</span>}
      </div>
      <div
        className={`up-progress-track ${extracting ? 'is-indeterminate' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={extracting ? undefined : pct}
        aria-label={extracting ? 'Preparing file' : `${verb} ${pct}%`}
      >
        <div className="up-progress-fill" style={extracting ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function FormAlert({ children }) {
  if (!children) return null;
  return (
    <div className="up-alert" role="alert">
      <i className="material-icons" aria-hidden="true">error_outline</i>
      <span>{children}</span>
    </div>
  );
}

/* --------------------------------------------------------------------------
   CategoryField: pick an existing category or create a new one
   -------------------------------------------------------------------------- */
const NEW_CATEGORY = '__new__';

export function CategoryField({ id, value, onChange, categories = [], disabled }) {
  const options = [...new Set(['General', ...categories.filter(Boolean)])];
  const [creating, setCreating] = useState(!!value && !options.includes(value));
  const inputRef = useRef(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  if (creating) {
    return (
      <div className="up-category-new">
        <input
          ref={inputRef}
          id={id}
          className="input"
          value={value}
          maxLength={40}
          placeholder="e.g. Customer care"
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setCreating(false);
            onChange(options[0]);
          }}
          disabled={disabled}
        >
          Pick existing
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      className="select"
      value={options.includes(value) ? value : options[0]}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value === NEW_CATEGORY) {
          setCreating(true);
          onChange('');
        } else {
          onChange(e.target.value);
        }
      }}
    >
      {options.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
      <option value={NEW_CATEGORY}>+ New category…</option>
    </select>
  );
}

/**
 * Who can see a material: any mix of Revibe agents, Sellers and Repair
 * partners. Trainers always see everything.
 */
export function AudiencePicker({ value = [], onChange, disabled }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <>
      <div className="audience-picker" role="group" aria-label="Who can see this">
        {AUDIENCES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip cat-chip ${value.includes(p.id) ? 'active' : ''}`}
            aria-pressed={value.includes(p.id)}
            disabled={disabled}
            onClick={() => toggle(p.id)}
          >
            <i className="material-icons" aria-hidden="true">{p.icon}</i>{p.label}
          </button>
        ))}
      </div>
      <p className={`field-hint ${value.length ? '' : 'is-warning'}`}>
        {value.length ? `Visible to ${audienceSummary(value)}. Management and trainers see everything.` : 'Pick at least one group.'}
      </p>
    </>
  );
}

/* --------------------------------------------------------------------------
   Upload material modal (default export)
   -------------------------------------------------------------------------- */
export default function UploadZone({ initialFile = null, categories = [], categoryAudiences = {}, defaultCategory = 'General', onClose, onUploadComplete }) {
  const { user } = useAuth();
  const initialError = initialFile ? validateDeckFile(initialFile) : null;
  const [file, setFile] = useState(initialFile && !initialError ? initialFile : null);
  const [name, setName] = useState(initialFile && !initialError ? displayNameFromFile(initialFile.name) : '');
  const [category, setCategory] = useState(defaultCategory || 'General');
  const [audiences, setAudiences] = useState(categoryAudiences[defaultCategory || 'General'] || DEFAULT_AUDIENCES);
  // Picking a category pre-fills its default visibility; it can still be changed below.
  const changeCategory = (next) => {
    setCategory(next);
    if (categoryAudiences[next.trim()]) setAudiences(categoryAudiences[next.trim()]);
  };
  const [error, setError] = useState(initialError || '');
  const [phase, setPhase] = useState('idle'); // idle | extract | upload
  const [progress, setProgress] = useState(0);
  const [nameTouched, setNameTouched] = useState(false);
  const nameId = useId();
  const categoryId = useId();
  const busy = phase !== 'idle';

  const pickFile = (f) => {
    const problem = validateDeckFile(f);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    if (!nameTouched || !name.trim()) setName(displayNameFromFile(f.name));
    setFile(f);
  };

  const handleClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || busy) return;
    if (audiences.length === 0) {
      setError('Pick at least one group who can see this.');
      return;
    }
    const finalName = name.trim() || displayNameFromFile(file.name);
    const finalCategory = category.trim() || 'General';

    setError('');
    setPhase('extract');
    try {
      const { pageCount, textContent, thumbnailURL } = await extractDeck(file, { title: finalName, category: finalCategory });

      setPhase('upload');
      setProgress(0);
      const result = await uploadMaterial(
        file,
        { category: finalCategory, audiences, pageCount, thumbnailURL, uploadedBy: user?.email || 'unknown', textContent },
        (p) => setProgress(Math.round(p)),
      );

      let material = result;
      if (finalName !== result.name) {
        try {
          await updateMaterialDetails(result.id, { name: finalName });
          material = { ...result, name: finalName };
        } catch (renameErr) {
          console.warn('Uploaded, but could not apply the display name:', renameErr);
        }
      }

      // Notify all users that a new material was added (one-off banner next login).
      try {
        await logMaterialUpdate(material.id, material.name, user?.displayName || user?.email || 'A trainer', 'added', audiences);
      } catch (notifyErr) {
        console.warn('Could not log material-added notification:', notifyErr);
      }

      toast.success(`“${material.name}” is now in the library`);
      onUploadComplete?.(material);
      onClose();
    } catch (err) {
      console.error('Upload failed:', err);
      setError(describeUploadError(err, 'Upload'));
      setPhase('idle');
      setProgress(0);
    }
  };

  return (
    <ModalShell
      title="Upload material"
      subtitle="PDF or PowerPoint, up to 50 MB. Trainees are notified when it goes live."
      icon="cloud_upload"
      onClose={handleClose}
      dismissible={!busy}
      className="up-modal-upload"
    >
      <form onSubmit={handleSubmit} className="up-form" noValidate>
        {!file ? (
          <>
            <DropArea onFile={pickFile} title="Choose a deck to upload" />
            <p className="up-tip">
              <i className="material-icons" aria-hidden="true">lightbulb</i>
              <span>
                Using Google Slides? Export via <strong>File → Download → PDF document</strong> for the sharpest
                preview and slide-by-slide progress tracking.
              </span>
            </p>
          </>
        ) : (
          <>
            <FileRow file={file} onChange={() => { setFile(null); setError(''); }} disabled={busy} />

            <fieldset className="up-fields" disabled={busy}>
              <div className="up-field">
                <label className="field-label" htmlFor={nameId}>Display name</label>
                <input
                  id={nameId}
                  className="input"
                  value={name}
                  maxLength={120}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameTouched(true);
                  }}
                  placeholder="e.g. Grading phones: the basics"
                  data-autofocus
                />
                <p className="field-hint">This is what trainees see on the card.</p>
              </div>
              <div className="up-field">
                <label className="field-label" htmlFor={categoryId}>Category</label>
                <CategoryField id={categoryId} value={category} onChange={changeCategory} categories={categories} disabled={busy} />
              </div>
              <div className="up-field">
                <span className="field-label">Who can see this</span>
                <AudiencePicker value={audiences} onChange={setAudiences} disabled={busy} />
              </div>
            </fieldset>

            {busy && <UploadProgress phase={phase} progress={progress} />}
          </>
        )}

        <FormAlert>{error}</FormAlert>

        <div className="modal-footer up-modal-footer">
          <button type="button" className="btn btn-outline" onClick={handleClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-gradient" disabled={!file || busy}>
            {busy ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">upload</i>}
            {busy ? 'Uploading' : 'Upload'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
