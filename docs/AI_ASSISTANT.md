# Training assistant (RAG)

Anyone signed in can ask a question and get an answer drawn only from the
training material **they're allowed to open**, with links to the exact slides.
Open it from the ✨ chat button in the bottom-right corner. Inside a deck or
video it answers about that material, or switch to **All training**.

## How it works

```mermaid
flowchart LR
  subgraph Index["Trainer uploads or replaces a deck"]
    A[Slide text, extracted at upload] --> B[One chunk per slide] --> C[Gemini embeddings] --> D[(Supabase pgvector: rag_chunks)]
  end
  subgraph Ask["Someone asks a question"]
    Q[Question] --> V{Firebase ID token verified}
    V --> M[Materials they can open: Firestore, their own rules]
    V --> E[Embed question]
    M --> S[Hybrid search: vector + keyword, fused]
    E --> S
    S --> G[Gemini answers from those excerpts only]
    G --> R[Answer + slide links]
  end
  D -.-> S
```

| Piece | File |
|---|---|
| Schema, hybrid search, lockdown | `supabase/migrations/20261020_ai_assistant.sql` |
| Ask / index API (index status: `GET /api/rag/index`) | `app/api/ask/route.js`, `app/api/rag/index/route.js` |
| Who-sees-what (shared with the browser) | `lib/audience.js` |
| Token check + allowed materials | `lib/server/viewer.js`, `lib/server/firestore.js` |
| Gemini calls | `lib/server/ai.js` |
| Chunking, prompt | `lib/rag/chunk.js`, `lib/rag/prompt.js` |
| Greetings, thanks, bye | `lib/rag/smalltalk.js` |
| UI (chat button + window) | `components/AskAssistant.js` |

Keyword search runs next to vector search because this material is full of
exact labels (`Customer wants AWB?`, `Cancel override`, `W - Invalid claim`)
that embeddings alone match poorly.

Replies come in three kinds:

- **Small talk** ("hi", "thanks", "bye", in English or Arabic) is answered at
  once, without Gemini, naming a few materials the person can ask about.
- **Chat** (e.g. "what can you do?") and **answers** come from Gemini, which
  sees the names of the person's materials and the matching excerpts. Only
  answers carry slide links.
- **Not covered**: a real question the excerpts don't answer. The reply points
  to the closest topics they do have, and the question is logged as a gap.

## Access control

- **Retrieval is filtered, not the model.** On every question the server lists
  the materials the asker can open by querying Firestore *with their own ID
  token*, so `firestore.rules` decide, then searches only those. A seller can't
  reach Revibe-agent material, prompt injection included: the model only ever
  sees excerpts the person could already open in the library.
- Chunks store no audience, so changing a category's audiences takes effect
  immediately, with no re-index.
- Supabase: RLS on with no policies, and the functions are revoked from
  `anon`/`authenticated`, so the public anon key can't read or search chunks.
  Only the server's service-role key can.
- `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` live in `lib/server/*`,
  which imports `server-only`, so a client import fails the build.

## Setup (one time)

1. **Supabase → SQL Editor:** run `supabase/migrations/20261020_ai_assistant.sql`.
2. **Environment variables** (Vercel → Settings → Environment Variables, and `.env.local`). Never prefix them with `NEXT_PUBLIC_`.

   | Variable | Where to get it |
   |---|---|
   | `GEMINI_API_KEY` | Google AI Studio → API keys |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API keys (secret key) |
   | `GEMINI_CHAT_MODEL` *(optional)* | Defaults to the rolling `gemini-flash-latest` alias. Set a fixed model ID to freeze behaviour. |

3. Redeploy, then open the **Library** as a trainer. It indexes every material
   the assistant can't search yet (uploaded before it existed, or whose sync
   failed) in the background. New uploads, re-uploads and deletes keep the index in
   sync on their own. **Library → ⋯ → Rebuild assistant index** re-reads everything.

Until steps 1–2 are done the chat button stays hidden (`GET /api/ask` returns `{ ready: false }`).
If every answer says it can't read any training material yet, the index is empty: open the Library as a trainer.

## When it isn't working

**Library → ⋯ → Check the assistant** (trainers) tries each part for real
(`GET /api/rag/check`) and shows what's broken and how to fix it:

| Row | What it tests | Usual fix |
|---|---|---|
| Settings | `GEMINI_API_KEY` and the Supabase service key are set | Add them in Vercel, redeploy |
| Database | `rag_chunks` / `rag_queries` and the search function exist | Run the migration above |
| Reading the material | An embedding call (`gemini-embedding-001`) | Key, quota, or `GEMINI_EMBED_MODEL` |
| Answering | Each chat model on its own: main and backup | Key, quota, or `GEMINI_CHAT_MODEL` |
| Search | A real search over the indexed passages | Rebuild the index |
| Your materials | Which library materials aren't searchable yet | **Index N now** |

In the chat, trainers see the reason and the fix with any error; everyone else
gets a plain "try again" message.

Built in so short outages don't break it:

- Gemini calls time out after 20s and retry rate limits and 5xx errors twice
  (waiting what Gemini asks, up to 8s); a longer quota wait fails fast with a clear message.
- If the main chat model is out of quota, gone or garbled, `gemini-flash-lite-latest` answers instead.
- Library indexing stops on a key, quota or setup error and says so, instead of failing every material.

Slide text: PDF.js returns letter-spaced titles as single letters ("Q U E U E").
Extraction (`pageText` in `lib/rag/chunk.js`) joins them back, and indexing cleans
text stored before that. When that cleaning changes, bump `ASSISTANT_INDEX_VERSION`
in `app/dashboard/page.js`: each trainer's next Library visit re-reads every material once.

## Finding gaps in the training material

Every question is logged to `rag_queries`. Questions it couldn't answer are
the material's gaps:

```sql
select question, count(*) as times, max(created_at) as last_asked
from rag_queries
where not answered and created_at > now() - interval '30 days'
group by question
order by times desc
limit 50;
```

## Limits and next steps

- Each person can ask 30 questions per 10 minutes (counted from `rag_queries`;
  `LIMIT_QUESTIONS` in `app/api/ask/route.js`), so a loop can't run up the AI
  bill. Trainers aren't limited.
- Text comes from the upload-time extraction: the first 50 pages per file
  (`TEXT_PAGE_LIMIT` in `lib/thumbnails.js`). Text inside screenshots isn't read.
- A video is searchable through its description (e.g. the steps it walks
  through), not its audio. Add a transcript to the description to cover more.
- Exact vector search is fine to roughly 50k chunks. Past that, add the HNSW
  index described in the migration.
- Another provider means changing `embedTexts` and `generateJson` in
  `lib/server/ai.js`. A different embedding size also means changing
  `vector(768)` in the migration and rebuilding the index.
