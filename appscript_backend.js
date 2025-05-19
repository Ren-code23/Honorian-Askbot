// REQUIRED GOOGLE SHEETS STRUCTURE:
// Users: id, username, email, password, dateCreated, reset_token, token_expiry, last_message_time, role, profile_pic
// FAQs: id, question, answer, keywords, status
// Feedback: timestamp, username, message, feedbackType
// ActivityLog: timestamp, username, action, details, ipAddress
// Conversations: timestamp, username, question, answer
//
// No Google Drive upload is used; profile_pic is a URL string.

function doGet(e) {
    return HtmlService.createHtmlOutput("The API is working. This endpoint accepts POST requests only.");
  }
  
  function doPost(e) {
    try {
      Logger.log("Request received: " + JSON.stringify(e));
      Logger.log("Parameters received: " + JSON.stringify(e.parameter));
      
      if (!e.parameter) {
        Logger.log("ERROR: No parameters received in request");
        return createJsonResponse({
          success: false,
          message: "No parameters received"
        });
      }
      
      const params = e.parameter;
      const action = params.action;
      
      Logger.log("Action requested: " + action);
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      
      // --- Unified headers ---
      const USERS_HEADERS = ["id", "username", "email", "password", "dateCreated", "reset_token", "token_expiry", "last_message_time", "role", "profile_pic"];
      const FAQ_HEADERS = ["id", "question", "answer", "keywords", "status", "category", "priority"];
      const FEEDBACK_HEADERS = ["timestamp", "username", "message", "feedbackType", "comment"];
      const LOG_HEADERS = ["timestamp", "username", "action", "details", "ipAddress"];
      const CONVO_HEADERS = ["timestamp", "username", "question", "answer"];
      
      // --- Action handlers ---
      if (action === "signup") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        return handleSignup(params, userSheet);
      } else if (action === "login") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        return handleLogin(params, userSheet);
      } else if (action === "queryFAQ") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        const rateLimitResult = checkRateLimit(params.username, userSheet);
        if (!rateLimitResult.allowed) {
          return createJsonResponse({
            success: false,
            response: "You are sending messages too quickly. Please wait a few seconds before trying again."
          });
        }
        const faqSheet = getOrCreateSheet(ss, "FAQs", FAQ_HEADERS);
        ensureFAQHeaders(faqSheet);
        return handleFAQQuery(params, faqSheet);
      } else if (action === "logConversation") {
        const conversationSheet = getOrCreateSheet(ss, "Conversations", CONVO_HEADERS);
        ensureSheetColumns(conversationSheet, CONVO_HEADERS);
        return handleLogConversation(params, conversationSheet);
      } else if (action === "forgotPassword") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        return handleForgotPassword(params, userSheet);
      } else if (action === "resetPassword") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        return handleResetPassword(params, userSheet);
      } else if (action === "getFAQs" || action === "getAllFAQs") {
        const faqSheet = getOrCreateSheet(ss, "FAQs", FAQ_HEADERS);
        ensureFAQHeaders(faqSheet);
        return handleGetFAQs(faqSheet, params && params.admin === "true");
      } else if (action === "addFAQ") {
        const faqSheet = getOrCreateSheet(ss, "FAQs", FAQ_HEADERS);
        ensureFAQHeaders(faqSheet);
        return handleAddFAQ(params, faqSheet);
      } else if (action === "editFAQ") {
        const faqSheet = getOrCreateSheet(ss, "FAQs", FAQ_HEADERS);
        ensureFAQHeaders(faqSheet);
        return handleEditFAQ(params, faqSheet);
      } else if (action === "deleteFAQ") {
        const faqSheet = getOrCreateSheet(ss, "FAQs", FAQ_HEADERS);
        ensureFAQHeaders(faqSheet);
        return handleDeleteFAQ(params, faqSheet);
      } else if (action === "getFeedback" || action === "getAllFeedback") {
        const feedbackSheet = getOrCreateSheet(ss, "Feedback", FEEDBACK_HEADERS);
        ensureSheetColumns(feedbackSheet, FEEDBACK_HEADERS);
        return handleGetFeedback(feedbackSheet);
      } else if (action === "getLogs" || action === "getAllLogs") {
        const logSheet = getOrCreateSheet(ss, "ActivityLog", LOG_HEADERS);
        ensureSheetColumns(logSheet, LOG_HEADERS);
        return handleGetLogs(logSheet);
      } else if (action === "getUsers" || action === "getAllUsers") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        return handleGetUsers(userSheet);
      } else if (action === "getAnalytics") {
        const faqSheet = getOrCreateSheet(ss, "FAQs", FAQ_HEADERS);
        ensureSheetColumns(faqSheet, FAQ_HEADERS);
        const feedbackSheet = getOrCreateSheet(ss, "Feedback", FEEDBACK_HEADERS);
        ensureSheetColumns(feedbackSheet, FEEDBACK_HEADERS);
        return handleGetAnalytics(faqSheet, feedbackSheet);
      } else if (action === "getUserProfile") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        return handleGetUserProfile(userSheet, params.username);
      } else if (action === "updateUserProfile") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        return handleUpdateUserProfile(userSheet, params);
      } else if (action === "uploadProfilePic") {
        return handleUploadProfilePic(params);
      } else if (action === "getUserChatHistory") {
        const conversationSheet = getOrCreateSheet(ss, "Conversations", CONVO_HEADERS);
        ensureSheetColumns(conversationSheet, CONVO_HEADERS);
        return handleGetUserChatHistory(params, conversationSheet);
      } else if (action === "getAdminStats") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        const faqSheet = getOrCreateSheet(ss, "FAQs", FAQ_HEADERS);
        ensureSheetColumns(faqSheet, FAQ_HEADERS);
        const chatSheet = getOrCreateSheet(ss, "Conversations", CONVO_HEADERS);
        ensureSheetColumns(chatSheet, CONVO_HEADERS);
        return handleGetAdminStats(userSheet, faqSheet, chatSheet);
      } else if (action === "deleteUser") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        return handleDeleteUser(params, userSheet);
      } else if (action === "updateUser") {
        const userSheet = getOrCreateSheet(ss, "Users", USERS_HEADERS);
        ensureSheetColumns(userSheet, USERS_HEADERS);
        return handleUpdateUser(params, userSheet);
      } else if (action === "logFeedback") {
        const feedbackSheet = getOrCreateSheet(ss, "Feedback", FEEDBACK_HEADERS);
        ensureSheetColumns(feedbackSheet, FEEDBACK_HEADERS);
        return handleLogFeedback(params, feedbackSheet);
      } else if (action === "logActivity") {
        const logSheet = getOrCreateSheet(ss, "ActivityLog", LOG_HEADERS);
        ensureSheetColumns(logSheet, LOG_HEADERS);
        return handleLogActivity(params, logSheet);
      } else {
        Logger.log("ERROR: Invalid action: " + action);
        return createJsonResponse({
          success: false,
          message: "Invalid action: " + action
        });
      }
      
    } catch (error) {
      Logger.log("ERROR in doPost (action: " + (e && e.parameter && e.parameter.action) + "): " + error.toString());
      Logger.log("Stack: " + error.stack);
      return createJsonResponse({
        success: false,
        message: "Server error (" + (e && e.parameter && e.parameter.action) + "): " + error.toString()
      });
    }
  }
  
  // Rate limiting function
  function checkRateLimit(username, sheet) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf("username");
    const lastMsgCol = headers.indexOf("last_message_time");
    const now = Date.now();
    const cooldown = 5000; // 5 seconds
    
    Logger.log("Checking rate limit for user: " + username);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === username) {
        const lastTime = data[i][lastMsgCol] ? new Date(data[i][lastMsgCol]).getTime() : 0;
        
        Logger.log("Last message time: " + new Date(lastTime).toISOString());
        Logger.log("Time since last message: " + (now - lastTime) + "ms");
        
        if (now - lastTime < cooldown) {
          Logger.log("Rate limit exceeded for user: " + username);
          return { allowed: false };
        }
        
        // Update last_message_time
        Logger.log("Updating last message time for user: " + username);
        sheet.getRange(i + 1, lastMsgCol + 1).setValue(new Date().toISOString());
        return { allowed: true };
      }
    }
    
    Logger.log("Username not found for rate limiting, allowing request: " + username);
    return { allowed: true };
  }
  
  // Helper function to get or create a sheet with headers
  function getOrCreateSheet(ss, sheetName, headers) {
    let sheet = ss.getSheetByName(sheetName);
    
    // Check if the sheet exists, if not create it with headers
    if (!sheet) {
      Logger.log("Creating new sheet: " + sheetName);
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
    }
    
    return sheet;
  }
  
  // Helper function to create JSON response
  function createJsonResponse(data) {
    Logger.log("Response sent: " + JSON.stringify(data));
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  function handleSignup(params, sheet) {
    // Get parameters
    const username = params.username;
    const email = params.email;
    const password = params.password; // Already hashed from client-side
    
    Logger.log("Processing signup for: " + username + ", " + email);
    
    // Check if username already exists
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf("username");
    const emailCol = headers.indexOf("email");
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === username) {
        Logger.log("Signup failed: Username already exists");
        return createJsonResponse({
          success: false,
          message: "Username already exists. Please choose another one."
        });
      }
      if (data[i][emailCol] === email) {
        Logger.log("Signup failed: Email already registered");
        return createJsonResponse({
          success: false,
          message: "Email already registered. Please use another email."
        });
      }
    }
    
    // Add new user (default role: student, can be changed manually to 'admin')
    const newId = Utilities.getUuid();
    const dateCreated = new Date().toISOString();
    sheet.appendRow([newId, username, email, password, dateCreated, "", "", "", "student", ""]);
    
    Logger.log("Signup successful for: " + username);
    return createJsonResponse({
      success: true,
      message: "User registered successfully"
    });
  }
  
  function handleLogin(params, sheet) {
    // Get parameters
    const username = params.username;
    const password = params.password; // Already hashed from client-side
    
    Logger.log("Processing login for: " + username);
    
    // Find user in spreadsheet
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf("username");
    const passwordCol = headers.indexOf("password");
    const emailCol = headers.indexOf("email");
    const roleCol = headers.indexOf("role");
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === username && data[i][passwordCol] === password) {
        // Log the successful login
        logActivity(username, "login");
        
        Logger.log("Login successful for: " + username);
        return createJsonResponse({
          success: true,
          message: "Login successful",
          username: username,
          email: data[i][emailCol],
          role: roleCol !== -1 ? (data[i][roleCol] || "student") : "student"
        });
      }
    }
    
    // If no match found
    Logger.log("Login failed for: " + username);
    return createJsonResponse({
      success: false,
      message: "Invalid username or password"
    });
  }
  
  // FAQ query handling
  function handleFAQQuery(params, sheet) {
    const question = params.question.toLowerCase();
    const username = params.username;
    Logger.log("Processing FAQ query: " + question + " from: " + username);
    // Get FAQ data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const questionCol = headers.indexOf("question");
    const answerCol = headers.indexOf("answer");
    const keywordsCol = headers.indexOf("keywords");
    const statusCol = headers.indexOf("status");
    // Synonym map (expand as needed)
    const synonyms = {
      enroll: ["register", "admit", "apply"],
      tuition: ["fee", "payment"],
      freshman: ["new student", "first year"],
      schedule: ["timetable", "class time"],
      requirement: ["document", "paper", "needed"],
      scholarship: ["grant", "financial aid"],
      admission: ["entry", "application"],
      office: ["department", "section"]
    };
    // Helper: Levenshtein distance
    function levenshtein(a, b) {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      const v0 = Array(b.length + 1).fill(0);
      const v1 = Array(b.length + 1).fill(0);
      for (let i = 0; i <= b.length; i++) v0[i] = i;
      for (let i = 0; i < a.length; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < b.length; j++) {
          const cost = a[i] === b[j] ? 0 : 1;
          v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
      }
      return v1[b.length];
    }
    // Only consider approved FAQs
    let bestMatch = null;
    let highestScore = 0;
    let bestIdx = -1;
    const scored = [];
    for (let i = 1; i < data.length; i++) {
      const status = statusCol !== -1 ? (data[i][statusCol] || '').toLowerCase() : 'approved';
      if (status !== 'approved') continue;
      const faqQuestion = data[i][questionCol].toString().toLowerCase();
      const answer = data[i][answerCol];
      const keywords = data[i][keywordsCol] ? data[i][keywordsCol].toString().toLowerCase().split(',') : [];
      let score = 0;
      // Exact match
      if (question === faqQuestion) score += 100;
      // Fuzzy match (Levenshtein distance)
      const lev = levenshtein(question, faqQuestion);
      if (lev <= 3 && question.length > 5) score += 60 - lev * 10;
      // Partial match
      if (question.includes(faqQuestion) || faqQuestion.includes(question)) score += 40;
      // Keyword match
      for (const keyword of keywords) {
        if (keyword && question.includes(keyword.trim())) score += 20;
        // Synonym support
        for (const key in synonyms) {
          if (keyword && synonyms[key].includes(keyword.trim()) && question.includes(key)) score += 15;
          if (keyword && key === keyword.trim() && synonyms[key].some(syn => question.includes(syn))) score += 15;
        }
      }
      // Synonym in question vs FAQ question
      for (const key in synonyms) {
        if (faqQuestion.includes(key) && synonyms[key].some(syn => question.includes(syn))) score += 10;
        if (synonyms[key].some(syn => faqQuestion.includes(syn)) && question.includes(key)) score += 10;
      }
      // Store for suggestions
      scored.push({ idx: i, score, question: faqQuestion, answer });
      if (score > highestScore) {
        highestScore = score;
        bestMatch = answer;
        bestIdx = i;
      }
    }
    // Log the query regardless of match
    logActivity(username, "faq_query: " + question);
    // If a match was found with a score above threshold
    if (bestMatch && highestScore >= 50) {
      logConversation(username, question, bestMatch);
      Logger.log("FAQ match found with score: " + highestScore);
      return createJsonResponse({
        success: true,
        response: bestMatch
      });
    }
    // If no high-confidence match, suggest top 3 closest
    scored.sort((a, b) => b.score - a.score);
    const suggestions = scored.slice(0, 3).filter(s => s.score > 0).map(s => s.question);
    const defaultResponse = suggestions.length > 0
      ? "I'm not sure, but did you mean: " + suggestions.map(q => `\"${q}\"`).join(', ') + "?"
      : getDefaultResponse();
    logConversation(username, question, defaultResponse);
    Logger.log("No FAQ match found, suggesting: " + suggestions.join('; '));
    return createJsonResponse({
      success: true,
      response: defaultResponse,
      suggestions: suggestions
    });
  }
  
  // Log conversation to the Conversations sheet
  function handleLogConversation(params, sheet) {
    const username = params.username;
    const question = params.question;
    const answer = params.answer;
    
    Logger.log("Logging conversation for: " + username);
    
    // Log the conversation
    logConversation(username, question, answer);
    
    return createJsonResponse({
      success: true,
      message: "Conversation logged successfully"
    });
  }
  
  // Helper function to log conversation
  function logConversation(username, question, answer) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, "Conversations", ["timestamp", "username", "question", "answer"]);
    
    const timestamp = new Date().toISOString();
    sheet.appendRow([timestamp, username, question, answer]);
    Logger.log("Conversation logged at: " + timestamp);
  }
  
  // Helper function to log activity (with details and IP)
  function logActivity(username, action, details, ipAddress) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, "ActivityLog", ["timestamp", "username", "action", "details", "ipAddress"]);
    const timestamp = new Date().toISOString();
    sheet.appendRow([timestamp, username, action, details || "", ipAddress || ""]);
    Logger.log("Activity logged: " + action + " for " + username + " at " + timestamp);
  }
  
  // Handler for logging admin actions
  function handleLogActivity(params) {
    const username = params.username;
    const action = params.actionType;
    const details = params.details || "";
    const ipAddress = params.ipAddress || "";
    logActivity(username, action, details, ipAddress);
    return createJsonResponse({ success: true });
  }
  
  // Get a random default response
  function getDefaultResponse() {
    const defaultResponses = [
      "I'm sorry, I don't have that information yet. Please try asking another question or visit the university website for more details.",
      "I couldn't find an answer to that question. Would you like to ask something else?",
      "That information isn't in my database yet. Please try rephrasing your question or ask about another topic.",
      "I'm still learning! I don't have an answer for that yet. Can I help you with something else?"
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  }
  
  // Function to initialize the FAQ database with some example data
  function initializeFAQDatabase() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const faqSheet = getOrCreateSheet(ss, "FAQs", ["id", "question", "answer", "keywords"]);
    
    // Check if there's already data
    if (faqSheet.getLastRow() <= 1) {
      // Add sample FAQs
      const sampleFAQs = [
        [
          Utilities.getUuid(),
          "Where is the Admissions Office?",
          "The Admissions Office is located on the first floor of the Administration Building, to the right of the main entrance. It's open Monday through Friday from 8:00 AM to 5:00 PM.",
          "admissions,office,location,where,find"
        ],
        [
          Utilities.getUuid(), 
          "How do I enroll as a freshman?",
          "To enroll as a freshman at DHVSU, you need to: 1) Submit an online application through the university portal, 2) Take the entrance examination, 3) Submit required documents including Form 138, birth certificate, and good moral character certification, 4) Wait for acceptance letter, and 5) Complete the enrollment process by paying the fees and selecting your courses.",
          "enroll,enrollment,freshman,new student,application,registration"
        ],
        [
          Utilities.getUuid(),
          "What documents do I need for enrollment?",
          "For enrollment, you need: 1) Original and photocopy of Form 138 (Report Card), 2) Certificate of Good Moral Character, 3) NSO/PSA Birth Certificate, 4) 2x2 ID pictures (white background), 5) Barangay Clearance, and 6) Certificate of Residency.",
          "documents,requirements,papers,enrollment,form 138,birth certificate"
        ],
        [
          Utilities.getUuid(),
          "Where is the CICT building?",
          "The College of Information and Communications Technology (CICT) building is located at the north campus, behind the Engineering building. It's a three-story building with computer laboratories on each floor.",
          "CICT,building,location,computer,IT"
        ]
      ];
      
      // Add each FAQ to the sheet
      for (const faq of sampleFAQs) {
        faqSheet.appendRow(faq);
      }
      
      Logger.log("FAQs initialized successfully");
      return "FAQs initialized successfully";
    }
    
    Logger.log("FAQs already exist");
    return "FAQs already exist";
  }
  
  function handleForgotPassword(params, sheet) {
    const email = params.email;
    
    Logger.log("Processing forgot password for: " + email);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");
    const tokenCol = headers.indexOf("reset_token");
    const expiryCol = headers.indexOf("token_expiry");
    
    Logger.log("Sheet headers: " + JSON.stringify(headers));
    Logger.log("Email column index: " + emailCol);
    Logger.log("Token column index: " + tokenCol);
    Logger.log("Expiry column index: " + expiryCol);
    
    // Add this check for column indices
    if (emailCol === -1 || tokenCol === -1 || expiryCol === -1) {
      Logger.log("ERROR: Required columns missing in the Users sheet");
      return createJsonResponse({
        success: false,
        message: "Server configuration error. Please contact administrator."
      });
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailCol] === email) {
        // Generate token and expiry (1 hour from now)
        const token = Utilities.getUuid();
        const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        
        Logger.log("Generated token: " + token + " with expiry: " + expiry);
        sheet.getRange(i + 1, tokenCol + 1).setValue(token);
        sheet.getRange(i + 1, expiryCol + 1).setValue(expiry);
        
        // Send email with reset link
        const resetLink = "https://ren-code23.github.io/Honorian-Askbot/reset_password.html?token=" + token + "&email=" + encodeURIComponent(email);
        
        try {
          MailApp.sendEmail({
            to: email,
            subject: "DHVSU AskBot Password Reset",
            htmlBody: "Click <a href='" + resetLink + "'>here</a> to reset your password. This link will expire in 1 hour."
          });
          Logger.log("Password reset email sent to: " + email);
        } catch (emailError) {
          Logger.log("ERROR sending email: " + emailError.toString());
          return createJsonResponse({
            success: false,
            message: "Error sending email: " + emailError.toString()
          });
        }
        
        // Log the password reset request
        logActivity(email, "password_reset_requested");
        
        return createJsonResponse({
          success: true,
          message: "Password reset link sent to your email."
        });
      }
    }
    
    Logger.log("Email not found: " + email);
    return createJsonResponse({
      success: false,
      message: "Email not found."
    });
  }
  
  function handleResetPassword(params, sheet) {
    const email = params.email;
    const token = params.token;
    const newPassword = params.password; // Already hashed from client-side
    
    Logger.log("Processing reset password for email: " + email);
    Logger.log("Token provided: " + (token ? "YES" : "NO"));
    Logger.log("New password provided: " + (newPassword ? "YES" : "NO"));
    
    // Validate required parameters
    if (!email || !token || !newPassword) {
      Logger.log("ERROR: Missing required parameters for reset password");
      return createJsonResponse({
        success: false,
        message: "Missing required parameters. Email, token and password are required."
      });
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");
    const tokenCol = headers.indexOf("reset_token");
    const expiryCol = headers.indexOf("token_expiry");
    const passwordCol = headers.indexOf("password");
    
    Logger.log("Sheet headers: " + JSON.stringify(headers));
    Logger.log("Email column index: " + emailCol);
    Logger.log("Token column index: " + tokenCol);
    Logger.log("Expiry column index: " + expiryCol);
    Logger.log("Password column index: " + passwordCol);
    
    // Add this check for column indices
    if (emailCol === -1 || tokenCol === -1 || expiryCol === -1 || passwordCol === -1) {
      Logger.log("ERROR: Required columns missing in the Users sheet");
      return createJsonResponse({
        success: false,
        message: "Server configuration error. Please contact administrator."
      });
    }
    
    let userFound = false;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailCol] === email) {
        userFound = true;
        Logger.log("User found with matching email");
        Logger.log("Stored token: " + data[i][tokenCol]);
        Logger.log("Token match: " + (data[i][tokenCol] === token));
        
        if (data[i][tokenCol] === token) {
          // Check if token has expired
          const tokenExpiry = new Date(data[i][expiryCol]);
          const now = new Date();
          
          Logger.log("Token expiry: " + tokenExpiry);
          Logger.log("Current time: " + now);
          Logger.log("Token expired: " + (now > tokenExpiry));
          
          if (now > tokenExpiry) {
            Logger.log("Token expired");
            return createJsonResponse({
              success: false,
              message: "Reset link expired."
            });
          }
          
          // Update password and clear token/expiry
          sheet.getRange(i + 1, passwordCol + 1).setValue(newPassword);
          sheet.getRange(i + 1, tokenCol + 1).setValue("");
          sheet.getRange(i + 1, expiryCol + 1).setValue("");
          
          // Log the successful password reset
          logActivity(email, "password_reset_successful");
          
          Logger.log("Password reset successful for: " + email);
          return createJsonResponse({
            success: true,
            message: "Password reset successful."
          });
        } else {
          Logger.log("Invalid token for user: " + email);
          return createJsonResponse({
            success: false,
            message: "Invalid token."
          });
        }
      }
    }
    
    if (!userFound) {
      Logger.log("Email not found: " + email);
    }
    
    return createJsonResponse({
      success: false,
      message: "Invalid token or email."
    });
  }
  
  // New handler function to get all FAQs
  function handleGetFAQs(sheet, isAdmin) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const faqs = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { // Check if there's an ID
        const faq = {
          id: data[i][headers.indexOf("id")],
          question: data[i][headers.indexOf("question")],
          answer: data[i][headers.indexOf("answer")],
          keywords: data[i][headers.indexOf("keywords")] || "",
          status: data[i][headers.indexOf("status")] || "approved",
          category: data[i][headers.indexOf("category")] || "general",
          priority: data[i][headers.indexOf("priority")] || 3
        };
        
        // Only include approved FAQs for non-admin users
        if (isAdmin || faq.status === "approved") {
          faqs.push(faq);
        }
      }
    }
    
    return createJsonResponse({
      success: true,
      faqs: faqs
    });
  }
  
  // New handler function to add a new FAQ
  function handleAddFAQ(params, sheet) {
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    sheet.appendRow([
      id,
      params.question,
      params.answer,
      params.keywords || "",
      params.status || "pending",
      params.category || "general",
      params.priority || 3
    ]);
    
    return createJsonResponse({
      success: true,
      message: "FAQ added successfully"
    });
  }
  
  // New handler function to edit an existing FAQ
  function handleEditFAQ(params, sheet) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf("id");
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === params.id) {
        sheet.getRange(i + 1, headers.indexOf("question") + 1).setValue(params.question);
        sheet.getRange(i + 1, headers.indexOf("answer") + 1).setValue(params.answer);
        sheet.getRange(i + 1, headers.indexOf("keywords") + 1).setValue(params.keywords || "");
        sheet.getRange(i + 1, headers.indexOf("status") + 1).setValue(params.status || "pending");
        sheet.getRange(i + 1, headers.indexOf("category") + 1).setValue(params.category || "general");
        sheet.getRange(i + 1, headers.indexOf("priority") + 1).setValue(params.priority || 3);
        
        return createJsonResponse({
          success: true,
          message: "FAQ updated successfully"
        });
      }
    }
    
    return createJsonResponse({
      success: false,
      message: "FAQ not found"
    });
  }
  
  // New handler function to delete an FAQ
  function handleDeleteFAQ(params, sheet) {
    Logger.log("Deleting FAQ with ID: " + params.id);
    
    // Validate required parameters
    if (!params.id) {
      Logger.log("ERROR: Missing FAQ ID for deletion");
      return createJsonResponse({
        success: false,
        message: "FAQ ID is required."
      });
    }
    
    const id = params.id;
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf("id");
    
    // Find and delete the FAQ
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === id) {
        sheet.deleteRow(i + 1);
        
        Logger.log("FAQ deleted successfully with ID: " + id);
        return handleGetFAQs(sheet, true);
      }
    }
    
    // If FAQ not found
    Logger.log("ERROR: FAQ with ID " + id + " not found for deletion");
    return createJsonResponse({
      success: false,
      message: "FAQ not found."
    });
  }
  
  // Get all feedback
  function handleGetFeedback(sheet) {
    Logger.log("Getting all feedback entries");
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const feedbacks = [];
    
    for (let i = 1; i < data.length; i++) {
      feedbacks.push({
        timestamp: data[i][headers.indexOf("timestamp")],
        username: data[i][headers.indexOf("username")],
        message: data[i][headers.indexOf("message")],
        feedbackType: data[i][headers.indexOf("feedbackType")]
      });
    }
    
    Logger.log("Retrieved " + feedbacks.length + " feedback entries");
    return createJsonResponse({ 
      success: true, 
      feedbacks 
    });
  }
  
  // Get all logs
  function handleGetLogs(sheet) {
    Logger.log("Getting all activity logs");
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const logs = [];
    
    for (let i = 1; i < data.length; i++) {
      logs.push({
        timestamp: data[i][headers.indexOf("timestamp")],
        username: data[i][headers.indexOf("username")],
        action: data[i][headers.indexOf("action")],
        details: data[i][headers.indexOf("details")],
        ipAddress: data[i][headers.indexOf("ipAddress")]
      });
    }
    
    Logger.log("Retrieved " + logs.length + " log entries");
    return createJsonResponse({ 
      success: true, 
      logs 
    });
  }
  
  function handleGetUsers(sheet) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const users = [];
    for (let i = 1; i < data.length; i++) {
      users.push({
        id: data[i][headers.indexOf("id")],
        username: data[i][headers.indexOf("username")],
        email: data[i][headers.indexOf("email")],
        dateCreated: data[i][headers.indexOf("dateCreated")]
      });
    }
    return createJsonResponse({ success: true, users });
  }
  
  // Add Analytics Handler
  function handleGetAnalytics(faqSheet, feedbackSheet) {
    // Most asked questions (simulate with FAQ counts)
    const faqData = faqSheet.getDataRange().getValues();
    const faqHeaders = faqData[0];
    const questionCol = faqHeaders.indexOf("question");
    const questionCounts = {};
    for (let i = 1; i < faqData.length; i++) {
        const q = faqData[i][questionCol];
        questionCounts[q] = (questionCounts[q] || 0) + 1;
    }
    // Prepare for chart.js
    const faqPerformance = {
        labels: Object.keys(questionCounts),
        data: Object.values(questionCounts)
    };

    // Feedback summary (simulate with positive/negative)
    const feedbackData = feedbackSheet.getDataRange().getValues();
    const feedbackHeaders = feedbackData[0];
    const typeCol = feedbackHeaders.indexOf("feedbackType");
    let helpful = 0, notHelpful = 0;
    for (let i = 1; i < feedbackData.length; i++) {
        if (feedbackData[i][typeCol] === "positive") helpful++;
        else if (feedbackData[i][typeCol] === "negative") notHelpful++;
    }
    // Ratings for pie chart (simulate as [helpful, notHelpful, 0, 0, 0])
    const ratings = [helpful, notHelpful, 0, 0, 0];

    // User activity (simulate as random data)
    const userActivity = {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        data: [5, 8, 6, 10, 7, 3, 2]
    };

    return createJsonResponse({
        success: true,
        analytics: {
            userActivity,
            faqPerformance,
            ratings
        }
    });
  }
  
  // User Profile Management Handlers
  function handleGetUserProfile(sheet, username) {
    Logger.log("Getting user profile for: " + username);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf("username");
    const emailCol = headers.indexOf("email");
    const dateCreatedCol = headers.indexOf("dateCreated");
    const profilePicCol = headers.indexOf("profile_pic");
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === username) {
        return createJsonResponse({
          success: true,
          profile: {
            username: data[i][usernameCol],
            email: data[i][emailCol],
            dateCreated: data[i][dateCreatedCol],
            profilePic: data[i][profilePicCol] || ""
          }
        });
      }
    }
    
    return createJsonResponse({
      success: false,
      message: "User not found"
    });
  }

  function handleUpdateUserProfile(sheet, params) {
    Logger.log("Updating user profile for: " + params.username);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf("username");
    const emailCol = headers.indexOf("email");
    const profilePicCol = headers.indexOf("profile_pic");
    
    // Validate required columns
    if (usernameCol === -1 || emailCol === -1) {
      return createJsonResponse({
        success: false,
        message: "Server configuration error"
      });
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === params.username) {
        // Update email if provided
        if (params.email) {
          sheet.getRange(i + 1, emailCol + 1).setValue(params.email);
        }
        
        // Update profile picture if provided
        if (params.profilePic) {
          if (profilePicCol === -1) {
            // Add profile_pic column if it doesn't exist
            sheet.insertColumnAfter(headers.length);
            sheet.getRange(1, headers.length + 1).setValue("profile_pic");
            sheet.getRange(i + 1, headers.length + 1).setValue(params.profilePic);
          } else {
            sheet.getRange(i + 1, profilePicCol + 1).setValue(params.profilePic);
          }
        }
        
        // Log the profile update
        logActivity(params.username, "profile_updated");
        
        return createJsonResponse({
          success: true,
          message: "Profile updated successfully"
        });
      }
    }
    
    return createJsonResponse({
      success: false,
      message: "User not found"
    });
  }

  function handleUploadProfilePic(params) {
    Logger.log("Processing profile picture upload (no Google Drive, just return URL)");
    try {
      const imageUrl = params.imageUrl;
      if (!imageUrl) {
        return createJsonResponse({
          success: false,
          message: "No image URL provided"
        });
      }
      return createJsonResponse({
        success: true,
        imageUrl: imageUrl
      });
    } catch (error) {
      Logger.log("ERROR uploading profile picture: " + error.toString());
      return createJsonResponse({
        success: false,
        message: "Error uploading profile picture: " + error.toString()
      });
    }
  }
  
  // Add this new function for handling user chat history
  function handleGetUserChatHistory(params, sheet) {
    Logger.log("Getting chat history for user: " + params.username);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf("username");
    const timestampCol = headers.indexOf("timestamp");
    const questionCol = headers.indexOf("question");
    const answerCol = headers.indexOf("answer");
    
    // Validate required columns
    if (usernameCol === -1 || timestampCol === -1 || questionCol === -1 || answerCol === -1) {
      Logger.log("ERROR: Required columns missing in Conversations sheet");
      return createJsonResponse({
        success: false,
        message: "Server configuration error"
      });
    }
    
    // Filter conversations for this user
    const userHistory = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === params.username) {
        userHistory.push({
          timestamp: data[i][timestampCol],
          question: data[i][questionCol],
          answer: data[i][answerCol]
        });
      }
    }
    
    Logger.log("Found " + userHistory.length + " conversations for user");
    return createJsonResponse({
      success: true,
      history: userHistory
    });
  }
  
  function handleGetAllUsers(sheet) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const users = [];
    for (let i = 1; i < data.length; i++) {
      users.push({
        id: data[i][headers.indexOf("id")],
        username: data[i][headers.indexOf("username")],
        email: data[i][headers.indexOf("email")],
        dateCreated: data[i][headers.indexOf("dateCreated")],
        role: data[i][headers.indexOf("role")] || "student"
      });
    }
    return createJsonResponse({ success: true, users });
  }
  
  function handleGetAdminStats(userSheet, faqSheet, chatSheet) {
    const totalUsers = userSheet.getLastRow() - 1;
    const totalFAQs = faqSheet.getLastRow() - 1;
    const totalChats = chatSheet.getLastRow() - 1;
    return createJsonResponse({
      success: true,
      stats: {
        totalUsers,
        totalFAQs,
        totalChats
      }
    });
  }
  
  function handleDeleteUser(params, sheet) {
    const username = params.username;
    Logger.log("Deleting user: " + username);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf("username");
    if (usernameCol === -1) {
      return createJsonResponse({ success: false, message: "Username column not found." });
    }
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === username) {
        sheet.deleteRow(i + 1);
        Logger.log("User deleted: " + username);
        return createJsonResponse({ success: true, message: "User deleted successfully." });
      }
    }
    Logger.log("User not found for deletion: " + username);
    return createJsonResponse({ success: false, message: "User not found." });
  }
  
  function handleUpdateUser(params, sheet) {
    const username = params.username;
    const email = params.email;
    const role = params.role;
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf("username");
    const emailCol = headers.indexOf("email");
    const roleCol = headers.indexOf("role");
    if (usernameCol === -1 || emailCol === -1 || roleCol === -1) {
      return createJsonResponse({ success: false, message: "Required columns not found." });
    }
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === username) {
        if (email) sheet.getRange(i + 1, emailCol + 1).setValue(email);
        if (role) sheet.getRange(i + 1, roleCol + 1).setValue(role);
        Logger.log("User updated: " + username);
        return createJsonResponse({ success: true, message: "User updated successfully." });
      }
    }
    return createJsonResponse({ success: false, message: "User not found." });
  }
  
  function handleLogFeedback(params, sheet) {
    const timestamp = new Date().toISOString();
    const username = params.username || '';
    const message = params.message || '';
    const feedbackType = params.feedbackType || '';
    const comment = params.comment || '';
    const headers = sheet.getDataRange().getValues()[0];
    // Add 'comment' column if missing
    if (headers.indexOf('comment') === -1) {
      sheet.insertColumnAfter(headers.length);
      sheet.getRange(1, headers.length + 1).setValue('comment');
    }
    sheet.appendRow([timestamp, username, message, feedbackType, comment]);
    Logger.log("Feedback logged: " + username + " - " + feedbackType + (comment ? " - " + comment : ""));
    return createJsonResponse({ success: true, message: "Feedback logged successfully." });
  }
  
  // --- Utility: Ensure all required columns exist in a sheet ---
  function ensureSheetColumns(sheet, requiredHeaders) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    let changed = false;
    for (let i = 0; i < requiredHeaders.length; i++) {
      if (headers.indexOf(requiredHeaders[i]) === -1) {
        sheet.insertColumnAfter(headers.length + i);
        sheet.getRange(1, headers.length + i + 1).setValue(requiredHeaders[i]);
        changed = true;
      }
    }
    return changed;
  }
  
  // Defensive: Ensure FAQ headers before every operation
  function ensureFAQHeaders(sheet) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const requiredHeaders = ["id", "question", "answer", "keywords", "status", "category", "priority"];
    
    // Add missing headers
    requiredHeaders.forEach((header, index) => {
      if (!headers.includes(header)) {
        sheet.getRange(1, headers.length + 1).setValue(header);
      }
    });
  }
  
  // --- Utility: Remove Duplicate FAQs by Question ---
  function removeDuplicateFAQs() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("FAQs");
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var questionCol = headers.indexOf("question");
    
    var seen = {};
    var duplicateRows = [];
    
    for (var i = 1; i < data.length; i++) {
      var question = (data[i][questionCol] || "").toLowerCase().trim();
      if (question in seen) {
        duplicateRows.push(i + 1);
      } else {
        seen[question] = true;
      }
    }
    
    for (var i = duplicateRows.length - 1; i >= 0; i--) {
      sheet.deleteRow(duplicateRows[i]);
    }
    
    if (duplicateRows.length > 0) {
      SpreadsheetApp.getUi().alert(duplicateRows.length + " duplicate FAQs removed!");
    } else {
      SpreadsheetApp.getUi().alert("No duplicate FAQs found.");
    }
  }

  // --- Utility: Bulk Import FAQs (avoids duplicates) ---
  function bulkImportFAQs() {
    // Remove duplicates first
    removeDuplicateFAQs();
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("FAQs");
    if (!sheet) {
      sheet = ss.insertSheet("FAQs");
      sheet.appendRow(["id", "question", "answer", "keywords", "status", "category", "priority"]);
    }
    
    var existingData = sheet.getDataRange().getValues();
    var headers = existingData[0];
    var questionCol = headers.indexOf("question");
    var existingQuestions = existingData.slice(1).map(row => (row[questionCol] || "").toLowerCase().trim());
    
    var data = [
      {
        question: "Can subjects taken from a private school be credited at DHVSU?",
        answer: "Yes, subjects taken from a private school may be credited at DHVSU, depending on the curriculum and subject equivalency. Please consult the Registrar's Office for evaluation and further guidance.",
        keywords: "credit, private school, subjects, transfer, registrar",
        status: "approved",
        category: "registrar",
        priority: 2
      },
      {
        question: "When will diplomas be released for graduates?",
        answer: "Diplomas for graduates are now available for release. Please visit the Office of the Registrar to claim your diploma. Bring a valid ID for verification.",
        keywords: "diploma, release, graduates, registrar, claim",
        status: "approved",
        category: "registrar",
        priority: 1
      },
      {
        question: "How can I request a Transcript of Records (TOR)?",
        answer: "To request a Transcript of Records (TOR), first secure your clearance from the Accounting Office. Then, proceed to the Office of the Registrar to fill out the TOR request form and pay the required fees.",
        keywords: "transcript, TOR, records, request, registrar, clearance",
        status: "approved",
        category: "registrar",
        priority: 1
      },
      // --- Office of Admissions ---
      {
        question: "When will enrollment for the next academic year begin?",
        answer: "The schedule for enrollment for the next academic year has not been announced yet. Please refer to the DHVSU Admissions Office for official updates and further information.",
        keywords: "enrollment, schedule, admissions, academic year, updates",
        status: "approved",
        category: "admissions",
        priority: 1
      },
      {
        question: "What are the requirements for enrollment and transferring to DHVSU?",
        answer: "For detailed information on enrollment and transfer requirements to DHVSU, please refer to the DHVSU Admissions Office Facebook page or contact the Admissions Office directly.",
        keywords: "requirements, enrollment, transfer, admissions, documents",
        status: "approved",
        category: "admissions",
        priority: 1
      },
      {
        question: "What is the process for transferring from the Main Campus to a Regular Campus or vice versa?",
        answer: "To transfer from the Main Campus to a Regular Campus or vice versa, visit the Office of Admissions to acquire the necessary form for changing campuses and follow the provided instructions.",
        keywords: "transfer, main campus, regular campus, admissions, process",
        status: "approved",
        category: "admissions",
        priority: 2
      },
      // --- MIS Office (Student Services) ---
      {
        question: "How can I get technical support for my Student Portal or DHVSU Google account?",
        answer: "If you are experiencing technical issues with the Student Portal or your @dhvsu Google account, please fill out the Online Student Help Desk form or contact the MIS Office for assistance.",
        keywords: "technical support, student portal, Google account, MIS Office, help desk",
        status: "approved",
        category: "student-services",
        priority: 1
      },
      // --- Department Related (Academics) ---
      {
        question: "Can I take additional units for another course if I have already graduated from a different program?",
        answer: "If you wish to take additional units after graduating from a different program, please coordinate with the chairperson of your respective college. The evaluation process may vary depending on college policies.",
        keywords: "additional units, second course, graduate, college chairperson, academics",
        status: "approved",
        category: "academics",
        priority: 2
      },
      {
        question: "Can irregular students still enroll after the official enrollment period?",
        answer: "Irregular students who wish to enroll after the official enrollment period should coordinate with their respective college for further guidance and approval.",
        keywords: "irregular students, late enrollment, college, academics",
        status: "approved",
        category: "academics",
        priority: 2
      },
      // --- General ---
      {
        question: "What are the office hours of all university offices?",
        answer: "University offices are generally open from 8:00 AM to 5:00 PM, Monday to Friday.",
        keywords: "office hours, schedule, university, offices, open, close",
        status: "approved",
        category: "general",
        priority: 2
      },
      {
        question: "How can I apply for a scholarship at DHVSU?",
        answer: "Scholarship applications are currently unavailable and will start next year, mostly through CHED. Please stay updated for announcements.",
        keywords: "scholarship, application, CHED, financial aid, grant",
        status: "approved",
        category: "general",
        priority: 2
      },
      {
        question: "How can students avail of dental clinic services?",
        answer: "To access dental clinic services, students should visit the Medical and Dental Clinic on campus, located near the College of Business Studies.",
        keywords: "dental clinic, medical, health, services, students",
        status: "approved",
        category: "student-services",
        priority: 3
      },
      // --- Certificates and Records ---
      {
        question: "How to get Certificate of Enrollment/Registration?",
        answer: "After submitting all the necessary documents during enrollment, the student may request his or her COE or COR from the office of the University Registrar. A copy of the student's COE or COR will be available in his or her portal account.",
        keywords: "certificate, enrollment, registration, COE, COR, registrar",
        status: "approved",
        category: "registrar",
        priority: 2
      },
      {
        question: "How to get Certificate of Grades?",
        answer: "The student may request a Certificate of Grades (COG) one (1) week after the opening of classes. The class mayor will be the one to give the list of his or her classmates who want to request a COG from the Office of the University Registrar. Payment: 50 pesos for the request of COG; 50 pesos for the documentary stamp from MultiPurpose Cooperative.",
        keywords: "certificate, grades, COG, registrar, payment, documentary stamp",
        status: "approved",
        category: "registrar",
        priority: 2
      },
      {
        question: "How to get Transcript of Record?",
        answer: "The student may go directly to the Office of the University Registrar to request his or her TOR. It may take awhile (on the same day or 2-3 days) before the request is released. Payment: 110 pesos per page; 50 pesos for the documentary stamp from the Multi-Purpose Cooperative. Note: The TOR and Diploma of the graduates are free for the 1st request.",
        keywords: "transcript, TOR, records, registrar, payment, documentary stamp, diploma",
        status: "approved",
        category: "registrar",
        priority: 2
      },
      {
        question: "How to get a Good Moral?",
        answer: "The student may request his or her Good Moral from the office of the Guidance & Testing Center. Purpose of Request: Enrollment, Scholarship, Transfer to Another school, College Application, Employment, PRC Board Examination, and other Legal Purposes it may serve. Payment: 50 pesos for the request of Good Moral with a dry seal; 50 pesos for the documentary stamp from the Multi-Purpose Cooperative.",
        keywords: "good moral, guidance, testing center, certificate, payment, documentary stamp",
        status: "approved",
        category: "student-services",
        priority: 3
      },
      {
        question: "How to validate my ID?",
        answer: "The student may validate his or her ID upon the start of classes or semester. The student shall bring a hard copy of his or her latest COR to the office of the Student Affairs.",
        keywords: "ID validation, student affairs, COR, classes, semester",
        status: "approved",
        category: "student-services",
        priority: 3
      },
      {
        question: "Will there be a grace period for freshman students to wear their complete uniform?",
        answer: "Please refer to the approved policy of the council regarding the grace period for wearing the complete uniform.",
        keywords: "grace period, uniform, freshman, policy, council",
        status: "approved",
        category: "general",
        priority: 3
      },
      // --- General Information ---
      {
        question: "What is the vision of DHVSU?",
        answer: "DHVSU envisions becoming one of the leading universities in the ASEAN Region, producing globally competitive professionals capable of creating, applying, and transferring knowledge and technology for the sustainable development of humanity and society.",
        keywords: "vision, DHVSU, university, future, ASEAN, global",
        status: "approved",
        category: "general",
        priority: 4
      },
      {
        question: "What is the mission of DHVSU?",
        answer: "DHVSU is committed to providing a conducive environment for the holistic development of students, enabling them to become globally competitive professionals through quality instruction and services, innovation, and research—aimed at the sustainable development of society.",
        keywords: "mission, DHVSU, development, students, instruction, research",
        status: "approved",
        category: "general",
        priority: 4
      },
      {
        question: "What is the tagline of DHVSU?",
        answer: "Shaping Minds, Advancing Technologies, and Creating Brighter Futures",
        keywords: "tagline, DHVSU, slogan, motto, future",
        status: "approved",
        category: "general",
        priority: 5
      },
      {
        question: "What does DHVSU value in terms of professionalism?",
        answer: "DHVSU values committed, hardworking, dynamic, and socially responsible individuals who uphold integrity and dedication in their professional conduct.",
        keywords: "values, professionalism, DHVSU, integrity, dedication",
        status: "approved",
        category: "general",
        priority: 5
      },
      {
        question: "How does DHVSU practice good governance?",
        answer: "DHVSU promotes good governance by fostering a transparent, responsive, and accountable community of professionals.",
        keywords: "good governance, DHVSU, transparency, accountability, community",
        status: "approved",
        category: "general",
        priority: 5
      },
      {
        question: "What does 'excellence' mean at DHVSU?",
        answer: "At DHVSU, excellence means achieving high-level performance through productivity, creativity, innovation, and global competitiveness.",
        keywords: "excellence, DHVSU, performance, innovation, competitiveness",
        status: "approved",
        category: "general",
        priority: 5
      },
      {
        question: "What is DHVSU's stance on gender sensitivity and responsiveness?",
        answer: "DHVSU is committed to promoting gender sensitivity and responsiveness by ensuring inclusivity, respect, and equal opportunities for all genders in its policies, programs, and activities.",
        keywords: "gender sensitivity, responsiveness, inclusivity, DHVSU, equality",
        status: "approved",
        category: "general",
        priority: 5
      },
      {
        question: "How does DHVSU ensure disaster resiliency?",
        answer: "DHVSU upholds disaster resiliency by preparing its community to effectively respond to emergencies and natural disasters through proactive planning, awareness, and sustainable practices.",
        keywords: "disaster resiliency, DHVSU, emergencies, planning, sustainability",
        status: "approved",
        category: "general",
        priority: 5
      },
      // --- Sustainable Development Goals ---
      {
        question: "What are the Sustainable Development Goals (SDGs) promoted by DHVSU?",
        answer: "DHVSU supports the United Nations' 17 Sustainable Development Goals (SDGs) to contribute to global and local sustainable development through education, innovation, and social responsibility.",
        keywords: "SDGs, sustainable development, DHVSU, United Nations, goals",
        status: "approved",
        category: "general",
        priority: 5
      },
      {
        question: "What specific sustainable goals does DHVSU support?",
        answer: "DHVSU supports the following SDGs: No Poverty, Zero Hunger, Good Health and Well-being, Quality Education, Gender Equality, Clean Water and Sanitation, Affordable and Clean Energy, Decent Work and Economic Growth, Industry Innovation and Infrastructure, Reduced Inequalities, Sustainable Cities and Communities, Responsible Consumption and Production, Climate Action, Life Below Water, Life on Land, Peace Justice and Strong Institutions, Partnerships for the Goals.",
        keywords: "SDGs, sustainable goals, DHVSU, United Nations, support",
        status: "approved",
        category: "general",
        priority: 5
      },
      {
        question: "How does DHVSU contribute to these sustainable goals?",
        answer: "DHVSU contributes through research, student engagement, community extension programs, innovation, and integrating sustainability practices across its academic and operational initiatives.",
        keywords: "SDGs, sustainable goals, DHVSU, contribution, research, sustainability",
        status: "approved",
        category: "general",
        priority: 5
      },
      // --- Administrations ---
      {
        question: "Who is the Chairperson of DHVSU?",
        answer: "The Chairperson of DHVSU is Hon. Desiderio R. Apag III.",
        keywords: "chairperson, DHVSU, administration, board",
        status: "approved",
        category: "administration",
        priority: 2
      },
      {
        question: "Who is the Vice-Chairperson of DHVSU?",
        answer: "The Vice-Chairperson of DHVSU is Hon. Enrique G. Baking.",
        keywords: "vice-chairperson, DHVSU, administration, board",
        status: "approved",
        category: "administration",
        priority: 2
      },
      {
        question: "Who are the members of the DHVSU Board?",
        answer: "The members of the DHVSU Board include: Hon. Alan Peter Schramm Cayetano, Hon. Teodoro M. Gatchalian, Hon. Mark O. Go, Hon. Aurelio D. Gonzales, Jr., Hon. Nerrisa T. Esguerra, Hon. Julius Ceasar V. Sicat, Hon. Mariefel F. Capili, Hon. Esperanza F. Salinas, Hon. Missy Ruela C. Cortez.",
        keywords: "board members, DHVSU, administration, board",
        status: "approved",
        category: "administration",
        priority: 2
      },
      {
        question: "Who is the Secretary of the DHVSU Board?",
        answer: "The Secretary of the DHVSU Board is Dr. Ranie B. Canlas.",
        keywords: "secretary, DHVSU, administration, board",
        status: "approved",
        category: "administration",
        priority: 2
      },
      {
        question: "Who is the University President of DHVSU?",
        answer: "The University President is Dr. Enrique G. Baking.",
        keywords: "university president, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 1
      },
      {
        question: "Who is the Executive Vice President of DHVSU?",
        answer: "Engr. Reden M. Hernandez serves as the Executive Vice President, Vice President for Administration and Finance, and concurrent Vice President for Academic Affairs.",
        keywords: "executive vice president, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 2
      },
      {
        question: "Who is the Vice President for Research, Innovation, Training, and Extension at DHVSU?",
        answer: "Dr. Ranie B. Canlas holds this position and also serves as OIC-Director, Procurement Management Office; Executive Assistant to the President; and Acting University and Board Secretary.",
        keywords: "vice president, research, innovation, training, extension, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 2
      },
      {
        question: "Who is the Vice President for Student Affairs and Services?",
        answer: "Dr. Dolores T. Quiambao also concurrently serves as Dean, Graduate School and Director, GAD Focal Point System.",
        keywords: "vice president, student affairs, services, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 2
      },
      {
        question: "Who is the Director of the Planning and Development Office?",
        answer: "Dr. Eddiebal P. Layco is the Director of the Planning and Development Office.",
        keywords: "director, planning, development, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Director of the Public Relations and Linkages Office?",
        answer: "Ms. Kathleya Vianca P. Habon is the Director of the Public Relations and Linkages Office.",
        keywords: "director, public relations, linkages, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Director of the Finance Management Services Office?",
        answer: "Dr. Luis M. Lansang is the Director of the Finance Management Services Office.",
        keywords: "director, finance, management, services, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Director of the Property and Supply Management Office?",
        answer: "Arch. Mair S. De Lara is the Director of the Property and Supply Management Office.",
        keywords: "director, property, supply, management, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Dean of the College of Engineering and Architecture?",
        answer: "Engr. Jun P. Flores is the Dean of the College of Engineering and Architecture.",
        keywords: "dean, college, engineering, architecture, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Who is the Director of the Porac Campus?",
        answer: "Asst. Prof. Dennis V. Dizon is the Director of the Porac Campus.",
        keywords: "director, Porac campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the University Registrar?",
        answer: "Dr. Dolores Mallari is the University Registrar.",
        keywords: "university registrar, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 2
      },
      {
        question: "Who is the Director of the Research Management Office?",
        answer: "Dr. Robin B. Dimla is the Director of the Research Management Office.",
        keywords: "director, research management, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Director of the Data Privacy Office?",
        answer: "Dr. Jayson G. Magat (OIC) is the Director of the Data Privacy Office.",
        keywords: "director, data privacy, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Director of the Office of Student Affairs?",
        answer: "Dr. Gloria B. Gigante is the Director of the Office of Student Affairs.",
        keywords: "director, student affairs, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Director of the National Service Training Program (NSTP)?",
        answer: "Ar. Alvin C. Abata is the Director of the National Service Training Program (NSTP).",
        keywords: "director, NSTP, national service training, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the President of the DHVSU Faculty Association?",
        answer: "Ms. Mariefel F. Capili is the President of the DHVSU Faculty Association.",
        keywords: "president, faculty association, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the President of the University Student Council?",
        answer: "Ms. Missy Ruela C. Cortez is the President of the University Student Council.",
        keywords: "president, student council, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the President of the Non-Academic Staff Association?",
        answer: "Dr. Philip Rafael G. Malate is the President of the Non-Academic Staff Association.",
        keywords: "president, non-academic staff, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      // --- Academics (Colleges and Schools) ---
      {
        question: "What colleges and schools are located at the DHVSU Main Campus?",
        answer: "The DHVSU Main Campus hosts the following academic units: School of Law, Graduate School, College of Arts and Sciences, College of Business Studies, College of Computing Studies, College of Education, College of Engineering and Architecture, College of Hospitality and Tourism Management, College of Industrial Technology, College of Social Sciences and Philosophy, Laboratory High School, Senior High School.",
        keywords: "colleges, schools, main campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 2
      },
      {
        question: "Where is the School of Law located?",
        answer: "The School of Law is located at the DHVSU Main Campus.",
        keywords: "school of law, location, main campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Does DHVSU have a Graduate School?",
        answer: "Yes, the Graduate School is located at the DHVSU Main Campus and offers advanced academic programs for graduate students.",
        keywords: "graduate school, main campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "What programs are offered by the College of Arts and Sciences?",
        answer: "The College of Arts and Sciences at the Main Campus offers a variety of undergraduate programs in humanities, natural sciences, and social sciences.",
        keywords: "college of arts and sciences, programs, main campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "What is the focus of the College of Business Studies?",
        answer: "The College of Business Studies focuses on commerce, finance, management, and entrepreneurship programs.",
        keywords: "college of business studies, focus, programs, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "What degrees are available at the College of Education?",
        answer: "The College of Education offers programs for aspiring teachers and education professionals in various fields.",
        keywords: "college of education, degrees, programs, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "What is the College of Computing Studies known for?",
        answer: "It specializes in computer science, information systems, and information technology programs.",
        keywords: "college of computing studies, computer science, IT, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "What programs are under the College of Engineering and Architecture?",
        answer: "This college provides degrees in civil, electrical, mechanical engineering, and architecture.",
        keywords: "college of engineering and architecture, programs, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "What is offered by the College of Hospitality and Tourism Management?",
        answer: "This college offers programs related to hospitality management, tourism, and hotel/restaurant operations.",
        keywords: "college of hospitality and tourism management, programs, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "What does the College of Industrial Technology focus on?",
        answer: "It delivers technical-vocational and industrial skills-based degree programs.",
        keywords: "college of industrial technology, focus, programs, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "What areas of study are available at the College of Social Sciences and Philosophy?",
        answer: "This college provides courses in psychology, philosophy, sociology, political science, and related fields.",
        keywords: "college of social sciences and philosophy, areas of study, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Does DHVSU have a Laboratory High School?",
        answer: "Yes, the Laboratory High School is part of the Main Campus and provides secondary education, often used as a training ground for education students.",
        keywords: "laboratory high school, main campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Is there a Senior High School at the DHVSU Main Campus?",
        answer: "Yes, DHVSU offers a Senior High School program at the Main Campus with academic and technical-vocational strands.",
        keywords: "senior high school, main campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      // --- Mexico Campus ---
      {
        question: "What programs are offered at the DHVSU Mexico Campus?",
        answer: "The DHVSU Mexico Campus offers the following degree programs: Bachelor of Science in Accountancy, Bachelor of Science in Business Administration (Specialization in Marketing), Bachelor of Science in Information Technology, Bachelor of Elementary Education (Specialization in General Education), Bachelor of Secondary Education (Specialization in English and Filipino), Bachelor in Physical Education, Bachelor of Science in Industrial Technology (Specializations: Automotive Technology, Electrical Technology, Food and Service Management, Graphics Technology), Bachelor of Technical and Livelihood Education (Specialization in Home Economics), and Bachelor of Science in Hospitality Management.",
        keywords: "Mexico campus, programs, degree, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Who is the Director of DHVSU Mexico Campus?",
        answer: "The Director of DHVSU Mexico Campus is Dr. Vicky P. Vital, EdD.",
        keywords: "director, Mexico campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Area Chairperson at the Mexico Campus?",
        answer: "The Area Chairperson at the Mexico Campus is Mr. Mark Jameson E. Perez, MAEd.",
        keywords: "area chairperson, Mexico campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "How can I contact DHVSU Mexico Campus?",
        answer: "You can contact DHVSU Mexico Campus via email at mexicocampus@dhvsu.edu.ph or through their Facebook page: facebook.com/dhvsu.mc.",
        keywords: "contact, Mexico campus, DHVSU, email, Facebook",
        status: "approved",
        category: "administration",
        priority: 3
      },
      // --- Porac Campus ---
      {
        question: "What programs are offered at the DHVSU Porac Campus?",
        answer: "The DHVSU Porac Campus offers the following degree programs: Bachelor of Elementary Education (Major in General Education), Bachelor of Science in Business Administration (Major in Marketing), Bachelor of Science in Social Work, and Bachelor of Science in Information Technology.",
        keywords: "Porac campus, programs, degree, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Who is the Director of DHVSU Porac Campus?",
        answer: "The Director of DHVSU Porac Campus is Mr. Dennis V. Dizon, MAEd.",
        keywords: "director, Porac campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Area Chairperson at the Porac Campus?",
        answer: "The Area Chairperson at the Porac Campus is Dr. Myla L. Isip, PhD.",
        keywords: "area chairperson, Porac campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who are the key administrative officers at the Porac Campus?",
        answer: "Key administrative officers at the Porac Campus include: Human Resource Management Officer III: Ms. Roselie M. Rivera, RGC, RPm, LPT, CHRA; Human Resource Management Officer II: Mr. Jerwin L. Fallar, CHRA; Supply Officer I: Mr. Alberto P. Borillo.",
        keywords: "administrative officers, Porac campus, DHVSU, staff",
        status: "approved",
        category: "administration",
        priority: 4
      },
      {
        question: "How can I contact DHVSU Porac Campus?",
        answer: "You can contact the Porac Campus via email at poraccampus@dhvsu.edu.ph or through their Facebook page: facebook.com/dhvsu.pc.",
        keywords: "contact, Porac campus, DHVSU, email, Facebook",
        status: "approved",
        category: "administration",
        priority: 3
      },
      // --- Sto. Tomas Campus ---
      {
        question: "What programs are offered at the DHVSU Sto. Tomas Campus?",
        answer: "The DHVSU Sto. Tomas Campus offers the following degree programs: Bachelor of Elementary Education (Major in General Education), Bachelor of Science in Business Administration (Major in Marketing), Bachelor of Science in Information Technology, and Bachelor of Science in Hospitality Management.",
        keywords: "Sto. Tomas campus, programs, degree, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Who is the Director of DHVSU Sto. Tomas Campus?",
        answer: "The Director of DHVSU Sto. Tomas Campus is Dr. Jovita G. Rivera, PhD.",
        keywords: "director, Sto. Tomas campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who are the Academic Chairpersons at the Sto. Tomas Campus?",
        answer: "Academic Chairperson: Mr. Jefferson S. Valdez, RN, LPT, MAN, MAEd; Program Chairperson, Bachelor of Science in Information Technology: Mr. Vernon Grace M. Maniago, LPT, MIT; Program Chairperson, Bachelor of Elementary Education: Ms. Maria Pamela R. Gonzales, LPT, MAEd; Program Chairperson, Bachelor of Science in Business Administration: Ms. Christine A. Cayanan, LPT, DBA; Program Chairperson, Bachelor of Science in Hospitality Management: Mr. Joelan S. Aguilar, MSHTM.",
        keywords: "academic chairperson, Sto. Tomas campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 4
      },
      {
        question: "How can I contact DHVSU Sto. Tomas Campus?",
        answer: "You can contact the Sto. Tomas Campus via email at santotomascampus@dhvsu.edu.ph or through their Facebook page: facebook.com/DHVSU.STC. Address: San Nicolas Road, City of San Fernando, Pampanga 2000.",
        keywords: "contact, Sto. Tomas campus, DHVSU, email, Facebook, address",
        status: "approved",
        category: "administration",
        priority: 3
      },
      // --- Lubao Campus ---
      {
        question: "What programs are offered at the DHVSU Lubao Campus?",
        answer: "The DHVSU Lubao Campus offers the following degree programs: Bachelor of Science in Civil Engineering, Bachelor of Elementary Education (Major in General Education), Bachelor of Science in Business Administration (Major in Marketing), Bachelor of Science in Entrepreneurship, Bachelor of Science in Information Technology, Bachelor of Science in Psychology, and Bachelor of Science in Tourism Management.",
        keywords: "Lubao campus, programs, degree, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Who is the Director of DHVSU Lubao Campus?",
        answer: "The Director of DHVSU Lubao Campus is Engr. Rowel D. Waje.",
        keywords: "director, Lubao campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Assistant Director of DHVSU Lubao Campus?",
        answer: "The Assistant Director of DHVSU Lubao Campus is Ms. Miriam B. Villanueva.",
        keywords: "assistant director, Lubao campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 4
      },
      {
        question: "Who is the Academic Chairperson at the DHVSU Lubao Campus?",
        answer: "The Academic Chairperson at the DHVSU Lubao Campus is Ms. Maria Christina L. Medina.",
        keywords: "academic chairperson, Lubao campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 4
      },
      {
        question: "How can I contact DHVSU Lubao Campus?",
        answer: "You can contact the Lubao Campus via email at dlc@dhvsu.edu.ph, through their Facebook page: facebook.com/DHVSU.DLC, or by phone at 0968 361 2690. Address: Lubao Diversion Road, Sta. Catalina, Lubao, Pampanga 2005.",
        keywords: "contact, Lubao campus, DHVSU, email, Facebook, phone, address",
        status: "approved",
        category: "administration",
        priority: 3
      },
      // --- Candaba Campus ---
      {
        question: "What programs are offered at the DHVSU Candaba Campus?",
        answer: "The DHVSU Candaba Campus offers the following degree programs: Bachelor of Secondary Education (Specialization in English and Filipino, Marketing), Bachelor of Elementary Education (Specialization in General Education), Bachelor of Science in Entrepreneurship, and Bachelor of Science in Information Technology.",
        keywords: "Candaba campus, programs, degree, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Who is the OIC-Director of DHVSU Candaba Campus?",
        answer: "The OIC-Director of DHVSU Candaba Campus is Dr. Rowina M. Twaño, DBA, RECE.",
        keywords: "OIC-Director, Candaba campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who are the academic chairpersons at the DHVSU Candaba Campus?",
        answer: "Academic Chairperson / Training and Extension Coordinator / Curriculum Coordinator: Mr. Arvin P. Tuazon, MBA; CBS Area Chairperson: Dr. Jiego A. Reyes, DBA; COE Area Chairperson: Ms. Nelissa Tecson, MAEd; CCS Area Chairperson: Mr. Kamil T. Reyes.",
        keywords: "academic chairperson, Candaba campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 4
      },
      {
        question: "How can I contact DHVSU Candaba Campus?",
        answer: "You can contact the Candaba Campus via email at candabacampus@dhvsu.edu.ph, by phone at 0993-991-1735, or through their Facebook page: facebook.com/DHVSUCandabaCampus2020. Address: Pansol, Pasig, Candaba, Pampanga, 2013.",
        keywords: "contact, Candaba campus, DHVSU, email, Facebook, phone, address",
        status: "approved",
        category: "administration",
        priority: 3
      },
      // --- Apalit Campus ---
      {
        question: "What programs are offered at the DHVSU Apalit Campus?",
        answer: "The DHVSU Apalit Campus offers the following degree programs: Bachelor of Science in Hospitality Management, Bachelor of Elementary Education (Specialization in General Education), Bachelor of Science in Business Administration (Major in Marketing), and Bachelor of Science in Information Technology.",
        keywords: "Apalit campus, programs, degree, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Who is the Director of DHVSU Apalit Campus?",
        answer: "The Director of DHVSU Apalit Campus is Dr. Normando C. Simon, DBA.",
        keywords: "director, Apalit campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Academic Chairperson at the DHVSU Apalit Campus?",
        answer: "The Academic Chairperson at the DHVSU Apalit Campus is Mr. Mark Anthony A. Castro, ECE, MEnM.",
        keywords: "academic chairperson, Apalit campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 4
      },
      {
        question: "How can I contact DHVSU Apalit Campus?",
        answer: "You can contact the Apalit Campus via email at apalitcampus@dhvsu.edu.ph or through their Facebook page: facebook.com/dhvsuapalit. Address: Sitio Tagulod, Sampaloc, Apalit, Pampanga.",
        keywords: "contact, Apalit campus, DHVSU, email, Facebook, address",
        status: "approved",
        category: "administration",
        priority: 3
      },
      // --- City of San Fernando Campus ---
      {
        question: "What programs are offered at the DHVSU San Fernando-Annex Campus?",
        answer: "The DHVSU San Fernando-Annex Campus offers the following degree programs: Bachelor of Secondary Education (Specialization in Marketing), Bachelor of Science in Tourism Management, and Bachelor of Public Administration.",
        keywords: "San Fernando campus, programs, degree, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 3
      },
      {
        question: "Who is the OIC-Director of DHVSU San Fernando-Annex Campus?",
        answer: "The OIC-Director of DHVSU San Fernando-Annex Campus is Dr. Maria Anna David-Cruz.",
        keywords: "OIC-Director, San Fernando campus, DHVSU, administration",
        status: "approved",
        category: "administration",
        priority: 3
      },
      {
        question: "Who is the Academic Chairperson at DHVSU San Fernando-Annex Campus?",
        answer: "The Academic Chairperson at DHVSU San Fernando-Annex Campus is Dr. Ferna Bel L. Punsalan.",
        keywords: "academic chairperson, San Fernando campus, DHVSU, academics",
        status: "approved",
        category: "academics",
        priority: 4
      },
      {
        question: "How can I contact DHVSU San Fernando-Annex Campus?",
        answer: "You can contact the San Fernando-Annex Campus via email at sfc@dhvsu.edu.ph, by phone at 0928 787 1916, or through their Facebook page: facebook.com/profile.php?id=61564437897464. Address: Purok 5, Malino, City of San Fernando (P).",
        keywords: "contact, San Fernando campus, DHVSU, email, Facebook, phone, address",
        status: "approved",
        category: "administration",
        priority: 3
      },
      // --- General FAQs and Procedures ---
      {
        question: "What are the contact details of DHVSU?",
        answer: "Contact Details: DHVSU: Dr. Enrique G. Baking (University President). Numbers: (045) 458-0021 / (045) 458-0022 / (0943) 010-0362 / (0908) 811-5048. Email: www.dhvtsu.edu.ph, robindimla@yahoo.com, lhiza314@gmail.com. DTI Pampanga: OIC-PD Elenita R. Ordonio. Numbers: (045) 455-1413 / (045) 860-4625. Email: dtipampanga@yahoo.com, r03.pampanga@dti.gov.ph.",
        keywords: "contact, DHVSU, phone, email, university, DTI Pampanga",
        status: "approved",
        category: "general",
        priority: 1
      },
      {
        question: "How to enroll as an irregular student?",
        answer: "1. Present the student ID together with: a) Letter of intent; b) Photocopy of Parent/Guardian's valid ID with 3 specimens of signature; c) Advising form; d) Evaluation Form. 2. Present the requirements to the dean. 3. Fill out the advising form as advised and present it to the college dean for approval. 4. Log-in the Daily Transaction.",
        keywords: "enroll, irregular student, requirements, dean, advising form",
        status: "approved",
        category: "admissions",
        priority: 2
      },
      {
        question: "How to request an excused letter due to absence?",
        answer: "1. Present the student's ID and Excuse Letter form with: a) 1 photocopy of any valid ID of the Parent/Guardian with 3 specimens of signature; b) Medical Certificate (if absence is due to confinement); or c) 1 photocopy of the duly signed doctor's prescription (if outpatient). 2. Present the requirements for initial evaluation.",
        keywords: "excused letter, absence, medical certificate, parent ID, evaluation",
        status: "approved",
        category: "student-services",
        priority: 2
      },
      {
        question: "How to request for Special Class?",
        answer: "1. Present the student's ID and inquire about the offering of special class in college. 2. Submit to the office the duly signed Letter of Intent Form. 3. Present the requirements for final evaluation. 4. Once approved by the area chairperson and the college dean, secure signature from the respective instructor who was affected by such absence for acknowledgement. 5. Log-in the Daily Transaction Sheet. 6. Photocopy the duly signed Excuse Letter Form and furnish the dean's office and the affected instructor/s a copy for record filing.",
        keywords: "special class, request, letter of intent, dean, area chairperson, instructor",
        status: "approved",
        category: "academics",
        priority: 2
      },
      {
        question: "How to ask for medicine at the clinic?",
        answer: "1. Sign in the General Logbook and Departmental Log sheet. 2. Present prescription. 3. Receive medicines.",
        keywords: "medicine, clinic, prescription, logbook, health",
        status: "approved",
        category: "student-services",
        priority: 3
      },
      {
        question: "How to ask medical clearance at the clinic?",
        answer: "1. Sign in the Medical Examination Record. 2. Receive and fill out Medical Clearance form. 3. Submit filled out Medical Clearance form. 4. Receive Medical clearance form. 5. Receive medicines.",
        keywords: "medical clearance, clinic, examination, health, form",
        status: "approved",
        category: "student-services",
        priority: 3
      },
      {
        question: "How to replace or will replace the lost ID?",
        answer: "Step 1: Go to Office of Student Affairs (ID profiling form). Step 2: Cashier's Office (Payment). Step 3: Management Information Systems (ID Printing).",
        keywords: "lost ID, replacement, student affairs, cashier, MIS, ID printing",
        status: "approved",
        category: "student-services",
        priority: 2
      },
      {
        question: "Where can I have my ID validated?",
        answer: "You can have your ID validated at the Office of Student Affairs.",
        keywords: "ID validation, student affairs, office, validation",
        status: "approved",
        category: "student-services",
        priority: 2
      },
      {
        question: "Where can I get my COE or COG?",
        answer: "You can get your Certificate of Enrollment (COE) or Certificate of Grades (COG) at the Registrar's Office.",
        keywords: "COE, COG, certificate, enrollment, grades, registrar",
        status: "approved",
        category: "registrar",
        priority: 2
      },
      {
        question: "When is the school library available?",
        answer: "Library Hours: Monday-Friday 7:30am-6:00pm, Saturday 8:00am-5:00pm.",
        keywords: "library, hours, schedule, availability, school",
        status: "approved",
        category: "general",
        priority: 2
      }
    ];
    
    var addedCount = 0;
    data.forEach(function(faq) {
      if (!existingQuestions.includes(faq.question.toLowerCase().trim())) {
        var id = Utilities.getUuid();
        sheet.appendRow([
          id,
          faq.question,
          faq.answer,
          faq.keywords,
          faq.status,
          faq.category,
          faq.priority
        ]);
        addedCount++;
      }
    });
    
    SpreadsheetApp.getUi().alert(addedCount + " new FAQs imported successfully!");
  }
  