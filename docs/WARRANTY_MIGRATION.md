# Warranty training migration

Moving the temporary warranty hub (built by Azaan in October 2026 for the new
warranty claims system) into this hub. Agents had to watch 7 videos, read 4
guides and pass a quiz at 80%.

> This repo is public. Keep Drive links, file IDs and the bundle itself out of
> it: the warranty files are shared with "Anyone with the link".

## What moves over

| Item | Count | How |
|---|---|---|
| Guides (PDF) | 4 (39 slides) | Training bundle import: downloaded from Drive, then the normal upload pipeline |
| Videos | 7 | Training bundle import: video materials that play from Drive, with each video's steps from the Quick Steps guide |
| Quiz | 4 topics, 21 questions | Training bundle import: a quiz material, questions and answers stored server-side ([QUIZ.md](QUIZ.md)) |
| Quiz results | everyone who took it | The old hub's results CSV → quiz → Results → Import past results |

Everything lands in the **Warranty** category, visible to **Revibe agents**.

## Importing

1. Run `supabase/migrations/20261022_quizzes.sql` in Supabase once.
2. Get the bundle file from Youssf (guides, videos and the quiz, with its answers, so it isn't in git).
3. Signed in as a trainer: Library → ⋯ → **Import training bundle** → open the file → **Review** → **Import 12 items**.
4. Running it again is safe: items already in the library are skipped.
5. Past results: in the old hub's `/admin`, **Download CSV**. Open the quiz → **Results** → **Import past results**.

The import runs in the trainer's browser. Each deck is fetched from Drive by
`/api/import/drive` (trainer only, Drive PDFs/PowerPoints up to 4 MB), then
goes through the same steps as an upload: slide text, cover, and the training
assistant's index. See `lib/imports.js` for the bundle format.

The old hub's Learn ticks (which guides and videos someone marked done) don't
come over: the library tracks that itself as people open each material.
