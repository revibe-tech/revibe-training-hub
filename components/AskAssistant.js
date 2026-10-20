'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { askAssistant, getAssistantStatus } from '@/lib/assistant';
import { logActivity } from '@/lib/activity';
import './AskAssistant.css';

// Preview mode has no AI keys; show the assistant anyway so its UI can be checked.
const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === '1';
const MAX_CHARS = 1000;
const DECK_SUGGESTIONS = [
  'Summarise this deck in a few bullet points',
  'What are the rules to remember?',
  'Walk me through the steps, in order',
];
// Full-screen tools where a floating button would cover the controls.
const HIDDEN_ON = ['/editor'];

const AssistantContext = createContext({ ready: false });
export const useAssistant = () => useContext(AssistantContext);

/* The material on screen, so the chat can offer "This deck". A tiny store
   rather than context, so the viewer can set it without re-rendering the app. */
let pageScope = null; // { materialId, materialName }
const scopeListeners = new Set();
const subscribeScope = (listener) => {
  scopeListeners.add(listener);
  return () => scopeListeners.delete(listener);
};
const getScope = () => pageScope;
const getServerScope = () => null;
function setPageScope(next) {
  pageScope = next;
  scopeListeners.forEach((listener) => listener());
}

/** Lets the chat answer about the material on this page. Call from the viewer. */
export function useAssistantScope(materialId, materialName) {
  useEffect(() => {
    if (!materialId) return undefined;
    const scope = { materialId, materialName: materialName || 'This material' };
    setPageScope(scope);
    return () => {
      if (pageScope === scope) setPageScope(null);
    };
  }, [materialId, materialName]);
}

/**
 * The chat button (bottom right) and its window, once for the whole app, so
 * the conversation survives navigation (e.g. opening a source slide). Mount
 * inside AuthProvider.
 */
export function AssistantProvider({ children }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [ready, setReady] = useState(PREVIEW);
  const [open, setOpen] = useState(false);
  const scope = useSyncExternalStore(subscribeScope, getScope, getServerScope);
  const [deckOnly, setDeckOnly] = useState(true);
  const [messages, setMessages] = useState([]); // { id, role: 'user'|'assistant', content, found?, sources? }
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const launcherRef = useRef(null);

  // A newly opened deck defaults to "This deck", unless a conversation is under way.
  const [scopeId, setScopeId] = useState(null);
  if ((scope?.materialId || null) !== scopeId) {
    setScopeId(scope?.materialId || null);
    setDeckOnly(messages.length === 0);
  }

  useEffect(() => {
    if (!user || PREVIEW) return undefined;
    let cancelled = false;
    getAssistantStatus()
      .then((status) => { if (!cancelled) setReady(!!status.ready); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  const ask = useCallback(async (text) => {
    const question = text.trim().slice(0, MAX_CHARS);
    if (!question || pending) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    const materialId = scope && deckOnly ? scope.materialId : null;
    const id = Date.now();
    setMessages((list) => [...list, { id, role: 'user', content: question }]);
    setDraft('');
    setError('');
    setPending(true);
    try {
      const reply = await askAssistant({ question, history, materialId });
      setMessages((list) => [...list, { id: id + 1, role: 'assistant', content: reply.answer, found: reply.found, sources: reply.sources || [] }]);
      logActivity('ask', { materialId, detail: { found: !!reply.found } });
    } catch (err) {
      // Put the question back so it can be sent again in one tap.
      setMessages((list) => list.filter((m) => m.id !== id));
      setDraft(question);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }, [messages, pending, scope, deckOnly]);

  const reset = () => {
    setMessages([]);
    setDraft('');
    setError('');
  };

  const value = useMemo(() => ({ ready: ready && !!user }), [ready, user]);
  const visible = ready && !!user && !HIDDEN_ON.some((path) => pathname?.startsWith(path));

  return (
    <AssistantContext.Provider value={value}>
      {children}
      {visible && open && (
        <AskWindow
          scope={scope}
          deckOnly={deckOnly}
          onDeckOnly={setDeckOnly}
          messages={messages}
          draft={draft}
          onDraft={setDraft}
          pending={pending}
          error={error}
          onAsk={ask}
          onReset={reset}
          onClose={close}
        />
      )}
      {visible && (
        <button
          ref={launcherRef}
          type="button"
          className={`ask-fab${open ? ' is-open' : ''}`}
          onClick={() => (open ? close() : setOpen(true))}
          aria-expanded={open}
          aria-label={open ? 'Close the training assistant' : 'Ask the training assistant'}
          title={open ? 'Close' : 'Ask the training assistant'}
        >
          <i className="material-icons" aria-hidden="true">{open ? 'close' : 'auto_awesome'}</i>
        </button>
      )}
    </AssistantContext.Provider>
  );
}

function AskWindow({ scope, deckOnly, onDeckOnly, messages, draft, onDraft, pending, error, onAsk, onReset, onClose }) {
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const deckScoped = !!scope && deckOnly;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, pending, error]);

  const send = (e) => {
    e?.preventDefault();
    onAsk(draft);
  };
  // On phones the chat covers the page, so get out of the way when a source opens.
  const onOpenSource = () => {
    if (window.matchMedia('(max-width: 640px)').matches) onClose();
  };

  return (
    <section
      className="ask-window"
      role="dialog"
      aria-labelledby="ask-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="ask-head">
        <span className="ask-head-icon" aria-hidden="true">
          <i className="material-icons">auto_awesome</i>
        </span>
        <div className="ask-head-text">
          <span className="eyebrow">Training assistant</span>
          <h2 id="ask-title" className="ask-title">{deckScoped ? scope.materialName : 'Ask about your training'}</h2>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => {
              onReset();
              inputRef.current?.focus(); // this button disappears with the messages
            }}
            aria-label="Start a new chat"
            title="New chat"
          >
            <i className="material-icons" aria-hidden="true">add_comment</i>
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-icon btn-sm ask-close" onClick={onClose} aria-label="Close the assistant" title="Close">
          <i className="material-icons" aria-hidden="true">close</i>
        </button>
      </header>

      {scope && (
        <div className="segmented ask-scope" role="group" aria-label="Search in">
          <button type="button" className={deckOnly ? 'active' : ''} aria-pressed={deckOnly} onClick={() => onDeckOnly(true)}>
            This deck
          </button>
          <button type="button" className={deckOnly ? '' : 'active'} aria-pressed={!deckOnly} onClick={() => onDeckOnly(false)}>
            All training
          </button>
        </div>
      )}

      <div className="ask-thread">
        {messages.length === 0 && <EmptyIntro deckScoped={deckScoped} onPick={onAsk} />}
        {messages.map((m) => (m.role === 'user'
          ? <div key={m.id} className="ask-msg ask-msg-user">{m.content}</div>
          : <Answer key={m.id} message={m} onOpenSource={onOpenSource} />))}
        {pending && (
          <div className="ask-msg ask-msg-bot ask-typing" role="status">
            <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
            <span className="sr-only">Searching your training…</span>
          </div>
        )}
        {error && (
          <p className="ask-error" role="alert">
            <i className="material-icons" aria-hidden="true">error_outline</i>
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form className="ask-composer" onSubmit={send}>
        <textarea
          ref={inputRef}
          id="ask-input"
          className="ask-input"
          rows={1}
          value={draft}
          maxLength={MAX_CHARS}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
          }}
          placeholder={deckScoped ? 'Ask about this deck…' : 'Ask about a process, policy or button…'}
          aria-label="Your question"
        />
        <button type="submit" className="btn btn-gradient btn-icon" disabled={pending || !draft.trim()} aria-label="Send question">
          <i className="material-icons" aria-hidden="true">arrow_upward</i>
        </button>
      </form>
      <p className="ask-note">Answers come from your training material. Check the linked slide before you act on one.</p>
    </section>
  );
}

function EmptyIntro({ deckScoped, onPick }) {
  if (deckScoped) {
    return (
      <div className="ask-empty">
        <p className="ask-empty-lead">Ask anything about this deck. Each answer links to the slide it came from.</p>
        <div className="ask-suggestions">
          {DECK_SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => onPick(s)}>{s}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="ask-empty">
      <p className="ask-empty-lead">Ask anything about your training. Each answer links to the slide it came from. Try asking about:</p>
      <ul className="ask-tips">
        <li>A process, step by step</li>
        <li>What a stage, field or button means</li>
        <li>A policy, amount or deadline</li>
      </ul>
    </div>
  );
}

function Answer({ message, onOpenSource }) {
  return (
    <div className={`ask-msg ask-msg-bot${message.found ? '' : ' is-miss'}`}>
      <AnswerText text={message.content} />
      {message.sources?.length > 0 && (
        <div className="ask-sources">
          <span className="ask-sources-label">Sources</span>
          <ul>
            {message.sources.map((s) => {
              const video = s.kind === 'video';
              return (
                <li key={`${s.materialId}:${s.page}`}>
                  <Link
                    href={`/viewer?id=${encodeURIComponent(s.materialId)}${video ? '' : `&page=${s.page}`}`}
                    className="ask-source"
                    onClick={onOpenSource}
                    title={video ? `${s.materialName} (video)` : `${s.materialName}, slide ${s.page}`}
                  >
                    <i className="material-icons" aria-hidden="true">{video ? 'play_circle' : 'slideshow'}</i>
                    <span className="ask-source-name">{s.materialName}</span>
                    <span className="ask-source-page">{video ? 'Video' : `Slide ${s.page}`}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// **bold** inside a line.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (
    part.length > 4 && part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  ));
}

/** The small markdown subset answers use (paragraphs, lists, bold), rendered as text nodes. */
function AnswerText({ text }) {
  const blocks = [];
  let list = null;
  // Excerpt numbers like [2] mean nothing to readers; the sources list covers them.
  for (const raw of String(text).replace(/\s?\[\d+(?:\s*,\s*\d+)*\]/g, '').split('\n')) {
    const line = raw.trim();
    const ordered = line.match(/^(\d+)[.)]\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (ordered || bullet) {
      const type = ordered ? 'ol' : 'ul';
      if (list?.type !== type) {
        list = { type, start: ordered ? Number(ordered[1]) : undefined, items: [] };
        blocks.push(list);
      }
      list.items.push(ordered ? ordered[2] : bullet[1]);
    } else {
      list = null;
      if (line) blocks.push({ type: 'p', text: line });
    }
  }
  return blocks.map((block, i) => (block.type === 'p'
    ? <p key={i}>{inline(block.text)}</p>
    : createElement(block.type, { key: i, start: block.start }, block.items.map((item, j) => <li key={j}>{inline(item)}</li>))));
}
