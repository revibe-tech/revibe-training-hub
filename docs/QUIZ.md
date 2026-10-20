# Quizzes

A quiz is a library material (kind `quiz`) with topics people take one at a
time. It replaces the temporary warranty hub's quiz and keeps its rules:

- Multiple choice (options shuffled for everyone) and sliders (exact value only).
- Any topic can be retaken; the **latest try per topic counts**.
- Once every topic has a try, the overall score is correct answers over all
  questions, and the **pass mark** (80% for warranty) decides pass or not.
- After each topic: the score, what to review (your answer, the correct one,
  why, links to the deck or video to revisit, screenshots), and what you got right.
- Passing marks the quiz complete in the library and My learning.

Trainers open the same card to see **Results**: everyone whose library shows
the quiz, with Passed / Not passed / In progress / Not started, the latest score
per topic, tries and last try. Download CSV, or import past results.

## How it works

| Piece | File |
|---|---|
| Tables, import function, lockdown | `supabase/migrations/20261022_quizzes.sql` |
| Grading, checks, overall score | `lib/quiz/bank.js` |
| Take a quiz / save questions | `app/api/quiz/route.js` |
| Results and imports (trainer) | `app/api/quiz/results/route.js` |
| UI | `components/QuizViewer.js`, `components/QuizResults.js` |
| Bundle import (`type: "quiz"`) | `lib/imports.js` |

- **Answers stay on the server.** Questions and answers live in Supabase
  (`quizzes`), never in git or the library's Firestore docs. Browsers get a
  topic's questions without answers, and `/api/quiz` grades on submit. The
  correct answers only come back in the review of someone's own submitted topic.
- **Who may take it** is the quiz material's audiences, checked by reading the
  material from Firestore with the person's own token, so `firestore.rules` decide.
- Tries are saved with the uid and email from the verified Firebase token.
- RLS is on with no policies and the import function is revoked from
  `anon`/`authenticated`, as for the assistant and activity tables.
- The chat assistant is hidden on quiz pages.

## Setup (one time)

1. **Supabase → SQL Editor:** run `supabase/migrations/20261022_quizzes.sql`.
2. Import the quiz from a training bundle (Library → ⋯ → Import training bundle).
   Its screenshots go to the `materials` storage bucket, its questions to Supabase,
   and its card to the library.

## Bringing over past results

From the old warranty hub: open its `/admin`, enter the admin password,
**Download CSV**. Then open the quiz → **Results** → **Import past results**
and pick that file. People are matched by email; each finished topic counts as
their latest try until they retake it here. Importing again replaces the
previous import and keeps tries taken in the hub.

## Editing questions

The bank format is the old hub's `data/questions.json` plus `learnLinks`
(review names → material ids). See the comments in `lib/quiz/bank.js` and
`lib/imports.js`. Re-saving a bank (`PUT /api/quiz`) replaces the questions;
tries keep their answers and are re-graded against the current questions in
each person's review.
