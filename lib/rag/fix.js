// A trainer's fix for a wrong answer is stored as a passage of material
// 'fix:<material id>' and searched alongside that material, so only people
// who can open the material get it. Shared by the server and the Assistant page.

export const FIX_PREFIX = 'fix:';
export const fixId = (materialId) => `${FIX_PREFIX}${materialId}`;
export const isFixId = (id) => typeof id === 'string' && id.startsWith(FIX_PREFIX);
/** The material a passage belongs to (a fix's own material for a fix). */
export const baseMaterialId = (id) => (isFixId(id) ? id.slice(FIX_PREFIX.length) : id);
/** Materials to search: each one with its fixes. */
export const withFixIds = (materialIds) => materialIds.flatMap((id) => [id, fixId(id)]);
/** The passage text for a fix: what the assistant quotes and searches. */
export const fixContent = (question, answer) => `Question: ${question.trim()}\nCorrect answer: ${answer.trim()}`;
