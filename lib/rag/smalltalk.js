// Greetings, thanks and goodbyes need no search: answer them straight away,
// pointing at a few of the person's own materials, instead of sending "hi"
// through retrieval and getting "the training doesn't cover this".

const GREET = /^(hi+|hello+|hey+|heya|hiya|howdy|yo|good (morning|afternoon|evening|day)|morning|evening|(hi|hello|hey) (there|team|guys|everyone|all|bot|assistant)|salam|salaam|as?salam(u|o)? ?(a|o)?lai?kum|marhaba|bonjour|salut|hola|مرحبا|مرحبًا|هلا|اهلا|أهلا|اهلين|أهلين|السلام عليكم|سلام|صباح الخير|مساء الخير)$/;
const THANKS = /^(thanks?|thank you|thank you (so|very) much|thanks (a lot|so much)|many thanks|thx|ty|tysm|cheers|ok|okay|ok thanks|okay thanks|got it|great|great thanks|perfect|awesome|nice|cool|merci|شكرا|شكرًا|شكرا جزيلا|مشكور|يعطيك العافية)$/;
const BYE = /^(bye|bye bye|goodbye|good bye|see you|see ya|cya|later|au revoir|مع السلامة|باي)$/;
const ARABIC = /[؀-ۿ]/;

const normalise = (text) => String(text || '')
  .toLowerCase()
  .replace(/[\p{P}\p{S}\p{Extended_Pictographic}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** 'greet' | 'thanks' | 'bye' when the whole message is just that, else null. */
export function smallTalkKind(text) {
  const t = normalise(text);
  if (!t || t.length > 40) return null;
  if (GREET.test(t)) return 'greet';
  if (THANKS.test(t)) return 'thanks';
  if (BYE.test(t)) return 'bye';
  return null;
}

const orList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`);

/**
 * The reply, in Arabic for an Arabic message. `names`: the materials they can
 * open (a few are offered as examples); `scopedName`: the deck the chat is about.
 */
export function smallTalkReply(kind, { text = '', names = [], scopedName = null } = {}) {
  const ar = ARABIC.test(text);
  if (kind === 'thanks') return ar ? 'العفو! هل تحتاج شيئاً آخر من تدريبك؟' : 'You’re welcome! Anything else you’d like to know?';
  if (kind === 'bye') return ar ? 'مع السلامة! عد متى احتجت أي شيء.' : 'Bye! Come back any time you have a question.';
  if (scopedName) {
    return ar
      ? `أهلاً! اسألني أي شيء عن «${scopedName}» وسأجيبك منه مع رابط الشريحة.`
      : `Hi! Ask me anything about “${scopedName}” and I’ll answer from it, with a link to the slide.`;
  }
  if (!names.length) {
    return ar
      ? 'أهلاً! أجيب عن الأسئلة من مواد تدريبك، لكن لم تتم مشاركة أي مادة معك بعد. تواصل مع المدرّب.'
      : 'Hi! I answer questions from your training material, but nothing has been shared with you yet. Ask your trainer.';
  }
  const examples = names.slice(0, 3);
  return ar
    ? `أهلاً! أنا مساعد التدريب. اسألني عن أي شيء في تدريبك، مثل ${examples.map((n) => `«${n}»`).join('، ')}، وسأجيبك مع رابط الشريحة.`
    : `Hi! I’m your training assistant. Ask me anything from your training, like ${orList(examples.map((n) => `“${n}”`))}, and I’ll answer with a link to the slide.`;
}
