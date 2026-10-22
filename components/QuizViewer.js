'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getQuiz, getTopicQuestions, submitTopic } from '@/lib/quiz';
import { isMaterialCompleted, markMaterialCompleted } from '@/lib/progress';
import { logActivity } from '@/lib/activity';
import { EmptyState, Skeleton, Spinner, useConfirm } from '@/components/ui';
import { useBadgeCelebration } from './BadgeCelebration';
import ViewerTopBar from './ViewerTopBar';
import QuizResults from './QuizResults';
import './QuizViewer.css';

const SECONDS_PER_QUESTION = 30;

/** A quiz material: topics to take (graded on the server) and, for trainers, everyone's results. */
export default function QuizViewer({ materialId, title, category, audiences, isTrainer }) {
  const [tab, setTab] = useState(isTrainer ? 'results' : 'take');
  return (
    <div className="vw vw-quiz">
      <ViewerTopBar title={title} category={category} kind="Quiz">
        {isTrainer && (
          <div className="segmented qz-tabs" role="group" aria-label="View">
            <button type="button" className={tab === 'results' ? 'active' : ''} aria-pressed={tab === 'results'} onClick={() => setTab('results')}>Results</button>
            <button type="button" className={tab === 'take' ? 'active' : ''} aria-pressed={tab === 'take'} onClick={() => setTab('take')}>Take quiz</button>
          </div>
        )}
      </ViewerTopBar>
      <div className="vw-body">
        <div className="qz-scroll">
          {tab === 'results'
            ? <QuizResults quizId={materialId} audiences={audiences} />
            : <TakeQuiz quizId={materialId} title={title} isTrainer={isTrainer} />}
        </div>
      </div>
    </div>
  );
}

function TakeQuiz({ quizId, title, isTrainer }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { checkForBadges } = useBadgeCelebration();
  const [quiz, setQuiz] = useState(null); // { title, passMark, topics, results, overall }
  const [loadError, setLoadError] = useState(null);
  const [mode, setMode] = useState({ kind: 'overview' }); // | { kind: 'run', run } | { kind: 'result', topic }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getQuiz(quizId)
      .then((data) => { if (active) setQuiz(data); })
      .catch((err) => { if (active) setLoadError(err); });
    return () => { active = false; };
  }, [quizId]);

  // Passing (here, or in results imported from the old hub) completes the material in the library.
  const uid = user?.uid;
  const passed = !!quiz?.overall?.passed;
  useEffect(() => {
    if (!uid || !passed) return;
    isMaterialCompleted(uid, quizId)
      .then((done) => (done ? null : markMaterialCompleted(uid, quizId, 1, title || 'Quiz').then(() => checkForBadges(uid))))
      .catch((err) => console.warn('Could not mark the quiz complete:', err));
  }, [uid, passed, quizId, title, checkForBadges]);

  const start = useCallback(async (topic) => {
    setError('');
    setBusy(true);
    try {
      const { questions, startedAt } = await getTopicQuestions(quizId, topic.id);
      setMode({ kind: 'run', run: { topic, questions, startedAt, index: 0, answers: {} } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [quizId]);

  const submit = async (run) => {
    setError('');
    setBusy(true);
    try {
      const out = await submitTopic({ id: quizId, topic: run.topic.id, answers: run.answers, startedAt: run.startedAt });
      const wasPassed = quiz.overall.passed;
      setQuiz((q) => ({ ...q, results: out.results, overall: out.overall }));
      setMode({ kind: 'result', topic: run.topic.id });
      logActivity('quiz', { detail: { topic: run.topic.id, percent: out.result.percent } });
      if (out.overall.passed && !wasPassed) toast.success(`Quiz passed with ${out.overall.percent}%. Well done!`, { duration: 6000 });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <QuizUnavailable error={loadError} isTrainer={isTrainer} />;
  if (!quiz) {
    return (
      <div className="qz" aria-busy="true" aria-label="Loading the quiz">
        <Skeleton height={150} radius={20} />
        <div className="qz-topics">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={230} radius={20} />)}</div>
      </div>
    );
  }

  if (mode.kind === 'run') {
    return (
      <Runner
        run={mode.run}
        busy={busy}
        error={error}
        onChange={(run) => setMode({ kind: 'run', run })}
        onSubmit={submit}
        onLeave={async () => {
          const answered = Object.keys(mode.run.answers).length > 0;
          if (answered && !(await confirm({ title: 'Leave this topic?', body: 'Your answers so far won’t be saved.', confirmLabel: 'Leave', tone: 'danger' }))) return;
          setMode({ kind: 'overview' });
        }}
      />
    );
  }

  const index = mode.kind === 'result' ? quiz.topics.findIndex((t) => t.id === mode.topic) : -1;
  if (index !== -1 && quiz.results[mode.topic]) {
    const next = [...quiz.topics.slice(index + 1), ...quiz.topics.slice(0, index)].find((t) => !quiz.results[t.id]);
    return (
      <TopicResult
        topic={quiz.topics[index]}
        index={index}
        result={quiz.results[mode.topic]}
        passMark={quiz.passMark}
        next={next}
        busy={busy}
        onNext={start}
        onRetake={() => start(quiz.topics[index])}
        onBack={() => setMode({ kind: 'overview' })}
      />
    );
  }

  const { overall } = quiz;
  const tone = overall.complete ? (overall.passed ? 'good' : 'bad') : 'brand';
  return (
    <div className="qz">
      <section className="qz-card qz-score" aria-labelledby="qz-score-title">
        <div>
          <p id="qz-score-title" className="qz-eyebrow">Your score</p>
          <p className="qz-score-value">{overall.correct}<span> / {overall.total}</span></p>
        </div>
        <div className="qz-score-main">
          <div className="qz-score-line">
            <span className={`qz-pill is-${tone}`}>
              {overall.complete
                ? overall.passed ? `Passed · ${overall.percent}%` : `Not passed yet · ${overall.percent}%`
                : `${overall.done} of ${overall.topics} topics done`}
            </span>
            <span className="qz-muted">Pass mark {quiz.passMark}% · your latest try at each topic counts</span>
          </div>
          <Bar value={overall.done} total={overall.topics} tone={tone} label="Topics done" />
          {overall.complete && !overall.passed && <p className="qz-muted">Retake the topics with the lowest scores. Each one shows what to review.</p>}
        </div>
      </section>

      {error && <p className="qz-error" role="alert">{error}</p>}

      <div className="qz-topics">
        {quiz.topics.map((t, i) => (
          <TopicCard
            key={t.id}
            topic={t}
            index={i}
            result={quiz.results[t.id]}
            passMark={quiz.passMark}
            busy={busy}
            onStart={() => start(t)}
            onReview={() => setMode({ kind: 'result', topic: t.id })}
          />
        ))}
      </div>
    </div>
  );
}

function QuizUnavailable({ error, isTrainer }) {
  const text = {
    503: isTrainer ? 'Run the quiz SQL migration in Supabase first (docs/QUIZ.md).' : 'The quiz isn’t set up yet. Check back soon.',
    404: isTrainer ? 'Import the quiz’s questions from a training bundle.' : 'The quiz isn’t ready yet. Check back soon.',
    403: 'This quiz isn’t open to your team.',
  }[error.status] || error.message;
  return (
    <div className="qz">
      <EmptyState icon="quiz" title="The quiz can’t open" text={text} />
    </div>
  );
}

function Bar({ value, total, tone = 'brand', label }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`qz-bar is-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

const shortDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function TopicCard({ topic, index, result, passMark, busy, onStart, onReview }) {
  const tone = result ? (result.percent >= passMark ? 'good' : 'bad') : 'brand';
  const minutes = Math.max(1, Math.round((topic.count * SECONDS_PER_QUESTION) / 60));
  return (
    <article className="qz-card qz-topic">
      <div className="qz-topic-head">
        <div>
          <p className="qz-eyebrow">Topic {index + 1}</p>
          <h3 className="qz-topic-title">{topic.title}</h3>
          <p className="qz-muted">{topic.count} questions · about {minutes} min</p>
        </div>
        {result ? (
          <div className={`qz-topic-score is-${tone}`}>
            <strong>{result.correct}/{result.total}</strong>
            <span>{result.percent}%</span>
          </div>
        ) : (
          <span className="qz-pill">Not started</span>
        )}
      </div>
      {topic.learn && <p className="qz-topic-learn"><b>Learn from:</b> {topic.learn}</p>}
      {result && <Bar value={result.correct} total={result.total} tone={tone} label={`${topic.title} score`} />}
      {result && (
        <p className="qz-muted qz-small">
          {result.imported ? 'From the old warranty hub' : `Taken ${result.tries} ${result.tries === 1 ? 'time' : 'times'}`} · last on {shortDate(result.submittedAt)}
        </p>
      )}
      <div className="qz-actions">
        <button type="button" className={result ? 'btn btn-outline' : 'btn btn-gradient'} onClick={onStart} disabled={busy}>
          {result ? 'Retake' : 'Start topic'}
        </button>
        {result?.items?.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={onReview}>Review answers</button>
        )}
      </div>
    </article>
  );
}

function Runner({ run, busy, error, onChange, onSubmit, onLeave }) {
  const q = run.questions[run.index];
  const isLast = run.index === run.questions.length - 1;
  const answered = run.answers[q.id] !== undefined;
  const setAnswer = (v) => onChange({ ...run, answers: { ...run.answers, [q.id]: v } });
  const go = (index) => onChange({ ...run, index });

  return (
    <div className="qz qz-run">
      <div className="qz-run-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLeave}>
          <i className="material-icons" aria-hidden="true">arrow_back</i> All topics
        </button>
        <p className="qz-muted"><b className="qz-brand">{run.topic.title}</b> · Question {run.index + 1} of {run.questions.length}</p>
      </div>
      <div className="qz-steps" aria-hidden="true">
        {run.questions.map((x, i) => (
          <span key={x.id} className={i < run.index ? 'is-done' : i === run.index ? 'is-current' : run.answers[x.id] !== undefined ? 'is-answered' : ''} />
        ))}
      </div>
      <section className="qz-card qz-question" aria-labelledby={`qz-q-${q.id}`}>
        <h2 id={`qz-q-${q.id}`} className="qz-prompt">{q.prompt}</h2>
        {q.image && <Screenshot img={q.image} />}
        {q.type === 'mcq'
          ? <Options key={q.id} labelledBy={`qz-q-${q.id}`} options={q.options} value={run.answers[q.id]} onChange={setAnswer} />
          : <Slider key={q.id} question={q} value={run.answers[q.id]} onChange={setAnswer} />}
        {error && <p className="qz-error" role="alert">{error}</p>}
        <div className="qz-run-foot">
          <button type="button" className="btn btn-outline" disabled={run.index === 0 || busy} onClick={() => go(run.index - 1)}>Back</button>
          {isLast ? (
            <button type="button" className="btn btn-gradient qz-grow" disabled={!answered || busy} onClick={() => onSubmit(run)}>
              {busy ? <><Spinner size="sm" white /> Checking…</> : 'Finish topic'}
            </button>
          ) : (
            <button type="button" className="btn btn-gradient qz-grow" disabled={!answered} onClick={() => go(run.index + 1)}>Next</button>
          )}
        </div>
      </section>
    </div>
  );
}

function Options({ options, value, onChange, labelledBy }) {
  const pick = (i) => onChange(options[(i + options.length) % options.length]);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="qz-options">
      {options.map((option, i) => {
        const selected = value === option;
        const tabbable = selected || (value === undefined && i === 0);
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            className={`qz-option${selected ? ' is-selected' : ''}`}
            onClick={() => onChange(option)}
            onKeyDown={(e) => {
              const move = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
              if (!move) return;
              e.preventDefault();
              pick(i + move);
              e.currentTarget.parentElement.children[(i + move + options.length) % options.length]?.focus();
            }}
          >
            <span className="qz-option-key" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}

function Slider({ question, value, onChange }) {
  const { min, max, step, unit } = question.slider;
  // The thumb starts mid-way but only counts once it's moved, so the start is never a free answer.
  const middle = min + Math.round((max - min) / 2 / step) * step;
  const current = value ?? middle;
  const clamp = (v) => Math.min(max, Math.max(min, v));
  return (
    <div className="qz-slider">
      <p className="qz-slider-value" aria-live="polite">
        {value === undefined ? <span>Move the slider</span> : `${value.toLocaleString('en-GB')} ${unit}`}
      </p>
      <div className="qz-slider-row">
        <button type="button" className="qz-step" onClick={() => onChange(clamp(current - step))} aria-label={`Minus ${step}`}>−</button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => value === undefined && onChange(current)}
          aria-label={`${question.prompt} (${unit})`}
        />
        <button type="button" className="qz-step" onClick={() => onChange(clamp(current + step))} aria-label={`Plus ${step}`}>+</button>
      </div>
      <div className="qz-slider-ends"><span>{min.toLocaleString('en-GB')}</span><span>{max.toLocaleString('en-GB')}</span></div>
    </div>
  );
}

function Screenshot({ img }) {
  return (
    <figure className="qz-shot">
      <a href={img.src} target="_blank" rel="noopener noreferrer" title="Open full size">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={img.alt} loading="lazy" />
      </a>
      {img.alt && <figcaption>{img.alt}</figcaption>}
    </figure>
  );
}

function LearnLinks({ links }) {
  if (!links?.length) return null;
  return (
    <p className="qz-learn">
      Review:{' '}
      {links.map((l, i) => (
        <span key={l.label}>
          {i > 0 && ' · '}
          {l.materialId ? <Link href={`/viewer?id=${encodeURIComponent(l.materialId)}`}>{l.label}</Link> : <b>{l.label}</b>}
        </span>
      ))}
    </p>
  );
}

function TopicResult({ topic, index, result, passMark, next, busy, onNext, onRetake, onBack }) {
  const good = result.percent >= passMark;
  const wrong = result.items.filter((i) => !i.correct);
  const right = result.items.filter((i) => i.correct);
  return (
    <div className="qz">
      <div className="qz-run-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <i className="material-icons" aria-hidden="true">arrow_back</i> All topics
        </button>
      </div>
      <section className="qz-card qz-score" aria-labelledby="qz-result-title">
        <div>
          <p className="qz-eyebrow">Topic {index + 1}</p>
          <h2 id="qz-result-title" className="qz-topic-title">{topic.title}</h2>
        </div>
        <div className="qz-result-mid">
          <p className={`qz-score-value is-${good ? 'good' : 'bad'}`}>{result.correct}/{result.total}</p>
          <div>
            <span className={`qz-pill is-${good ? 'good' : 'bad'}`}>{good ? 'Well done' : 'Worth another look'}</span>
            <p className="qz-muted">{result.percent}% on this topic</p>
          </div>
        </div>
        <div className="qz-actions">
          {next
            ? <button type="button" className="btn btn-gradient" disabled={busy} onClick={() => onNext(next)}>Next: {next.title}</button>
            : <button type="button" className="btn btn-gradient" onClick={onBack}>See your score</button>}
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onRetake}>Retake</button>
        </div>
      </section>

      {wrong.length > 0 && (
        <section aria-labelledby="qz-wrong">
          <h3 id="qz-wrong" className="qz-h">To review ({wrong.length})</h3>
          <div className="qz-review">
            {wrong.map((item) => (
              <article key={item.id} className={`qz-card qz-item${item.image ? ' has-shot' : ''}`}>
                <div>
                  <p className="qz-item-prompt"><i className="material-icons is-bad" aria-hidden="true">close</i>{item.prompt}</p>
                  <p className="qz-answer is-bad"><b>Your answer:</b> {item.yourAnswer}</p>
                  <p className="qz-answer is-good"><b>Correct:</b> {item.correctAnswer}</p>
                  <p className="qz-why">{item.why}</p>
                  <LearnLinks links={item.learn} />
                </div>
                {item.image && <Screenshot img={item.image} />}
              </article>
            ))}
          </div>
        </section>
      )}

      {right.length > 0 && (
        <section aria-labelledby="qz-right">
          <h3 id="qz-right" className="qz-h">Got right ({right.length})</h3>
          <div className="qz-right">
            {right.map((item) => (
              <article key={item.id} className="qz-card qz-item">
                <p className="qz-item-prompt"><i className="material-icons is-good" aria-hidden="true">check</i>{item.prompt}</p>
                <p className="qz-answer-plain">{item.correctAnswer}</p>
                <p className="qz-why">{item.why}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
