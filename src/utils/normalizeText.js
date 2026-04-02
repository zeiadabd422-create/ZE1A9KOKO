export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/إ|أ|آ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
    .trim();
}

export function normalizeArabicPhrase(text) {
  return normalizeText(text);
}

export const MAGIC_WORDS = {
  START: ['ابدا', 'ابدأ', 'start'],
  isStart: (text) => {
    const normalized = normalizeText(text);
    return MAGIC_WORDS.START.some(word => normalizeText(word) === normalized);
  }
};
