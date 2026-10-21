export const meta = {
  name: 'analyze-training',
  description: 'Turn prepared training videos and PDFs into a checked, cited reference (per item, per topic, quiz plan)',
  whenToUse: 'After tools/training-analysis/prepare.py has built evidence packs. Pass the contents of <work>/workflow-args.json as args.',
  phases: [
    { title: 'Analyze', detail: 'one agent per evidence pack: follow the trainer, extract cited facts' },
    { title: 'Verify', detail: 'adversarial check of every claim against frames and transcript, plus a coverage sweep' },
    { title: 'Write', detail: 'one reference page per video or PDF, from checked claims only' },
    { title: 'Critique', detail: 'independent review of each page against its sources, then evidence-checked fixes' },
    { title: 'Topics', detail: 'one page per topic: process, seller vs KAM version, quiz blueprint' },
    { title: 'Reference', detail: 'index, glossary, gaps and conflicts, quiz plan' },
    { title: 'Audit', detail: 'two auditors trace claims in the summaries back to the sources' },
  ],
}

// args: { workDir, outDir, items: [{ id, title, kind, audience, flags, duration, pages, packs: [path] }] }
const { workDir, outDir } = args
const items = args.items.filter((it) => it.role !== 'notes' && it.packs.length)
const notes = args.items.filter((it) => it.role === 'notes').flatMap((it) => it.packs)

const mmss = (s) => (s == null ? '?' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const topicTitle = (t) => t.replace(/\s*\([^)]*\)\s*/g, ' ').split(' - ')[0].trim()
const page = (it) => `${outDir}/items/${it.id}.md`
const json = (o) => JSON.stringify(o, null, 1)

// ---------- schemas ----------
const EVIDENCE = {
  type: 'object',
  properties: {
    kind: { enum: ['say', 'see', 'page'] },
    at: { type: 'string', description: 'mm:ss in the video, or the PDF page number' },
    frame: { type: 'string', description: 'frame or page image file name (t00192.jpg, p003.png); empty for say' },
    quote: { type: 'string', description: 'say: words copied exactly from the transcript. see/page: exactly what is visible' },
  },
  required: ['kind', 'at', 'quote'],
}
const CITED = { type: 'array', items: EVIDENCE, minItems: 1 }
const PART_PROPS = {
  summary: { type: 'string' },
  steps: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        at: { type: 'string' }, screen: { type: 'string' }, action: { type: 'string' },
        says: { type: 'string', description: 'short exact quote, or empty' },
        why: { type: 'string', description: 'only if the trainer gives the reason; else empty' },
        evidence: CITED,
      },
      required: ['at', 'screen', 'action', 'evidence'],
    },
  },
  facts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { enum: ['rule', 'policy', 'procedure', 'number', 'definition', 'warning', 'tip', 'example', 'screen'] },
        statement: { type: 'string' },
        evidence: CITED,
        confidence: { enum: ['high', 'medium', 'low'] },
        quiz: { type: 'boolean' },
      },
      required: ['type', 'statement', 'evidence', 'confidence', 'quiz'],
    },
  },
  screens: {
    type: 'array',
    items: { type: 'object', properties: { name: { type: 'string' }, where: { type: 'string' }, shows: { type: 'string' }, at: { type: 'string' }, frame: { type: 'string' } }, required: ['name', 'shows', 'at'] },
  },
  terms: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, meaning: { type: 'string' }, at: { type: 'string' } }, required: ['term', 'meaning', 'at'] } },
  asr_fixes: { type: 'array', items: { type: 'object', properties: { at: { type: 'string' }, heard: { type: 'string' }, correct: { type: 'string' }, basis: { type: 'string' } }, required: ['at', 'heard', 'correct', 'basis'] } },
  unclear: { type: 'array', items: { type: 'object', properties: { at: { type: 'string' }, issue: { type: 'string' } }, required: ['at', 'issue'] } },
  outdated: { type: 'array', items: { type: 'object', properties: { at: { type: 'string' }, signal: { type: 'string' } }, required: ['at', 'signal'] } },
  privacy: { type: 'array', items: { type: 'object', properties: { at: { type: 'string' }, frame: { type: 'string' }, what: { type: 'string' } }, required: ['at', 'what'] } },
  frames_opened: { type: 'integer' },
}
const PART_REQ = ['summary', 'steps', 'facts', 'screens', 'terms', 'asr_fixes', 'unclear', 'outdated', 'privacy', 'frames_opened']
const PART = { type: 'object', properties: PART_PROPS, required: PART_REQ }
const CHECKED = {
  type: 'object',
  properties: {
    ...PART_PROPS,
    audit: {
      type: 'object',
      properties: {
        checked: { type: 'integer' },
        removed: { type: 'array', items: { type: 'object', properties: { statement: { type: 'string' }, reason: { type: 'string' } }, required: ['statement', 'reason'] } },
        corrected: { type: 'array', items: { type: 'object', properties: { before: { type: 'string' }, after: { type: 'string' }, reason: { type: 'string' } }, required: ['before', 'after', 'reason'] } },
        added: { type: 'array', items: { type: 'string' } },
      },
      required: ['checked', 'removed', 'corrected', 'added'],
    },
  },
  required: [...PART_REQ, 'audit'],
}
const ISSUES = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { enum: ['high', 'medium', 'low'] },
          kind: { enum: ['unsupported', 'wrong', 'missing', 'order', 'misheard', 'other'] },
          where: { type: 'string' }, problem: { type: 'string' },
          evidence: { type: 'string', description: 'exact transcript quote with time, or frame/page and what it shows' },
          fix: { type: 'string' },
        },
        required: ['severity', 'kind', 'where', 'problem', 'evidence', 'fix'],
      },
    },
    minutes_checked: { type: 'integer' },
  },
  required: ['issues', 'minutes_checked'],
}
const AUDIT = {
  type: 'object',
  properties: { checked: { type: 'integer' }, wrong: { type: 'integer' }, fixed: { type: 'integer' }, notes: { type: 'string' } },
  required: ['checked', 'wrong', 'fixed', 'notes'],
}

// ---------- prompts ----------
const CONTEXT = 'Revibe sells refurbished devices from third-party sellers; KAMs (key account managers) look after those sellers. Everything else must come from the evidence.'

const EVIDENCE_RULES = `Evidence rules (these matter more than coverage):
- Every step and fact cites evidence: kind "say" with words copied exactly from a transcript line (keep any {word?} marks), kind "see" with the frame file name and exactly what is visible on it, or kind "page" for a PDF page.
- Most videos are narrated by Pierre, a French speaker. Speech recognition mishears his accent, especially names, numbers and product terms. Where the screen shows the right spelling or value, use the screen and add an asr_fixes entry. Where audio and screen disagree and you can't tell which is right, add an unclear entry instead of stating the fact.
- Words marked {word?} and lines marked ⚠ are unreliable on their own. Rely on them only when the screen or the surrounding speech confirms them.
- Don't fill gaps from general knowledge of e-commerce, logistics or Revibe. If something is only implied, leave it out or set confidence "low" and start the statement with "Implied:".
- Copy numbers, dates, currencies, IDs and names exactly. Never round, convert or complete them.
- Put anything that looks out of date (past deadlines, "this will change", TBU) in outdated, and real customer or seller personal data visible on screen (names, phone numbers, emails, addresses) in privacy: this material may later be shown to sellers.`

function analyzePrompt(it, pack, i) {
  const what = it.kind === 'pdf' ? 'PDF' : 'video'
  return `You are building a training reference from part ${i + 1} of ${it.packs.length} of the Revibe training ${what} "${it.id} ${it.title}" (audience: ${it.audience || 'not labelled'}${it.flags.length ? `; flagged ${it.flags.join(', ')}` : ''}). ${CONTEXT}

Evidence pack: ${pack}

1. Read the pack. Then open EVERY ${it.kind === 'pdf' ? 'PAGE' : 'FRAME'} image it lists with the Read tool, in order. Don't skip any: screens carry numbers, column names, statuses and rules the narration doesn't say. Report how many you opened in frames_opened.
2. Follow the trainer. ${it.kind === 'pdf' ? 'Walk through the document in order: each section or step it shows, as steps.' : 'Rebuild what they do on screen, step by step: which app, page or tab, what they click, filter, type or point at, what they say while doing it, and why (only when they say why).'}
3. Extract every fact a KAM needs: rules, policies, procedures, numbers (prices, days, percentages, deadlines), definitions, warnings, tips, and screen details (columns, statuses, buttons). One fact per item, specific and self-contained, so it makes sense without the video.
4. List the screens and tools shown, terms the material defines or relies on, and the problems the evidence rules ask for.

${EVIDENCE_RULES}

Set quiz: true on facts a new KAM must know to do the job: decisions, rules, numbers, where to check what. Facts about what to DO in a situation are the most valuable.`
}

function verifyPrompt(it, pack, i, draft) {
  return `You are the adversarial checker for part ${i + 1} of ${it.packs.length} of "${it.id} ${it.title}". Another agent extracted the claims below from the evidence pack ${pack}. Treat every claim as wrong until the evidence shows it.

1. Read the pack. For every step and fact, open the cited ${it.kind === 'pdf' ? 'page' : 'frame'} images with the Read tool and find the cited transcript lines. Keep a claim only if the evidence says or shows it. Fix wording that overstates, generalises or mixes up the evidence (record it in audit.corrected). Remove claims the evidence doesn't support (record them in audit.removed with the reason). Check every number, date, ID, name and currency character by character.
2. Check the screens, terms, asr_fixes, unclear, outdated and privacy lists the same way.
3. Coverage sweep: read the whole pack again and open every image no claim cites. Add missed steps and facts with evidence, and list them in audit.added.
4. Set audit.checked to the number of claims you checked.

${EVIDENCE_RULES}

Return the final checked object, and also write it as JSON to ${outDir}/data/${it.id}/part-${i + 1}.json with the Write tool.

Claims to check:
${json(draft)}`
}

function writePrompt(it, parts) {
  return `Write the reference page for "${it.id} ${it.title}" to ${page(it)}. Use ONLY the checked material below (${parts.length} part(s), in order). Don't add facts, examples or explanations that aren't in it, and keep every citation. Read ${workDir}/items/${it.id}/meta.json for the details table.

Citations look like [03:12] for something said, [03:15 t00195] for something on screen, [p3] for a PDF page. Write plainly; the readers are a team lead and new KAMs.

# ${it.id} ${it.title}

A details table: Audience | ${it.kind === 'pdf' ? 'Pages' : 'Length'} | Source file | ${it.kind === 'pdf' ? 'Pages read' : 'Frames read'} | ${it.kind === 'pdf' ? '' : 'Speech recognition (engine, low-confidence words) | '}Flags

## Summary
3 to 6 sentences: what this teaches and who it's for.

## Follow the trainer
A table: Time | Screen | What they do | What they say. One row per step, in order.

## What a KAM needs to know
Facts grouped under: Rules and policies; Procedures; Numbers and deadlines; Definitions; Warnings and tips; Screens and fields. Each bullet is the statement then its citations. Start quiz-worthy facts with ★. Mark low-confidence facts "(unconfirmed)".

## Screens and tools shown
A table: Screen | Where | What it shows | First seen

## Terms
A table: Term | Meaning as used here | Where

## Quiz material
The ★ facts as a numbered list with citations. Then up to 8 scenario seeds: "Situation → what a KAM should do", each built only from cited facts, with the citations. These are seeds for a person to turn into questions, not finished questions.

## Problems found
Speech recognition fixes; Unclear passages; Possibly out of date; Personal data on screen. Write "None found" under any that are empty.

## Checking log
Claims checked, removed, corrected and added (sum the audits), then each removed claim with its reason.

Checked material:
${json(parts)}`
}

function criticPrompt(it) {
  return `Critique the reference page ${page(it)} for "${it.id} ${it.title}" against its sources. Assume it has mistakes.
Sources: ${it.kind === 'pdf' ? 'the evidence packs' : `the transcript ${workDir}/items/${it.id}/transcript.md and the evidence packs`} ${it.packs.join(', ')} (with the ${it.kind === 'pdf' ? 'page' : 'frame'} images they list).

Look for:
1. statements the sources don't support, or that overstate them;
2. wrong numbers, dates, IDs, names or currencies;
3. important content the page misses: go through the ${it.kind === 'pdf' ? 'document page by page' : 'transcript minute by minute'} and check each ${it.kind === 'pdf' ? 'page' : 'minute'} is reflected;
4. steps out of order;
5. quiz seeds that rely on facts the page doesn't cite;
6. misheard words treated as fact (the narrator is French; speech recognition errs on names, numbers and terms).
Open images whenever a claim depends on what's on screen. Report only issues you can point to in the sources, with the exact evidence. Don't report style or formatting. Set minutes_checked to the number of ${it.kind === 'pdf' ? 'pages' : 'minutes'} you went through.`
}

function fixPrompt(it, issues) {
  return `Apply these review findings to ${page(it)} ("${it.id} ${it.title}"). The reviewer can be wrong too: for each finding, check its evidence yourself in ${it.kind === 'pdf' ? '' : `${workDir}/items/${it.id}/transcript.md, `}the evidence packs (${it.packs.join(', ')}) and the images they list. Apply it only if the evidence holds; otherwise skip it. Keep the page's structure and citations.
Then add a "### Review" subsection at the end of "Checking log" listing each finding as applied or skipped, with a one-line reason.

Findings:
${json(issues)}`
}

function topicPrompt(major, title, group) {
  const pages = group.map((it) => `${page(it)} (${it.audience || 'no audience label'})`).join('\n- ')
  return `Write ${outDir}/topics/${major}-${slug(title)}.md for topic ${major}, "${title}", from these reference pages:
- ${pages}

Use only what the pages say. Keep citations, prefixed with the item id, e.g. (${group[0].id} [03:12]).

# ${major}. ${title}
## What this topic covers
## How it works
One consolidated walkthrough of the process across the pages, in order.
## Seller version vs KAM version
What the KAM material adds or does differently. Write "Only one version" if the topic has a single audience.
## Rules, numbers and deadlines
A table: Rule or number | Source.
## Contradictions
Between the pages, or with anything flagged out of date. "None found" if none.
## Quiz blueprint
For each page: suggested number of questions (about one per minute of video, at most 20 per video; for a PDF one per key rule), the areas to cover, which areas suit multiple-answer questions, and the 3 best scenario seeds with citations.`
}

// ---------- run ----------
const topics = []
for (const it of items) {
  const major = it.id.split('.')[0]
  let t = topics.find((x) => x.major === major)
  if (!t) topics.push((t = { major, title: topicTitle(it.title), items: [] }))
  t.items.push(it)
}
log(`${items.length} items in ${topics.length} topics, ${items.reduce((n, it) => n + it.packs.length, 0)} evidence packs${notes.length ? `, ${notes.length} note pack(s) for the gaps review` : ''}`)

async function doItem(it) {
  const parts = await pipeline(
    it.packs,
    (pack, _, i) => agent(analyzePrompt(it, pack, i), { label: `analyze ${it.id} part ${i + 1}`, phase: 'Analyze', schema: PART }),
    (draft, pack, i) => (draft ? agent(verifyPrompt(it, pack, i, draft), { label: `verify ${it.id} part ${i + 1}`, phase: 'Verify', schema: CHECKED }) : null),
  )
  const ok = parts.filter(Boolean)
  if (ok.length < it.packs.length) log(`${it.id}: ${it.packs.length - ok.length} of ${it.packs.length} part(s) failed and are missing from its page`)
  if (!ok.length) return { id: it.id, failed: true }
  await agent(writePrompt(it, ok), { label: `write ${it.id}`, phase: 'Write' })
  const review = await agent(criticPrompt(it), { label: `critique ${it.id}`, phase: 'Critique', schema: ISSUES })
  const issues = review ? review.issues : []
  if (issues.length) await agent(fixPrompt(it, issues), { label: `fix ${it.id}`, phase: 'Critique' })
  const sum = (k) => ok.reduce((n, p) => n + (k === 'checked' ? p.audit.checked : p.audit[k].length), 0)
  return {
    id: it.id, parts: ok.length, of: it.packs.length, facts: ok.reduce((n, p) => n + p.facts.length, 0),
    checked: sum('checked'), removed: sum('removed'), corrected: sum('corrected'), added: sum('added'),
    reviewIssues: issues.length, highIssues: issues.filter((x) => x.severity === 'high').length,
  }
}

const byTopic = await pipeline(
  topics,
  (t) => parallel(t.items.map((it) => () => doItem(it))),
  async (results, t) => {
    const done = t.items.filter((it, k) => results[k] && !results[k].failed)
    if (done.length) await agent(topicPrompt(t.major, t.title, done), { label: `topic ${t.major} ${t.title}`, phase: 'Topics' })
    return { topic: t.major, title: t.title, items: results }
  },
)

const stats = byTopic.filter(Boolean).flatMap((t) => t.items.filter(Boolean))
const failed = items.filter((it) => !stats.some((s) => s.id === it.id && !s.failed)).map((it) => it.id)
if (failed.length) log(`No page for: ${failed.join(', ')}`)
const topicFiles = byTopic.filter(Boolean).map((t) => `${outDir}/topics/${t.topic}-${slug(t.title)}.md`)
const itemPages = items.filter((it) => !failed.includes(it.id)).map(page)

phase('Reference')
await parallel([
  () => agent(`Write ${outDir}/README.md, the front page of this training reference. Read ${workDir}/index.json for item details, and the topic pages: ${topicFiles.join(', ')}.
Sections: what this reference is and who it's for; how it was made (speech recognition with low-confidence words marked, frames taken whenever the screen changes, one agent per part following the trainer, an adversarial checker per part, an independent critic per page, two final auditors) and its limits (speech recognition errors on a French accent, frames sampled on screen changes, nothing beyond the material); a catalog table (Id | Title | Audience | Length or pages | Frames | Low-confidence words | Page | Topic) linking ${outDir}/items/<id>.md and the topic files with relative links; how to use it to write quizzes and to update the material; and the run stats below. ${failed.length ? `These items failed and have no page: ${failed.join(', ')}.` : ''}
Run stats: ${json(stats)}`, { label: 'write README', phase: 'Reference' }),
  () => agent(`Write ${outDir}/glossary.md: every term defined or relied on in the reference pages ${itemPages.join(', ')}. A table: Term | Meaning as used in the material | Sources (item id and time). Only terms the pages contain; merge duplicates; note where pages define a term differently.`, { label: 'write glossary', phase: 'Reference' }),
  () => agent(`Write ${outDir}/gaps-and-conflicts.md from the topic pages (${topicFiles.join(', ')}) and their item pages${notes.length ? `, plus the new KAMs' onboarding notes (${notes.join(', ')})` : ''}. Sections:
1. Contradictions between videos or documents, with sources on both sides.
2. Material that looks out of date (with the signal and source).
3. Personal data visible on screen, by item and time, so it can be blurred before sellers see it.
${notes.length ? "4. The new KAMs' questions and gaps from their notes, each mapped to the item that answers it (with citation) or marked \"Not covered\".\n5." : '4.'} Suggested fixes to the material (re-record, add, update, blur), each tied to a finding above.
Use only what the pages and notes say.`, { label: 'write gaps and conflicts', phase: 'Reference' }),
  () => agent(`Write ${outDir}/quiz-plan.md from the quiz blueprints in the topic pages (${topicFiles.join(', ')}) and the "Quiz material" sections of the item pages. Sections: a table per item (Id | Title | Audience | Suggested questions | Good for multiple-answer | Main areas); the total; a suggested order for new joiners (follow the folder numbering unless the material says otherwise); and the 20 strongest scenario seeds across all items with citations. Pierre asked for at most 20 questions per video, a mix of single and multiple answer, written by people rather than generated. This plan supports that; it doesn't replace it.`, { label: 'write quiz plan', phase: 'Reference' }),
])

phase('Audit')
const lenses = [
  ['numbers', 'numbers, dates, deadlines, prices, percentages, currencies, IDs and names'],
  ['process', 'procedures, rules, who does what, and the order of steps'],
]
const audits = await parallel(lenses.map(([key, lens]) => () => agent(`Audit this training reference for errors in ${lens}. Pick at least 25 claims of that kind spread across ${outDir}/README.md, ${outDir}/quiz-plan.md, ${outDir}/gaps-and-conflicts.md, ${outDir}/glossary.md and the topic pages (${topicFiles.join(', ')}). Trace each to the item page it cites, then to the transcript in ${workDir}/items/<id>/transcript.md or the frame/page image in ${workDir}/items/<id>/frames or /pages. Fix each wrong claim in place where it appears. Write ${outDir}/audit-${key}.md listing every claim checked, its source, and the result (correct / fixed / could not trace).`, { label: `audit ${key}`, phase: 'Audit', schema: AUDIT })))

return { items: stats, failed, audits: audits.map((a, k) => (a ? { lens: lenses[k][0], ...a } : null)) }
