'use client';

import { useId, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { audienceSummary } from '@/lib/categories';
import { importBundle, parseBundle } from '@/lib/imports';
import { FormAlert, ModalShell, UploadProgress } from '@/components/UploadZone';
import './ImportBundleModal.css';

/** Trainer tool: paste a training bundle (see lib/imports.js), review it, import it. */
export default function ImportBundleModal({ existingIds, onClose, onImported }) {
  const { user } = useAuth();
  const inputId = useId();
  const fileRef = useRef(null);
  const [json, setJson] = useState('');
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null); // { done, total, item } while importing
  const [result, setResult] = useState(null);
  const running = !!progress && !result;
  const newItems = bundle ? bundle.items.filter((item) => !existingIds.has(item.id)) : [];

  const review = () => {
    try {
      setBundle(parseBundle(json));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const openFile = async (file) => {
    if (!file) return;
    setJson(await file.text());
    setBundle(null);
    setError('');
  };

  const run = async () => {
    setError('');
    setProgress({ done: 0, total: bundle.items.length, item: null });
    try {
      const outcome = await importBundle(bundle, {
        existingIds,
        uploadedBy: user?.email || 'unknown',
        onProgress: setProgress,
      });
      setResult(outcome);
      if (outcome.added.length) onImported?.();
    } catch (err) {
      setProgress(null);
      setError(`Couldn’t start the import: ${err.message}`);
    }
  };

  let body;
  if (result) {
    body = (
      <>
        <div className="ib-result" role="status">
          <span className="ib-stat"><strong>{result.added.length}</strong> added</span>
          {result.skipped.length > 0 && <span className="ib-stat"><strong>{result.skipped.length}</strong> already in the library</span>}
          {result.failed.length > 0 && <span className="ib-stat is-bad"><strong>{result.failed.length}</strong> failed</span>}
        </div>
        {result.failed.length > 0 && (
          <ul className="ib-failures">
            {result.failed.map((f) => <li key={f.name}><strong>{f.name}</strong>: {f.error}</li>)}
          </ul>
        )}
        {result.failed.length > 0 && <p className="field-hint">Import the same bundle again to retry the failed items.</p>}
        <div className="modal-footer up-modal-footer">
          <button type="button" className="btn btn-gradient" onClick={onClose} data-autofocus>Done</button>
        </div>
      </>
    );
  } else if (bundle) {
    const pct = running && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    body = (
      <>
        <p className="ib-summary">
          <strong>{bundle.title}</strong> goes into <strong>{bundle.category}</strong>, visible to {audienceSummary(bundle.audiences)}.
        </p>
        <ul className="ib-items">
          {bundle.items.map((item) => {
            const existing = existingIds.has(item.id);
            return (
              <li key={item.id} className={existing ? 'is-existing' : ''}>
                <i className="material-icons" aria-hidden="true">{item.type === 'video' ? 'smart_display' : 'description'}</i>
                <span className="ib-item-name">{item.name}</span>
                <span className="ib-item-state">{existing ? 'In library' : item.type === 'video' ? 'Video' : 'Deck'}</span>
              </li>
            );
          })}
        </ul>
        {running && <UploadProgress phase="upload" progress={pct} verb={progress.item ? `Adding ${progress.item.name}` : 'Finishing'} />}
        <FormAlert>{error}</FormAlert>
        <div className="modal-footer up-modal-footer">
          <button type="button" className="btn btn-outline" onClick={() => setBundle(null)} disabled={running}>Back</button>
          <button type="button" className="btn btn-gradient" onClick={run} disabled={running || newItems.length === 0} data-autofocus>
            {newItems.length === 0 ? 'Everything is already in the library' : `Import ${newItems.length} item${newItems.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="up-field">
          <label className="field-label" htmlFor={inputId}>Bundle</label>
          <textarea
            id={inputId}
            className="textarea ib-json"
            rows={10}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={'{ "title": "…", "category": "…", "audiences": ["revibe"], "items": [ … ] }'}
            spellCheck={false}
            data-autofocus
          />
          <p className="field-hint">
            Paste the bundle, or{' '}
            <button type="button" className="ib-link" onClick={() => fileRef.current?.click()}>open a .json file</button>.
            Its Drive files must be shared with “Anyone with the link”.
          </p>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => openFile(e.target.files?.[0])} />
        </div>
        <FormAlert>{error}</FormAlert>
        <div className="modal-footer up-modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-gradient" onClick={review} disabled={!json.trim()}>Review</button>
        </div>
      </>
    );
  }

  return (
    <ModalShell
      title="Import training bundle"
      subtitle="Add a set of decks and videos from Google Drive in one go."
      icon="library_add"
      onClose={onClose}
      dismissible={!running}
    >
      <div className="up-form">{body}</div>
    </ModalShell>
  );
}
