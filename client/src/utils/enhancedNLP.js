import fuzzysort from 'fuzzysort';

/**
 * Enhanced NLP Utility for Client-Side Intent Recognition
 * Handles typos, synonyms, and natural language variations
 */
class EnhancedNLP {
  constructor() {
    // Intent synonyms and variations
    this.intentSynonyms = {
      navigate: ['go', 'open', 'visit', 'show', 'take', 'goto', 'move'],
      create: ['make', 'add', 'new', 'start', 'begin', 'initiate', 'setup', 'build'],
      approve: ['accept', 'confirm', 'allow', 'permit', 'ok', 'yes'],
      reject: ['deny', 'decline', 'refuse', 'dismiss', 'no'],
      filter: ['search', 'find', 'query', 'lookup', 'sort', 'show'],
      view: ['display', 'list', 'see', 'get', 'fetch'],
    };

    // Page/Entity synonyms
    this.pageSynonyms = {
      tasks: ['task', 'todo', 'work', 'job', 'assignment'],
      projects: ['project', 'proj', 'initiative'],
      employees: ['employee', 'emp', 'staff', 'worker', 'team', 'member'],
      clients: ['client', 'customer', 'consumer', 'account'],
      attendance: ['attendance', 'presence', 'checkin'],
      leaves: ['leave', 'vacation', 'pto', 'absence', 'holiday', 'timeoff'],
      dashboard: ['dashboard', 'home', 'main', 'overview'],
    };

    // Priority synonyms
    this.prioritySynonyms = {
      high: ['urgent', 'critical', 'important', 'asap', 'priority', 'top'],
      medium: ['normal', 'moderate', 'regular', 'standard', 'mid'],
      low: ['minor', 'trivial', 'small', 'basic', 'least'],
    };

    // Status synonyms
    this.statusSynonyms = {
      pending: ['waiting', 'open', 'todo', 'incomplete', 'unfinished', 'pendin'],
      approved: ['accepted', 'confirmed', 'ok', 'good', 'yes', 'aproved', 'approvd'],
      rejected: ['denied', 'declined', 'refused', 'no', 'rejectd', 'rejcted'],
    };

    // Build reverse synonym maps
    this.buildReverseSynonymMaps();
  }

  /**
   * Build reverse maps: synonym -> canonical term
   */
  buildReverseSynonymMaps() {
    this.intentReverseMap = this.buildReverseMap(this.intentSynonyms);
    this.pageReverseMap = this.buildReverseMap(this.pageSynonyms);
    this.priorityReverseMap = this.buildReverseMap(this.prioritySynonyms);
    this.statusReverseMap = this.buildReverseMap(this.statusSynonyms);
  }

  buildReverseMap(synonymMap) {
    const reverseMap = {};
    for (const [canonical, synonyms] of Object.entries(synonymMap)) {
      reverseMap[canonical] = canonical;
      for (const synonym of synonyms) {
        reverseMap[synonym.toLowerCase()] = canonical;
      }
    }
    return reverseMap;
  }

  /**
   * Normalize text: lowercase, remove punctuation, trim
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize text into words
   */
  tokenize(text) {
    return this.normalizeText(text).split(' ').filter(t => t.length > 0);
  }

  /**
   * Find the best matching intent using fuzzy matching
   */
  findIntent(text, possibleIntents = Object.keys(this.intentSynonyms)) {
    const tokens = this.tokenize(text);
    let bestMatch = null;
    let maxConfidence = 0;

    for (const token of tokens) {
      // Check for exact synonym match
      const canonicalIntent = this.intentReverseMap[token];
      if (canonicalIntent && possibleIntents.includes(canonicalIntent)) {
        return { intent: canonicalIntent, confidence: 1.0, matchedWord: token };
      }

      // Fuzzy matching
      for (const intent of possibleIntents) {
        const allTerms = [intent, ...(this.intentSynonyms[intent] || [])];

        for (const term of allTerms) {
          const result = fuzzysort.single(token, term);
          if (result && result.score > -1000) {
            const confidence = this.scoreToConfidence(result.score);
            if (confidence > maxConfidence && confidence > 0.6) {
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
   * Find page/entity
   */
  findPage(text) {
    const tokens = this.tokenize(text);
    let bestMatch = null;
    let maxConfidence = 0;

    for (const token of tokens) {
      // Exact match
      const canonicalPage = this.pageReverseMap[token];
      if (canonicalPage) {
        return { page: canonicalPage, confidence: 1.0, matchedWord: token };
      }

      // Fuzzy matching
      for (const [page, synonyms] of Object.entries(this.pageSynonyms)) {
        const allTerms = [page, ...synonyms];

        for (const term of allTerms) {
          const result = fuzzysort.single(token, term);
          if (result && result.score > -1000) {
            const confidence = this.scoreToConfidence(result.score);
            if (confidence > maxConfidence && confidence > 0.6) {
              maxConfidence = confidence;
              bestMatch = { page, confidence, matchedWord: token };
            }
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Find priority with fuzzy matching
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
   * Generic category finder
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
   */
  scoreToConfidence(score) {
    const normalized = Math.max(0, (score + 2000) / 2000);
    return normalized;
  }

  /**
   * Extract entities from command
   */
  extractEntities(text) {
    return {
      intent: this.findIntent(text),
      page: this.findPage(text),
      priority: this.findPriority(text),
      status: this.findStatus(text),
    };
  }

  /**
   * Fuzzy match a pattern against text
   */
  fuzzyMatch(text, pattern, threshold = 0.7) {
    const normalizedText = this.normalizeText(text);
    const normalizedPattern = this.normalizeText(pattern);

    if (normalizedText.includes(normalizedPattern)) {
      return { match: true, confidence: 1.0 };
    }

    const result = fuzzysort.single(normalizedPattern, normalizedText);
    if (result) {
      const confidence = this.scoreToConfidence(result.score);
      return { match: confidence >= threshold, confidence };
    }

    return { match: false, confidence: 0 };
  }

  /**
   * Find best matching pattern from a list
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
   * Extract value after keywords with fuzzy tolerance
   */
  extractValue(text, keywords, defaultValue = null) {
    const normalizedText = this.normalizeText(text);

    for (const keyword of keywords) {
      const fuzzyResult = this.fuzzyMatch(normalizedText, keyword, 0.6);

      if (fuzzyResult.match) {
        const tokens = this.tokenize(normalizedText);
        const keywordIndex = tokens.findIndex(token =>
          fuzzysort.single(token, keyword)?.score > -1000
        );

        if (keywordIndex !== -1 && keywordIndex < tokens.length - 1) {
          return tokens.slice(keywordIndex + 1).join(' ');
        }
      }
    }

    return defaultValue;
  }

  /**
   * Get confidence description
   */
  getConfidenceDescription(confidence) {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.7) return 'Good';
    if (confidence >= 0.6) return 'Moderate';
    return 'Low';
  }

  /**
   * Extract employee name from command
   */
  extractEmployeeName(text) {
    // Look for patterns like "for John", "to Sarah", "assign to Mike"
    const patterns = [
      /(?:for|to|assign\s+to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:leave|task)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract task title from command
   */
  extractTaskTitle(text) {
    // Remove common command words and extract the rest
    const cleaned = text
      .replace(/^(?:create|make|add|new)\s+(?:a\s+)?(?:task|todo)\s+/i, '')
      .replace(/\s+(?:for|to|by|with)\s+.+$/i, '')
      .trim();

    return cleaned || null;
  }
}

// Export singleton instance
const enhancedNLP = new EnhancedNLP();
export default enhancedNLP;
