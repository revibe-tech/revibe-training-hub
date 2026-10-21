// Prompt and answer shape for the training assistant. The excerpts are
// already limited to materials the asker can open, so the model can't reveal
// anything they couldn't read in the library themselves.

const MAX_TOPICS = 40; // material names listed so the model knows what training exists

// The part trainers can change on the Assistant page (rag_settings.instructions).
export const DEFAULT_INSTRUCTIONS = `You are the Revibe Training Hub assistant: a friendly helper for Revibe agents, sellers and repair partners. You answer from their training material.

Reply in the language of the message. Be brief and practical; never lecture. Use policies, amounts, deadlines, field names and button names exactly as the excerpts write them, and never invent any.`;

// Always added after the instructions: the reply format depends on it.
export const REPLY_RULES = `Each message comes with the names of the training material this person can open and numbered excerpts from it. Choose one reply type:

- "chat": greetings, thanks, small talk or questions about you ("hey!", "thanks", "what can you do?", "who are you?"). Reply warmly in one or two sentences and offer to help, naming two or three of their training topics as examples. No citations.
- "answer": the excerpts answer the question. Lead with the answer, then numbered steps if it's a process. Only state what the excerpts say. Put the numbers of the excerpts you used in "citations".
- "not_covered": a real question the excerpts don't answer. Say in one short sentence that you couldn't find it in their training, point to the one to three topics from their list that come closest (if any), and add that their trainer or team lead can help. No citations.`;

/** The system prompt: trainer-editable instructions, then the fixed reply rules. */
export function systemPrompt(instructions = DEFAULT_INSTRUCTIONS) {
  return `${String(instructions || DEFAULT_INSTRUCTIONS).trim()}\n\n${REPLY_RULES}`;
}

export const SYSTEM_PROMPT = systemPrompt();

export const ANSWER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', format: 'enum', enum: ['answer', 'chat', 'not_covered'], description: 'Which kind of reply this is.' },
    answer: { type: 'STRING', description: 'The reply. Plain text; numbered lists and **bold** are allowed.' },
    citations: { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'Numbers of the excerpts used; empty unless type is "answer".' },
  },
  required: ['type', 'answer', 'citations'],
};

/** 'answer' | 'chat' | 'not_covered' for a model reply (older shape: { found }). */
export function replyType(result) {
  if (['answer', 'chat', 'not_covered'].includes(result?.type)) return result.type;
  return result?.found ? 'answer' : 'not_covered';
}

/** Gemini `contents`: the recent conversation, then the message with their topics and the excerpts. */
export function buildContents({ question, history, excerpts, materialNames = [] }) {
  const topics = materialNames.slice(0, MAX_TOPICS).join('; ') + (materialNames.length > MAX_TOPICS ? '; …' : '');
  const context = excerpts
    .map((e, i) => `[${i + 1}] ${e.materialName} (page ${e.page})\n${e.content}`)
    .join('\n\n');
  return [
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    {
      role: 'user',
      parts: [{ text: `Training material they can open: ${topics || 'none'}\n\nExcerpts from it:\n\n${context}\n\nMessage: ${question}` }],
    },
  ];
}
