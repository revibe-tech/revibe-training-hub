'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { checkAssistant, hasAssistantText, indexMaterialsForAssistant } from '@/lib/assistant';
import { ModalShell } from '@/components/UploadZone';
import { Spinner } from '@/components/ui';
import './AssistantCheck.css';

/**
 * Trainer modal: tries each part of the training assistant for real (settings,
 * database, Gemini, search) and shows what's broken and how to fix it, plus
 * which library materials it can't search yet, with a button to index them.
 */
export default function AssistantCheck({ materials, onClose }) {
  const [result, setResult] = useState(null); // { checks, indexed } | { error }
  const [running, setRunning] = useState(true);
  const [indexing, setIndexing] = useState(null); // { done, total }

  const run = useCallback(() => {
    setRunning(true);
    checkAssistant()
      .then((r) => setResult(r))
      .catch((err) => setResult({ error: err.message }))
      .finally(() => setRunning(false));
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, [run]);

  const readable = materials.filter(hasAssistantText);
  const unreadable = materials.length - readable.length;
  const missing = result?.indexed ? readable.filter((m) => !result.indexed.includes(m.id)) : [];
  const servicesOk = !!result?.checks?.length && result.checks.every((c) => c.ok);

  const indexMissing = async () => {
    setIndexing({ done: 0, total: missing.length });
    try {
      const { failed } = await indexMaterialsForAssistant(missing, (done, total) => setIndexing({ done, total }));
      if (failed) toast.error(`${failed} material${failed === 1 ? '' : 's'} couldn’t be indexed. Check again to see why.`);
      else toast.success(`The assistant can now search ${missing.length} more material${missing.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err.message, { duration: 10000 });
    }
    setIndexing(null);
    run();
  };

  const busy = running || !!indexing;
  return (
    <ModalShell
      title="Check the assistant"
      subtitle="Tries each part of the training assistant for real and shows what to fix."
      icon="health_and_safety"
      onClose={onClose}
      dismissible={!indexing}
      className="ac-modal"
    >
      {running && !result ? (
        <div className="ac-loading"><Spinner /> <span>Checking Gemini, Supabase and the index…</span></div>
      ) : result?.error ? (
        <p className="ac-error" role="alert">{result.error}</p>
      ) : (
        <ul className="ac-list" aria-busy={running}>
          {result.checks.map((c) => <CheckRow key={c.id} ok={c.ok} label={c.label} detail={c.detail} fix={c.fix} />)}
          {servicesOk && (
            <CheckRow
              ok={readable.length > 0 && missing.length === 0}
              label="Your materials"
              detail={[
                readable.length
                  ? `${readable.length - missing.length} of ${readable.length} material${readable.length === 1 ? '' : 's'} with readable text ${readable.length === 1 ? 'is' : 'are'} searchable.`
                  : 'No material has readable text yet.',
                missing.length ? ` Not yet: ${missing.slice(0, 4).map((m) => `“${m.name}”`).join(', ')}${missing.length > 4 ? '…' : ''}.` : '',
                unreadable ? ` ${unreadable} ha${unreadable === 1 ? 's' : 've'} no readable text (scanned or image-only), so re-upload ${unreadable === 1 ? 'it' : 'them'} as a text PDF.` : '',
              ].join('')}
              fix={missing.length ? 'Index them now, below.' : ''}
            />
          )}
        </ul>
      )}

      <div className="modal-footer up-modal-footer">
        {servicesOk && missing.length > 0 && (
          <button type="button" className="btn btn-dark" onClick={indexMissing} disabled={busy}>
            {indexing ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">manage_search</i>}
            {indexing ? `Indexing ${indexing.done}/${indexing.total}…` : `Index ${missing.length} now`}
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={run} disabled={busy}>
          {running && result ? <Spinner size="sm" /> : <i className="material-icons" aria-hidden="true">refresh</i>}
          Check again
        </button>
      </div>
    </ModalShell>
  );
}

function CheckRow({ ok, label, detail, fix }) {
  return (
    <li className={`ac-row ${ok ? 'is-ok' : 'is-broken'}`}>
      <i className="material-icons ac-icon" aria-hidden="true">{ok ? 'check_circle' : 'error'}</i>
      <div className="ac-text">
        <span className="ac-label">{label}<span className="sr-only">{ok ? ': working' : ': broken'}</span></span>
        {detail && <span className="ac-detail">{detail}</span>}
        {!ok && fix && <span className="ac-fix"><b>Fix:</b> {fix}</span>}
      </div>
    </li>
  );
}
