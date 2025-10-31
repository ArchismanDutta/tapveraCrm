const fuzzysort = require('fuzzysort');
const natural = require('natural');

/**
 * Enhanced NLP Utility for Intent Recognition with Fuzzy Matching
 * Handles typos, synonyms, and natural language variations
 */
class EnhancedNLP {
  constructor() {
    // Tokenizer for word processing
    this.tokenizer = new natural.WordTokenizer();

    // Porter stemmer for word root extraction (e.g., "creating", "created" -> "create")
    this.stemmer = natural.PorterStemmer;

    // Intent synonyms and variations
    this.intentSynonyms = {
      create: ['make', 'add', 'new', 'start', 'begin', 'initiate', 'setup', 'build', 'generate'],
      view: ['show', 'display', 'list', 'see', 'get', 'fetch', 'retrieve', 'find'],
      update: ['edit', 'modify', 'change', 'alter', 'revise', 'adjust'],
      delete: ['remove', 'erase', 'clear', 'drop', 'cancel'],
      filter: ['search', 'find', 'query', 'lookup', 'sort'],
      approve: ['accept', 'confirm', 'allow', 'permit', 'ok', 'yes'],
      reject: ['deny', 'decline', 'refuse', 'dismiss', 'no'],
      assign: ['give', 'allocate', 'delegate', 'set'],
      complete: ['finish', 'done', 'complete', 'end', 'close'],
      status: ['check', 'info', 'information', 'details', 'state'],
    };

    // Entity synonyms
    this.entitySynonyms = {
      task: ['todo', 'work', 'job', 'assignment', 'activity', 'item'],
      project: ['proj', 'initiative', 'program', 'venture'],
      employee: ['emp', 'staff', 'worker', 'team', 'member', 'person', 'user'],
      client: ['customer', 'consumer', 'account', 'buyer'],
      leave: ['vacation', 'pto', 'absence', 'holiday', 'off', 'timeoff'],
      attendance: ['presence', 'checkin', 'punch', 'clock'],
      analytics: ['stats', 'statistics', 'reports', 'metrics', 'insights', 'data'],
    };

    // Priority synonyms
    this.prioritySynonyms = {
      high: ['urgent', 'critical', 'important', 'asap', 'priority', 'top'],
      medium: ['normal', 'moderate', 'regular', 'standard', 'mid'],
      low: ['minor', 'trivial', 'small', 'basic', 'least'],
    };

    // Status synonyms
    this.statusSynonyms = {
      pending: ['waiting', 'open', 'todo', 'incomplete', 'unfinished'],
      approved: ['accepted', 'confirmed', 'ok', 'good', 'yes'],
      rejected: ['denied', 'declined', 'refused', 'no'],
      completed: ['done', 'finished', 'closed', 'complete', 'ended'],
    };

    // Build reverse synonym maps for quick lookup
    this.buildReverseSynonymMaps();
  }

  /**
   * Build reverse maps: synonym -> canonical term
   */
  buildReverseSynonymMaps() {
    this.intentReverseMap = this.buildReverseMap(this.intentSynonyms);
    this.entityReverseMap = this.buildReverseMap(this.entitySynonyms);
    this.priorityReverseMap = this.buildReverseMap(this.prioritySynonyms);
    this.statusReverseMap = this.buildReverseMap(this.statusSynonyms);
  }

  buildReverseMap(synonymMap) {
    const reverseMap = {};
    for (const [canonical, synonyms] of Object.entries(synonymMap)) {
      reverseMap[canonical] = canonical; // Add canonical term itself
      for (const synonym of synonyms) {
        reverseMap[synonym.toLowerCase()] = canonical;
      }
    }
    return reverseMap;
  }

  /**
   * Normalize text: lowercase, remove punctuation, tokenize
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Tokenize text into words
   */
  tokenize(text) {
    return this.tokenizer.tokenize(this.normalizeText(text));
  }

  /**
   * Stem words to their root form
   */
  stem(word) {
    return this.stemmer.stem(word.toLowerCase());
  }

  /**
   * Find the best matching intent using fuzzy matching
   * Returns: { intent: string, confidence: number, matchedWord: string }
   */
  findIntent(text, possibleIntents = Object.keys(this.intentSynonyms)) {
    const tokens = this.tokenize(text);
    let bestMatch = null;
    let maxConfidence = 0;

    for (const token of tokens) {
      // Check for exact synonym match first
      const canonicalIntent = this.intentReverseMap[token];
      if (canonicalIntent && possibleIntents.includes(canonicalIntent)) {
        return { intent: canonicalIntent, confidence: 1.0, matchedWord: token };
      }

      // Try fuzzy matching against all possible intents and their synonyms
      for (const intent of possibleIntents) {
        const allTerms = [intent, ...(this.intentSynonyms[intent] || [])];

        for (const term of allTerms) {
          const result = fuzzysort.single(token, term);
          if (result && result.score > -1000) { // fuzzysort uses negative scores
            const confidence = this.scoreToConfidence(result.score);
            if (confidence > maxConfidence && confidence > 0.6) { // 60% threshold
              maxConfidence = confidence;
              bestMatch = { intent, confidence, matchedWord: token };
            }
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Find entity type (task, project, employee, etc.)
   */
  findEntity(text) {
    const tokens = this.tokenize(text);
    let bestMatch = null;
    let maxConfidence = 0;

    for (const token of tokens) {
      // Check for exact synonym match
      const canonicalEntity = this.entityReverseMap[token];
      if (canonicalEntity) {
        return { entity: canonicalEntity, confidence: 1.0, matchedWord: token };
      }

      // Fuzzy matching
      for (const [entity, synonyms] of Object.entries(this.entitySynonyms)) {
        const allTerms = [entity, ...synonyms];

        for (const term of allTerms) {
          const result = fuzzysort.single(token, term);
          if (result && result.score > -1000) {
            const confidence = this.scoreToConfidence(result.score);
            if (confidence > maxConfidence && confidence > 0.6) {
              maxConfidence = confidence;
              bestMatch = { entity, confidence, matchedWord: token };
            }
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Find priority level with fuzzy matching
   */
  findPriority(text) {
    return this.findInCategory(text, this.prioritySynonyms, this.priorityReverseMap);
  }

  /**
   * Find status with fuzzy matching
   */
  findStatus(text) {
    return this.findInCategory(text, this.statusSynonyms, this.statusReverseMap);
  }

  /**
   * Generic category finder (priority, status, etc.)
   */
  findInCategory(text, synonymMap, reverseMap) {
    const tokens = this.tokenize(text);
    let bestMatch = null;
    let maxConfidence = 0;

    for (const token of tokens) {
      // Exact match
      const canonical = reverseMap[token];
      if (canonical) {
        return { value: canonical, confidence: 1.0, matchedWord: token };
      }

      // Fuzzy matching
      for (const [canonical, synonyms] of Object.entries(synonymMap)) {
        const allTerms = [canonical, ...synonyms];

        for (const term of allTerms) {
          const result = fuzzysort.single(token, term);
          if (result && result.score > -1000) {
            const confidence = this.scoreToConfidence(result.score);
            if (confidence > maxConfidence && confidence > 0.6) {
              maxConfidence = confidence;
              bestMatch = { value: canonical, confidence, matchedWord: token };
            }
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Convert fuzzysort score to confidence (0-1)
   * fuzzysort scores: 0 = perfect match, more negative = worse match
   */
  scoreToConfidence(score) {
    // Normalize score: 0 -> 1.0, -1000 -> 0.6, -2000 -> 0.3
    const normalized = Math.max(0, (score + 2000) / 2000);
    return normalized;
  }

  /**
   * Extract named entities with fuzzy matching
   * Returns: { intent: object, entity: object, priority: object, status: object }
   */
  extractEntities(text) {
    return {
      intent: this.findIntent(text),
      entity: this.findEntity(text),
      priority: this.findPriority(text),
      status: this.findStatus(text),
    };
  }

  /**
   * Enhanced pattern matching with fuzzy tolerance
   * Matches a pattern even with typos
   */
  fuzzyMatch(text, pattern, threshold = 0.7) {
    const normalizedText = this.normalizeText(text);
    const normalizedPattern = this.normalizeText(pattern);

    // Try exact match first
    if (normalizedText.includes(normalizedPattern)) {
      return { match: true, confidence: 1.0 };
    }

    // Fuzzy matching
    const result = fuzzysort.single(normalizedPattern, normalizedText);
    if (result) {
      const confidence = this.scoreToConfidence(result.score);
      return { match: confidence >= threshold, confidence };
    }

    return { match: false, confidence: 0 };
  }

  /**
   * Find best matching command from a list of patterns
   * Returns: { pattern: string, confidence: number, index: number }
   */
  findBestPattern(text, patterns, threshold = 0.7) {
    let bestMatch = null;
    let maxConfidence = 0;

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const result = this.fuzzyMatch(text, pattern, threshold);

      if (result.match && result.confidence > maxConfidence) {
        maxConfidence = result.confidence;
        bestMatch = { pattern, confidence: result.confidence, index: i };
      }
    }

    return bestMatch;
  }

  /**
   * Smart text extraction with context
   * Extracts values like names, dates, descriptions with fuzzy tolerance
   */
  extractValue(text, keywords, defaultValue = null) {
    const normalizedText = this.normalizeText(text);

    for (const keyword of keywords) {
      // Find keyword position with fuzzy matching
      const fuzzyResult = this.fuzzyMatch(normalizedText, keyword, 0.6);

      if (fuzzyResult.match) {
        // Find the actual position in original text
        const tokens = this.tokenize(normalizedText);
        const keywordIndex = tokens.findIndex(token =>
          fuzzysort.single(token, keyword)?.score > -1000
        );

        if (keywordIndex !== -1 && keywordIndex < tokens.length - 1) {
          // Extract remaining text after keyword
          return tokens.slice(keywordIndex + 1).join(' ');
        }
      }
    }

    return defaultValue;
  }

  /**
   * Get confidence level description
   */
  getConfidenceDescription(confidence) {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.7) return 'Good';
    if (confidence >= 0.6) return 'Moderate';
    return 'Low';
  }
}

// Export singleton instance
module.exports = new EnhancedNLP();
