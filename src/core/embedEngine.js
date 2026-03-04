/**
 * ─── src/core/embedEngine.js ──────────────────────────────────────────────────
 * GUARDIAN V2 - GLOBAL JSON RENDERER
 * المصدر: مراجعة المدير التقني لتحويل الكود من "جيد" إلى "عالمي"
 */

function parse(text, placeholders) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (const [key, value] of Object.entries(placeholders)) {
    // دعم تبديل القيم حتى لو كانت أرقاماً أو كائنات بسيطة مع حماية من null
    const replacement = value !== null && value !== undefined ? String(value) : '';
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), replacement);
  }
  return out;
}

// دالة عالمية لتصحيح صيغة الألوان
function resolveColor(color) {
    if (!color) return 0x2f3136; // لون ديسكورد الافتراضي الأنيق
    if (typeof color === 'string' && color.startsWith('#')) {
        return parseInt(color.replace('#', ''), 16);
    }
    return color;
}

export function render(data = {}, placeholders = {}) {
  const out = {};

  // المعالجة الأساسية مع دعم التبديل العالمي
  if (data.title)       out.title       = parse(data.title, placeholders);
  if (data.description) out.description = parse(data.description, placeholders);
  if (data.url)         out.url         = data.url;
  
  // معالجة اللون بشكل عالمي
  out.color = resolveColor(data.color);

  if (data.timestamp) {
    out.timestamp = data.timestamp === true ? new Date().toISOString() : data.timestamp;
  }

  if (data.author && data.author.name) {
    out.author = {
      name:    parse(data.author.name,    placeholders),
      iconURL: parse(data.author.iconURL, placeholders),
      url:     data.author.url,
    };
  }

  if (data.thumbnail && (data.thumbnail.url || typeof data.thumbnail === 'string')) {
    const thumbUrl = typeof data.thumbnail === 'string' ? data.thumbnail : data.thumbnail.url;
    out.thumbnail = { url: parse(thumbUrl, placeholders) };
  }

  if (data.image && (data.image.url || typeof data.image === 'string')) {
    const imgUrl = typeof data.image === 'string' ? data.image : data.image.url;
    out.image = { url: parse(imgUrl, placeholders) };
  }

  if (data.footer && data.footer.text) {
    out.footer = {
      text:    parse(data.footer.text,    placeholders),
      iconURL: parse(data.footer.iconURL, placeholders),
    };
  }

  if (data.fields && Array.isArray(data.fields) && data.fields.length > 0) {
    out.fields = data.fields
      .filter(f => f.name && f.value) // حماية: تجاهل الحقول الناقصة
      .map((f) => ({
        name:   parse(f.name,  placeholders),
        value:  parse(f.value, placeholders),
        inline: !!f.inline,
      }));
  }

  return out;
}

export default { render };
