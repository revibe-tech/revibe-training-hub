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
| Quiz | 4 topics, 21 questions | Not yet: the question bank lives in the old app's repo |
| Completion records | n/a | Not yet: in the old app's data store |

Everything lands in the **Warranty** category, visible to **Revibe agents**.

## Importing

1. Get the bundle file (`warranty-training-bundle.json`) from Youssf. It isn't in git.
2. Library → ⋯ → **Import training bundle** → paste it or open the file → **Review** → **Import 11 items**.
3. Running it again is safe: items already in the library are skipped.

The import runs in the trainer's browser. Each deck is fetched from Drive by
`/api/import/drive` (trainer only, Drive PDFs/PowerPoints up to 4 MB), then
goes through the same steps as an upload: slide text, cover, and the training
assistant's index. See `lib/imports.js` for the bundle format.

## Still to do

- Quiz and completion records: need read access to the old app's repository
  (fork it into `revibe-tech`), then build the quiz engine from its real schema.
