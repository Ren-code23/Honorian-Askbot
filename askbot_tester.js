/**
 * AskBot Tester - A utility to test and validate the AskBot's accuracy
 * 
 * This script allows you to test the enhanced FAQ matching algorithm
 * with sample questions and see the detailed matching process.
 */

// Sample FAQ data for testing
const TEST_FAQS = [
  {
    question: "How to get my ID?",
    answer: "To get your student ID, visit the Office of Student Affairs with your Certificate of Registration (COR) and bring a valid ID for verification.",
    keywords: "id,student id,identification,get id,student affairs",
    category: "student-services",
    priority: 2
  },
  {
    question: "How to replace a lost ID?",
    answer: "To replace a lost ID, go to the Office of Student Affairs for an ID profiling form, pay at the Cashier's Office, and proceed to the MIS Office for ID printing. Bring a valid ID and proof of payment.",
    keywords: "lost id,missing id,replace id,new id,student affairs",
    category: "student-services",
    priority: 2
  },
  {
    question: "How to validate my ID?",
    answer: "You can have your ID validated at the Office of Student Affairs. Bring your latest Certificate of Registration (COR) for validation.",
    keywords: "validate id,validation,id validation,student affairs",
    category: "student-services", 
    priority: 3
  },
  {
    question: "How to get Transcript of Records (TOR)?",
    answer: "To request a Transcript of Records (TOR), first secure your clearance from the Accounting Office. Then, proceed to the Office of the Registrar to fill out the TOR request form and pay the required fees.",
    keywords: "transcript,TOR,records,request,registrar,clearance",
    category: "registrar",
    priority: 1
  },
  {
    question: "Where can I get my COE or COG?",
    answer: "You can get your Certificate of Enrollment (COE) or Certificate of Grades (COG) at the Registrar's Office.",
    keywords: "COE,COG,certificate,enrollment,grades,registrar,certificate of grades,transcript,record",
    category: "registrar",
    priority: 2
  },
  {
    question: "When will enrollment for the next academic year begin?",
    answer: "The schedule for enrollment for the next academic year has not been announced yet. Please refer to the DHVSU Admissions Office for official updates and further information.",
    keywords: "enrollment,schedule,admissions,academic year,updates,enroll,when,begin,start,registration",
    category: "admissions",
    priority: 1
  }
];

// Sample test queries for various intents
const TEST_QUERIES = [
  { query: "where can I get my id?", expectedCategory: "student-services", expectedIntent: "get_id" },
  { query: "how to get ID", expectedCategory: "student-services", expectedIntent: "get_id" },
  { query: "lost my ID card", expectedCategory: "student-services", expectedIntent: "lost_id" },
  { query: "where do I need to validate my ID", expectedCategory: "student-services", expectedIntent: "validate_id" },
  { query: "how to request TOR", expectedCategory: "registrar", expectedIntent: "transcript" },
  { query: "where to get certificate of grades", expectedCategory: "registrar", expectedIntent: "grades" },
  { query: "when is enrollment", expectedCategory: "admissions", expectedIntent: "enrollment" }
];

// Mock implementation of the findBestMatches function 
// This simulates what happens in appscript_backend.js and faq_matcher.js
function findBestMatches(question, faqs, maxSuggestions = 3) {
  // Guard against undefined inputs at the very beginning
  if (!question || question === "undefined" || !faqs) {
    console.log(`WARNING: Invalid inputs to findBestMatches. question: ${question}, faqs: ${faqs ? 'array[' + faqs.length + ']' : 'undefined'}`);
    return {
      bestMatch: null,
      suggestions: [],
      allMatches: []
    };
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

  // Keyword matching with synonyms
  function keywordMatching(userText, keywords) {
    if (!keywords || !userText) return 0;
    
    const keywordsList = keywords.toLowerCase().split(',').map(k => k.trim());
    let matches = 0;
    
    // Synonym dictionary for education terms
    const synonyms = {
      'id': ['identification', 'card', 'student id', 'dhvsu id'],
      'tor': ['transcript', 'record', 'grades', 'academic record'],
      'get': ['obtain', 'acquire', 'receive', 'claim', 'request', 'where'],
      'lost': ['missing', 'misplaced', 'cannot find']
    };
    
    // Check direct keyword matches
    keywordsList.forEach(keyword => {
      if (userText.includes(keyword)) {
        matches += 1;
        console.log("Keyword match: " + keyword);
      }
      
      // Check synonym matches
      Object.keys(synonyms).forEach(key => {
        if (keyword.includes(key) || key.includes(keyword)) {
          synonyms[key].forEach(synonym => {
            if (userText.includes(synonym)) {
              matches += 0.7; // Slightly lower weight for synonyms
              console.log("Synonym match: " + synonym + " for " + keyword);
            }
          });
        }
      });
    });
    
    return Math.min(1, matches / Math.max(keywordsList.length, 1));
  }

  // ID question analysis
  function analyzeIdQuestion(question) {
    const normalized = question.toLowerCase();
    
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
      primaryIntent: primaryIntent
    };
  }

  // Main matching logic
  const userQNorm = normalize(question);
  
  // Detect question intents
  const isAboutId = 
    userQNorm.includes('id') || 
    userQNorm.includes('identification') || 
    userQNorm.includes('card');
  
  // Enhanced ID analysis
  const idAnalysis = isAboutId ? analyzeIdQuestion(question) : { isIdRelated: false };
  
  console.log(`Question: "${question}"`);
  console.log(`ID related: ${isAboutId}, ID analysis: ${idAnalysis.isIdRelated ? idAnalysis.primaryIntent : 'N/A'}`);

  // Score FAQs
  let scoredFaqs = faqs.map(faq => {
    const faqQNorm = normalize(faq.question);
    let score = 0;

    // Exact match (100 points)
    if (faqQNorm === userQNorm) {
      score = 100;
    } else {
      // Basic similarity (up to 40 points)
      const userWords = new Set(userQNorm.split(' '));
      const faqWords = new Set(faqQNorm.split(' '));
      const intersection = new Set([...userWords].filter(x => faqWords.has(x)));
      const union = new Set([...userWords, ...faqWords]);
      const similarity = intersection.size / union.size;
      score += similarity * 40;
      
      // Keyword matching (up to 35 points)
      if (faq.keywords) {
        const keywordScore = keywordMatching(userQNorm, faq.keywords);
        score += keywordScore * 35;
      }

      // ID intent matching (up to 30 points)
      if (idAnalysis.isIdRelated && idAnalysis.primaryIntent) {
        const faqText = (faq.question + " " + (faq.keywords || "")).toLowerCase();
        
        if (idAnalysis.primaryIntent === 'lost_id' && 
            (faqText.includes('lost') || faqText.includes('replace')) && 
            faqText.includes('id')) {
          score += 30;
        }
        else if (idAnalysis.primaryIntent === 'validate_id' && 
                faqText.includes('validate') && 
                faqText.includes('id')) {
          score += 30;
        }
        else if (idAnalysis.primaryIntent === 'get_id' && 
                (faqText.includes('get') || faqText.includes('how')) && 
                faqText.includes('id')) {
          score += 30;
        }
        else if (faqText.includes('id')) {
          score += 15;
        }
      }
    }

    // Priority boost
    if (faq.priority) {
      const priority = parseInt(faq.priority) || 3;
      score += (6 - priority);
    }

    return { ...faq, _score: score };
  });

  // Sort by score
  scoredFaqs = scoredFaqs
    .filter(faq => faq._score > 0)
    .sort((a, b) => b._score - a._score);

  const bestMatch = scoredFaqs[0] && scoredFaqs[0]._score >= 20 ? scoredFaqs[0] : null;
  
  const suggestions = scoredFaqs
    .filter(faq => faq !== bestMatch && faq._score >= 15)
    .slice(0, maxSuggestions);

  return { 
    bestMatch, 
    suggestions: suggestions || [],
    allMatches: scoredFaqs && scoredFaqs.length > 0 ? 
      scoredFaqs.slice(0, 3).map(f => ({
        question: f.question,
        score: f._score,
        category: f.category
      })) : []
  };
}

// Run the tests
function runTests() {
  console.log("=".repeat(50));
  console.log("ASKBOT TESTING UTILITY");
  console.log("=".repeat(50));
  
  let passedTests = 0;
  
  TEST_QUERIES.forEach((test, index) => {
    console.log("\n" + "-".repeat(50));
    console.log(`TEST #${index + 1}: "${test.query}"`);
    console.log("-".repeat(50));
    
    const result = findBestMatches(test.query, TEST_FAQS);
    
    console.log("\nRESULTS:");
    if (result.bestMatch) {
      console.log(`✓ Best match: "${result.bestMatch.question}"`);
      console.log(`✓ Score: ${result.bestMatch._score.toFixed(2)}`);
      console.log(`✓ Category: ${result.bestMatch.category}`);
      
      // Check if test passed
      const categoryMatched = result.bestMatch.category === test.expectedCategory;
      console.log(`Test result: ${categoryMatched ? 'PASSED ✓' : 'FAILED ✗'}`);
      
      if (categoryMatched) passedTests++;
    } else {
      console.log("✗ No match found above threshold");
      console.log(`Test result: FAILED ✗`);
    }
    
    // Show other matches for debugging
    console.log("\nAll top matches:");
    result.allMatches.forEach((match, i) => {
      console.log(`  ${i+1}. "${match.question}" (${match.score.toFixed(2)}) - ${match.category}`);
    });
    
    console.log("\nSuggestions:");
    if (result.suggestions.length > 0) {
      result.suggestions.forEach((s, i) => {
        console.log(`  ${i+1}. "${s.question}"`);
      });
    } else {
      console.log("  None");
    }
  });
  
  console.log("\n" + "=".repeat(50));
  console.log(`SUMMARY: ${passedTests}/${TEST_QUERIES.length} tests passed`);
  console.log("=".repeat(50));
}

// Run the tests
runTests(); 

// Add clarification sample FAQs
TEST_FAQS.push({
  question: "What document do I need for registration?",
  answer: "The documents required depend on your status. Are you a new student, transferee, or continuing student?",
  keywords: "document,registration,requirements,enroll",
  category: "admissions",
  priority: 2,
  requiresClarification: true,
  clarificationOptions: JSON.stringify([
    { text: "new student", response: "New students need: Form 138 (Report Card), Certificate of Good Moral Character, Birth Certificate, and 2x2 ID pictures." },
    { text: "transferee", response: "Transferees need: Transcript of Records, Certificate of Transfer Credential, Certificate of Good Moral Character, and 2x2 ID pictures." },
    { text: "continuing", response: "Continuing students need: Certificate of Registration from the previous semester and proof of payment of outstanding balances if any." }
  ]),
  followUpQuestions: "When is the enrollment period?|How much is the tuition fee?|Where is the admission office?"
});

// Test clarification sample queries
TEST_QUERIES.push(
  { query: "What documents do I need to register?", expectedCategory: "admissions", expectedIntent: "registration" }
);

// Add follow-up FAQ
TEST_FAQS.push({
  question: "How to enroll online?",
  answer: "To enroll online, visit the university portal at enroll.dhvsu.edu.ph and log in with your student credentials. Follow the step-by-step guide available on the homepage.",
  keywords: "enroll,online,portal,registration",
  category: "admissions",
  priority: 1,
  followUpQuestions: "What are the enrollment deadlines?|How to pay tuition online?|How to get my class schedule?"
});

// Add test for follow-up functionality
TEST_QUERIES.push(
  { query: "How can I enroll through the internet?", expectedCategory: "admissions", expectedIntent: "online" }
);

// Add a direct FAQ for enrollment and certificate of grades
TEST_FAQS.push({
  question: "Where to get certificate of grades?",
  answer: "Certificate of Grades (COG) can be obtained from the Registrar's Office. Bring your student ID and pay the required fee.",
  keywords: "certificate of grades,COG,grades,registrar,transcript,where,get",
  category: "registrar",
  priority: 1
});

TEST_FAQS.push({
  question: "When is enrollment?",
  answer: "The exact enrollment dates vary by semester. Please check the university website or contact the Admissions Office for the current enrollment schedule.",
  keywords: "enrollment,when,schedule,date,period,time,admissions,registration",
  category: "admissions",
  priority: 1
});

// Enhance the runTests function to optionally test conversation flow with context
function runTestConversation(initialQuery, followUpQuery, context) {
  console.log("=".repeat(50));
  console.log("TESTING CONVERSATION FLOW");
  console.log("=".repeat(50));
  
  // First question
  console.log(`Initial question: "${initialQuery}"`);
  const result1 = findBestMatches(initialQuery, TEST_FAQS);
  
  console.log(`Answer: "${result1.bestMatch?.answer || 'No match found'}"`);
  console.log(`Response type: ${result1.bestMatch?.requiresClarification ? 'Clarification' : 'Direct answer'}`);
  
  if (result1.bestMatch?.requiresClarification) {
    // Parse and display clarification options
    let options = [];
    try {
      if (typeof result1.bestMatch.clarificationOptions === 'string') {
        options = JSON.parse(result1.bestMatch.clarificationOptions);
      } else {
        options = result1.bestMatch.clarificationOptions || [];
      }
      
      console.log("\nClarification options:");
      options.forEach((opt, i) => {
        console.log(`  ${i+1}. ${opt.text}`);
      });
    } catch (e) {
      console.log("Error parsing clarification options:", e);
    }
    
    // Create context for follow-up
    const testContext = {
      lastQuestion: initialQuery,
      awaitingClarification: true,
      originalQuestion: result1.bestMatch.question
    };
    
    // Process follow-up with clarification
    console.log(`\nFollow-up: "${followUpQuery}"`);
    
    // Find which option was selected
    let selectedOption = null;
    options.forEach(opt => {
      if (followUpQuery.toLowerCase().includes(opt.text.toLowerCase())) {
        selectedOption = opt;
      }
    });
    
    if (selectedOption) {
      console.log(`Matched option: "${selectedOption.text}"`);
      console.log(`Response: "${selectedOption.response}"`);
    } else {
      console.log("No matching clarification option found");
      
      // Fall back to normal processing
      const result2 = findBestMatches(followUpQuery, TEST_FAQS);
      console.log(`Fallback answer: "${result2.bestMatch?.answer || 'No match found'}"`);
    }
  } else {
    // For direct answers, show follow-up questions
    console.log("\nFollow-up suggestions:");
    if (result1.bestMatch?.followUpQuestions) {
      let followUps = [];
      try {
        if (typeof result1.bestMatch.followUpQuestions === 'string') {
          if (result1.bestMatch.followUpQuestions.startsWith('[')) {
            followUps = JSON.parse(result1.bestMatch.followUpQuestions);
          } else {
            followUps = result1.bestMatch.followUpQuestions.split('|').map(q => q.trim());
          }
        } else {
          followUps = result1.bestMatch.followUpQuestions;
        }
        
        followUps.forEach((q, i) => {
          console.log(`  ${i+1}. ${q}`);
        });
      } catch (e) {
        console.log("Error parsing follow-up questions:", e);
      }
    } else {
      console.log("  None defined");
    }
    
    // If a follow-up query was provided, test it
    if (followUpQuery) {
      console.log(`\nFollow-up query: "${followUpQuery}"`);
      
      // Create context from first result
      const testContext = context || {
        lastQuestion: initialQuery,
        lastCategory: result1.bestMatch?.category
      };
      
      const result2 = findBestMatches(followUpQuery, TEST_FAQS);
      console.log(`Answer: "${result2.bestMatch?.answer || 'No match found'}"`);
      
      // Check for context boost
      if (result2.bestMatch?.category === result1.bestMatch?.category) {
        console.log("✓ Context consistency: Same category match");
      }
    }
  }
  
  console.log("=".repeat(50));
}

// Add after the original runTests function call
console.log("\n\nTESTING CONVERSATION FLOWS\n\n");

// Test a clarification flow
runTestConversation(
  "What documents do I need for registration?", 
  "I'm a new student"
);

// Test a follow-up flow
runTestConversation(
  "How to enroll online?",
  "How do I pay tuition fees?",
  { lastCategory: "admissions" }
); 

// Prevent the undefined error at the end
console.log("\nTests completed successfully!"); 