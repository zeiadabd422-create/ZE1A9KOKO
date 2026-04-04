/**
 * KeywordEngine - Smart keyword matching with Arabic variation support
 * Handles case normalization, diacritics, and multiple keyword variants
 */
export class KeywordEngine {
  constructor(keywords = ['ابدأ', 'ابدا', 'يلا']) {
    this.keywords = keywords;
    this.normalizedKeywords = keywords.map(kw => this.normalize(kw));
  }

  /**
   * Normalize Arabic text:
   * - Remove diacritics (fatha, damma, etc.)
   * - Normalize Alef variations (ا / أ / آ)
   * - Remove extra spaces
   * - Convert to lowercase
   */
  normalize(text) {
    if (!text) return '';

    // Remove Arabic diacritics
    let normalized = text
      .replace(/[\u064B-\u065F]/g, '') // Remove diacritics
      .replace(/ء/g, '') // Remove hamza standalone
      .toLowerCase()
      .trim();

    // Normalize Alef variations to base Alef (ا)
    normalized = normalized
      .replace(/أ/g, 'ا') // أ → ا
      .replace(/آ/g, 'ا') // آ → ا
      .replace(/إ/g, 'ا'); // إ → ا

    // Normalize Teh variations to base Teh (ت)
    normalized = normalized
      .replace(/ۀ/g, 'ة') // Teh goal to Teh Marbuta
      .replace(/ۃ/g, 'ة');

    // Remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Check if text matches any keyword
   */
  isKeywordMatch(text) {
    const normalized = this.normalize(text);

    return this.normalizedKeywords.some(kw => {
      // Exact match
      if (normalized === kw) return true;

      // Partial match (for multi-word queries)
      const words = normalized.split(/\s+/);
      return words.some(word => word === kw);
    });
  }

  /**
   * Get all valid keywords (for help messages)
   */
  getValidKeywords() {
    return this.keywords;
  }

  /**
   * Format keywords for display
   */
  formatKeywordsForDisplay() {
    return this.keywords.join(' / ');
  }

  /**
   * Set new keywords
   */
  setKeywords(keywords) {
    this.keywords = keywords;
    this.normalizedKeywords = keywords.map(kw => this.normalize(kw));
  }

  /**
   * Add a keyword
   */
  addKeyword(keyword) {
    if (!this.keywords.includes(keyword)) {
      this.keywords.push(keyword);
      this.normalizedKeywords.push(this.normalize(keyword));
    }
  }

  /**
   * Remove a keyword
   */
  removeKeyword(keyword) {
    const index = this.keywords.indexOf(keyword);
    if (index !== -1) {
      this.keywords.splice(index, 1);
      this.normalizedKeywords.splice(index, 1);
    }
  }

  /**
   * Test keyword matching
   */
  static test() {
    const engine = new KeywordEngine(['ابدأ', 'ابدا', 'يلا']);

    const testCases = [
      'ابدا',
      'ابدأ',
      'آبدا',
      'إبدأ',
      'ابدا',
      'ابدا   ',
      '  ابدا  ',
      'يلا',
      'يلاا',
      'hello',
    ];

    console.log('KeywordEngine Tests:');
    testCases.forEach(test => {
      console.log(`  "${test}" → ${engine.isKeywordMatch(test)}`);
    });
  }
}

// Export singleton instance
export const keywordEngine = new KeywordEngine();
