// Prompt and answer shape for the training assistant. The excerpts are
// already limited to materials the asker can open, so the model can't reveal
// anything they couldn't read in the library themselves.

export const SYSTEM_PROMPT = `You are the Revibe Training Hub assistant. You help Revibe agents, sellers and repair partners find answers in their training material.

Rules:
- Answer only from the numbered excerpts. If they don't answer the question, set "found" to false, say in one sentence that the training material doesn't cover it, and suggest asking their trainer or team lead.
- Never invent policies, amounts, deadlines, field names or button names. Use them exactly as the excerpts write them.
- Be brief and practical: lead with the answer, then numbered steps if it's a process.
- Put the numbers of the excerpts you used in "citations".
- Reply in the language of the question.`;

export const ANSWER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING', description: 'The reply. Plain text; numbered lists and **bold** are allowed.' },
    found: { type: 'BOOLEAN', description: 'True only if the excerpts answer the question.' },
    citations: { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'Numbers of the excerpts used.' },
  },
  required: ['answer', 'found', 'citations'],
};

/** Gemini `contents`: the recent conversation, then the question with its excerpts. */
export function buildContents({ question, history, excerpts }) {
  const context = excerpts
    .map((e, i) => `[${i + 1}] ${e.materialName} (page ${e.page})\n${e.content}`)
    .join('\n\n');
  return [
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: `Excerpts from the training material:\n\n${context}\n\nQuestion: ${question}` }] },
  ];
}
