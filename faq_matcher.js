// Enhanced FAQ Matcher for AskBot
// This file contains an improved matching algorithm for better question answering

/**
 * Enhanced FAQ matching with improved NLP techniques
 * @param {string} question - The user's question
 * @param {Array} faqs - Array of FAQ objects with question, answer, keywords, etc.
 * @param {number} maxSuggestions - Maximum number of suggestions to return
 * @param {Object} context - Previous context (lastQuestion, etc.)
 * @returns {Object} Object with bestMatch and suggestions
 */
function findBestMatches(question, faqs, maxSuggestions = 3, context = null) {
  if (!question || !faqs || !Array.isArray(faqs)) {
    console.log("ERROR in findBestMatches: Invalid input parameters");
    return { bestMatch: null, suggestions: [] };
  }

  // Text normalization
  function normalize(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Improved keyword matching with synonyms
  function keywordMatching(userText, keywords) {
    if (!keywords || !userText) return 0;
    
    const keywordsList = keywords.toLowerCase().split(',').map(k => k.trim());
    let matches = 0;
    
    // Synonym dictionary for education terms
    const synonyms = {
      'id': ['identification', 'card', 'school id', 'dhvsu id', 'student id'],
      'tor': ['transcript', 'record', 'grades', 'academic record'],
      'registration': ['enroll', 'enrollment', 'sign up', 'register', 'admission'],
      'tuition': ['fee', 'payment', 'cost', 'expense'],
      'subject': ['course', 'class', 'lecture'],
      'professor': ['teacher', 'instructor', 'faculty'],
      'schedule': ['timetable', 'calendar', 'class hours'],
      'campus': ['school', 'university', 'college', 'institution'],
      'document': ['papers', 'requirements', 'credentials', 'certificate'],
      'exam': ['test', 'quiz', 'assessment', 'evaluation'],
      'get': ['obtain', 'acquire', 'receive', 'claim', 'request', 'how to get'],
      'where': ['location', 'place', 'office', 'building', 'where is', 'where to'],
      'how': ['procedure', 'process', 'steps', 'instructions', 'way', 'how to'],
      'lost': ['missing', 'misplaced', 'cannot find', 'gone']
    };
    
    // Check direct keyword matches
    keywordsList.forEach(keyword => {
      if (userText.includes(keyword)) {
        matches += 1;
      }
      
      // Check synonym matches
      Object.keys(synonyms).forEach(key => {
        if (keyword.includes(key) || key.includes(keyword)) {
          synonyms[key].forEach(synonym => {
            if (userText.includes(synonym)) {
              matches += 0.7; // Slightly lower weight for synonyms
            }
          });
        }
      });
    });
    
    return Math.min(1, matches / Math.max(keywordsList.length, 1));
  }

  // Jaccard similarity with word importance
  function enhancedJaccard(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    // Give more weight to longer words
    const weightedWords1 = words1.map(w => ({ word: w, weight: Math.min(1, w.length / 3) }));
    const weightedWords2 = words2.map(w => ({ word: w, weight: Math.min(1, w.length / 3) }));
    
    // Find common words
    let intersectionWeight = 0;
    weightedWords1.forEach(w1 => {
      const match = weightedWords2.find(w2 => w2.word === w1.word);
      if (match) {
        intersectionWeight += (w1.weight + match.weight) / 2;
      }
    });
    
    // Calculate total weight
    const totalWeight = weightedWords1.reduce((sum, w) => sum + w.weight, 0) + 
                         weightedWords2.reduce((sum, w) => sum + w.weight, 0) - 
                         intersectionWeight;
    
    return totalWeight > 0 ? intersectionWeight / totalWeight : 0;
  }

  // Context awareness
  function contextBoost(prevQuestion, currQuestion) {
    if (!prevQuestion) return 0;
    
    const prevNorm = normalize(prevQuestion);
    const currNorm = normalize(currQuestion);
    
    // Direct reference boost ("How to get it?", "Where can I find it?")
    if (currNorm.includes('it') || currNorm.includes('this') || 
        currNorm.includes('that') || currNorm.includes('them')) {
      return 0.3; // Significant boost
    }
    
    // Topic consistency boost
    const prevWords = prevNorm.split(' ');
    const currWords = currNorm.split(' ');
    const commonWords = prevWords.filter(w => currWords.includes(w) && w.length > 3);
    
    if (commonWords.length > 0) {
      return 0.2 * Math.min(1, commonWords.length / 3);
    }
    
    return 0;
  }

  // Advanced ID question analysis
  function analyzeIdQuestion(question) {
    const normalized = question.toLowerCase();
    
    // Check for specific ID question types
    const isAboutLostId = 
      (normalized.includes('lost') || 
       normalized.includes('missing') || 
       normalized.includes('replace')) && 
      (normalized.includes('id') || 
       normalized.includes('card') || 
       normalized.includes('identification'));
       
    const isAboutValidation = 
      (normalized.includes('validate') || 
       normalized.includes('validation') || 
       normalized.includes('valid')) && 
      (normalized.includes('id') || 
       normalized.includes('card'));
       
    const isAboutGettingId = 
      (normalized.includes('get') || 
       normalized.includes('obtain') || 
       normalized.includes('acquire') || 
       normalized.includes('how') || 
       normalized.includes('where')) && 
      (normalized.includes('id') || 
       normalized.includes('card'));
    
    // Determine the primary intent
    let primaryIntent = null;
    
    if (isAboutLostId) {
      primaryIntent = 'lost_id';
    } else if (isAboutValidation) {
      primaryIntent = 'validate_id';
    } else if (isAboutGettingId) {
      primaryIntent = 'get_id';
    } else if (normalized.includes('id') || normalized.includes('card')) {
      primaryIntent = 'general_id';
    }
    
    return {
      isIdRelated: primaryIntent !== null,
      primaryIntent: primaryIntent,
      isAboutLostId: isAboutLostId,
      isAboutValidation: isAboutValidation,
      isAboutGettingId: isAboutGettingId
    };
  }

  // Process the user's question
  const userQNorm = normalize(question);
  const userWords = userQNorm.split(' ');
  
  // Check for specific intents
  const isAboutId = 
    userQNorm.includes('id') || 
    userQNorm.includes('identification') || 
    userQNorm.includes('card');
    
  const isAboutTranscript = 
    userQNorm.includes('transcript') || 
    userQNorm.includes('tor') || 
    userQNorm.includes('record');
    
  const isAboutLocation = 
    userQNorm.includes('where') || 
    userQNorm.includes('location') || 
    userQNorm.includes('office') || 
    userQNorm.includes('find');
  
  // Enhanced ID question analysis
  const idAnalysis = isAboutId ? analyzeIdQuestion(question) : { isIdRelated: false };
  
  if (idAnalysis.isIdRelated) {
    console.log(`ID question analysis: primary intent = ${idAnalysis.primaryIntent}`);
  }
  
  console.log(`Question analysis - about ID: ${isAboutId}, transcript: ${isAboutTranscript}, location: ${isAboutLocation}`);

  // Score each FAQ
  let scoredFaqs = faqs.map(faq => {
    if (!faq || !faq.question) {
      return { ...faq, _score: 0 };
    }
    
    const faqQNorm = normalize(faq.question);
    const faqWords = faqQNorm.split(' ');
    let score = 0;

    // Exact match (100 points)
    if (faqQNorm === userQNorm) {
      score = 100;
    } else {
      // Enhanced Jaccard similarity (up to 35 points)
      const jaccard = enhancedJaccard(userQNorm, faqQNorm);
      score += jaccard * 35;

      // Keyword matching with synonyms (up to 35 points)
      if (faq.keywords) {
        const keywordScore = keywordMatching(userQNorm, faq.keywords);
        score += keywordScore * 35;
      }

      // Advanced ID intent matching (up to 30 points)
      if (idAnalysis.isIdRelated) {
        const faqText = (faq.question + " " + (faq.keywords || "")).toLowerCase();
        
        // Match specific ID intents with relevant FAQ content
        if (idAnalysis.primaryIntent === 'lost_id' && 
            (faqText.includes('lost') || faqText.includes('replace')) && 
             faqText.includes('id')) {
          score += 30;
          console.log("Applied LOST ID intent boost to: " + faq.question);
        }
        else if (idAnalysis.primaryIntent === 'validate_id' && 
                (faqText.includes('validate') || faqText.includes('validation')) && 
                 faqText.includes('id')) {
          score += 30;
          console.log("Applied VALIDATE ID intent boost to: " + faq.question);
        }
        else if (idAnalysis.primaryIntent === 'get_id' && 
                (faqText.includes('get') || faqText.includes('new') || faqText.includes('obtain')) && 
                 faqText.includes('id')) {
          score += 30;
          console.log("Applied GET ID intent boost to: " + faq.question);
        }
        // General ID boost if no specific intent matched but question is ID-related
        else if (faqText.includes('id') || faqText.includes('identification')) {
          score += 20;
          console.log("Applied general ID topic boost to: " + faq.question);
        }
      }
      // General topic-specific boosts (up to 20 points)
      else if (isAboutId && (
          faqQNorm.includes('id') || 
          faqQNorm.includes('identification') || 
          faqQNorm.includes('card'))) {
        score += 20;
      } else if (isAboutTranscript && (
          faqQNorm.includes('transcript') || 
          faqQNorm.includes('tor') || 
          faqQNorm.includes('record'))) {
        score += 20;
      } else if (isAboutLocation && (
          faqQNorm.includes('where') || 
          faqQNorm.includes('location') || 
          faqQNorm.includes('office'))) {
        score += 15;
      }

      // Question word matching (10 points)
      // Match question words (how, what, where, when, why, who)
      const questionWords = ['how', 'what', 'where', 'when', 'why', 'who'];
      for (const word of questionWords) {
        if (userQNorm.startsWith(word) && faqQNorm.startsWith(word)) {
          score += 10;
          break;
        }
      }

      // Context boost (up to 10 points)
      if (context && context.lastQuestion) {
        const contextScore = contextBoost(context.lastQuestion, faq.question);
        score += contextScore * 10;
      }
    }

    // Category and priority boost (up to 5 points)
    if (faq.category && context?.lastCategory && faq.category === context.lastCategory) {
      score += 3; // Boost for same category as last question
    }
    
    if (faq.priority) {
      const priority = parseInt(faq.priority) || 3;
      score += (6 - priority); // Higher priority (1-5) gives more points
    }

    return { ...faq, _score: score };
  });

  // Sort by score and filter
  scoredFaqs = scoredFaqs
    .filter(faq => faq && faq._score > 0)
    .sort((a, b) => b._score - a._score);

  // Higher threshold (20) for better precision
  const bestMatch = scoredFaqs[0] && scoredFaqs[0]._score >= 20 ? scoredFaqs[0] : null;
  
  // Get suggestions with diversity
  let suggestions = [];
  
  if (scoredFaqs.length > 1) {
    // First try to get suggestions from different categories
    const bestMatchCategory = bestMatch?.category || '';
    const differentCategorySuggestions = scoredFaqs
      .filter(faq => faq !== bestMatch && faq._score >= 15 && faq.category !== bestMatchCategory)
      .slice(0, 2);
    
    suggestions = [...differentCategorySuggestions];
    
    // If we need more suggestions, add highest-scoring ones
    if (suggestions.length < maxSuggestions) {
      const remainingSuggestions = scoredFaqs
        .filter(faq => faq !== bestMatch && !suggestions.includes(faq) && faq._score >= 15)
        .slice(0, maxSuggestions - suggestions.length);
      
      suggestions = suggestions.concat(remainingSuggestions || []);
    }
  }

  console.log(`Best match score: ${bestMatch ? bestMatch._score.toFixed(2) : 'none'}`);
  console.log(`Number of suggestions: ${suggestions.length}`);

  return { bestMatch, suggestions };
}

// Export the function for use in the main backend
if (typeof module !== 'undefined') {
  module.exports = { findBestMatches };
} 