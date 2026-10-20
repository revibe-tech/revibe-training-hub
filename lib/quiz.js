// Quizzes in the browser: questions arrive without answers and every topic is
// graded on the server (app/api/quiz). See docs/QUIZ.md.

import { callApi } from './api';

const q = (params) => new URLSearchParams(params).toString();

/** { title, passMark, topics, results, overall } for the signed-in person. */
export const getQuiz = (id) => callApi(`/api/quiz?${q({ id })}`, { method: 'GET' });

/** { questions, startedAt } for one topic, options shuffled. */
export const getTopicQuestions = (id, topic) => callApi(`/api/quiz?${q({ id, topic })}`, { method: 'GET' });

/** Grade and save one topic. Resolves to { result, overall, results }. */
export const submitTopic = ({ id, topic, answers, startedAt }) => callApi('/api/quiz', { body: { id, topic, answers, startedAt } });

/** Trainer only: add or replace a quiz's questions (lib/quiz/bank.js shape). */
export const saveQuizBank = (id, bank) => callApi('/api/quiz', { method: 'PUT', body: { id, bank } });

/** Trainer only: { title, passMark, topics, people } with everyone's latest scores. */
export const getQuizResults = (id) => callApi(`/api/quiz/results?${q({ id })}`, { method: 'GET' });

/** Trainer only: replace imported results with `people` (see parseResultsCsv). */
export const importQuizResults = (id, people) => callApi('/api/quiz/results', { body: { id, people } });

/** Rows of cells from CSV text (quoted cells, "" escapes, CRLF or LF). */
function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/**
 * Results exported from the old warranty hub's /admin (Download CSV): one row
 * per person with Name, Email, a "3 of 5" cell per topic (by topic title),
 * and Last active. Returns { people, skipped } ready for importQuizResults.
 */
export function parseResultsCsv(text, topics) {
  const [header, ...rows] = csvRows(text);
  if (!header) throw new Error('That file is empty.');
  const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const emailCol = col('Email');
  if (emailCol === -1) throw new Error('No “Email” column. Use the CSV from the old hub’s results page.');
  const nameCol = col('Name');
  const lastCol = col('Last active');
  const topicCols = topics.map((t) => ({ id: t.id, index: col(t.title) }));
  const missing = topicCols.filter((t) => t.index === -1).map((t) => topics.find((x) => x.id === t.id).title);
  if (missing.length) throw new Error(`No column for ${missing.map((m) => `“${m}”`).join(', ')}. The topic titles must match the quiz.`);

  const people = [];
  let skipped = 0;
  for (const cells of rows) {
    const email = (cells[emailCol] || '').trim().toLowerCase();
    const scores = {};
    for (const { id, index } of topicCols) {
      const m = (cells[index] || '').match(/^\s*(\d+)\s*of\s*(\d+)\s*$/i);
      if (m) scores[id] = { correct: Number(m[1]), total: Number(m[2]) };
    }
    if (!email.includes('@') || Object.keys(scores).length === 0) {
      skipped += 1; // signed in or read the guides, but no quiz topic finished
      continue;
    }
    people.push({ email, name: nameCol === -1 ? '' : (cells[nameCol] || '').trim(), lastActive: lastCol === -1 ? null : cells[lastCol] || null, topics: scores });
  }
  return { people, skipped };
}

/** Status of a person's results: 'passed' | 'failed' | 'in-progress' | 'not-started'. */
export const STATUS_LABEL = {
  passed: 'Passed',
  failed: 'Not passed',
  'in-progress': 'In progress',
  'not-started': 'Not started',
};
