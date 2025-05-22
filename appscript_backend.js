// REQUIRED GOOGLE SHEETS STRUCTURE:
// Users: id, username, email, password, dateCreated, reset_token, token_expiry, last_message_time, role, profile_pic
// FAQs: id, question, answer, keywords, status
// Feedback: timestamp, username, message, feedbackType
// ActivityLog: timestamp, username, action, details, ipAddress
// Conversations: timestamp, username, question, answer

// Unified sheet headers
const SHEET_HEADERS = {
  USERS: ["id", "username", "email", "password", "dateCreated", "reset_token", "token_expiry", "last_message_time", "role", "profile_pic"],
  FAQS: ["id", "question", "answer", "keywords", "status", "category", "priority"],
  FEEDBACK: ["timestamp", "username", "message", "feedbackType", "comment"],
  ACTIVITY_LOG: ["timestamp", "username", "action", "details", "ipAddress"],
  CONVERSATIONS: ["id", "username", "email", "question", "answer", "timestamp"]
};

// --- Rate Limiting Settings ---
const RATE_LIMIT_COOLDOWN_MS = 5000; // 5 seconds

function doGet(e) {
  return HtmlService.createHtmlOutput("The API is working. This endpoint accepts POST requests only.");
}

function doPost(e) {
  try {
    Logger.log("Raw request received: " + JSON.stringify(e));
    Logger.log("Request parameters: " + JSON.stringify(e.parameter));
    Logger.log("Request postData: " + JSON.stringify(e.postData));
    
    // Enhanced parameter validation
    if (!e) {
      Logger.log("ERROR: Empty request received");
      return createJsonResponse({
        success: false,
        message: "Empty request received",
        error: "EMPTY_REQUEST"
      });
    }

    // Try to parse parameters from both e.parameter and e.postData
    let params = {};
    if (e.parameter) {
      params = e.parameter;
    }
    if (e.postData && e.postData.contents) {
      try {
        const postData = JSON.parse(e.postData.contents);
        params = { ...params, ...postData };
      } catch (parseError) {
        Logger.log("Warning: Could not parse postData contents: " + parseError.toString());
      }
    }

    if (Object.keys(params).length === 0) {
      Logger.log("ERROR: No parameters found in request");
      return createJsonResponse({
        success: false,
        message: "No parameters found in request",
        error: "MISSING_PARAMETERS"
      });
    }

    const action = params.action;
    
    if (!action) {
      Logger.log("ERROR: No action specified in request");
      return createJsonResponse({
        success: false,
        message: "No action specified",
        error: "MISSING_ACTION"
      });
    }
    
    Logger.log("Action requested: " + action + " with parameters: " + JSON.stringify(params));
    
    // Get spreadsheet with error handling
    let ss;
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (error) {
      Logger.log("ERROR: Failed to access spreadsheet: " + error.toString());
      return createJsonResponse({
        success: false,
        message: "Database access error",
        error: "SPREADSHEET_ACCESS_ERROR"
      });
    }
    
    // Get or create sheets with unified headers and error handling
    let userSheet, faqSheet, feedbackSheet, activityLogSheet, conversationSheet;
    try {
      userSheet = getOrCreateSheet(ss, "Users", SHEET_HEADERS.USERS);
      faqSheet = getOrCreateSheet(ss, "FAQs", SHEET_HEADERS.FAQS);
      feedbackSheet = getOrCreateSheet(ss, "Feedback", SHEET_HEADERS.FEEDBACK);
      activityLogSheet = getOrCreateSheet(ss, "ActivityLog", SHEET_HEADERS.ACTIVITY_LOG);
      conversationSheet = getOrCreateSheet(ss, "Conversations", SHEET_HEADERS.CONVERSATIONS);
    } catch (error) {
      Logger.log("ERROR: Failed to get/create sheets: " + error.toString());
      return createJsonResponse({
        success: false,
        message: "Database structure error",
        error: "SHEET_CREATION_ERROR"
      });
    }
    
    // Ensure all sheets have required columns
    try {
      ensureSheetColumns(userSheet, SHEET_HEADERS.USERS);
      ensureSheetColumns(faqSheet, SHEET_HEADERS.FAQS);
      ensureSheetColumns(feedbackSheet, SHEET_HEADERS.FEEDBACK);
      ensureSheetColumns(activityLogSheet, SHEET_HEADERS.ACTIVITY_LOG);
      ensureSheetColumns(conversationSheet, SHEET_HEADERS.CONVERSATIONS);
    } catch (error) {
      Logger.log("ERROR: Failed to ensure sheet columns: " + error.toString());
      return createJsonResponse({
        success: false,
        message: "Database structure error",
        error: "COLUMN_VALIDATION_ERROR"
      });
    }

    // Handle different actions with enhanced error handling
    try {
      switch (action) {
        case "login":
          return handleLogin(params, userSheet);
        case "signup":
          return handleSignup(params, userSheet);
        case "forgotPassword":
          return handleForgotPassword(params, userSheet);
        case "resetPassword":
          return handleResetPassword(params, userSheet);
        case "getFAQs":
          return handleGetFAQs(faqSheet, params.isAdmin === "true");
        case "addFAQ":
          return handleAddFAQ(params, faqSheet);
        case "editFAQ":
          return handleEditFAQ(params, faqSheet);
        case "deleteFAQ":
          return handleDeleteFAQ(params, faqSheet);
        case "getFeedback":
          return handleGetFeedback(feedbackSheet);
        case "getLogs":
          return handleGetLogs(activityLogSheet);
        case "getUsers":
          return handleGetUsers(userSheet);
        case "getAnalytics":
          return handleGetAnalytics(faqSheet, feedbackSheet);
        case "getUserProfile":
          return handleGetUserProfile(userSheet, params.identifier);
        case "updateUserProfile":
          return handleUpdateUserProfile(userSheet, params);
        case "uploadProfilePic":
          return handleUploadProfilePic(params);
        case "getUserChatHistory":
          return handleGetUserChatHistory(params, conversationSheet);
        case "getAllUsers":
          return handleGetAllUsers(userSheet);
        case "getAdminStats":
          return handleGetAdminStats(userSheet, faqSheet, conversationSheet);
        case "deleteUser":
          return handleDeleteUser(params, userSheet);
        case "updateUser":
          return handleUpdateUser(params, userSheet);
        case "logFeedback":
          return handleLogFeedback(params, feedbackSheet);
        case "logConversation":
          return handleLogConversation(params, conversationSheet);
        case "chatMessage":
          return handleChatMessage(e, conversationSheet, faqSheet);
        default:
          Logger.log("Unknown action: " + action);
          return createJsonResponse({
            success: false,
            message: "Unknown action",
            error: "UNKNOWN_ACTION"
          });
      }
    } catch (error) {
      Logger.log("ERROR in action handler: " + error.toString());
      Logger.log("Stack trace: " + error.stack);
      return createJsonResponse({
        success: false,
        message: "An error occurred while processing your request",
        error: "ACTION_HANDLER_ERROR"
      });
    }
  } catch (error) {
    Logger.log("ERROR in doPost: " + error.toString());
    Logger.log("Stack trace: " + error.stack);
    return createJsonResponse({
      success: false,
      message: "An unexpected error occurred",
      error: "UNEXPECTED_ERROR"
    });
  }
}

/**
 * Robust rate limiting: case-insensitive username match, always updates last_message_time, logs all actions.
 * If user not found, do NOT allow (security). If missing last_message_time, treat as allowed and set it.
 */
function checkRateLimit(username, sheet) {
  Logger.log("[RateLimit] Checking for user: '" + username + "'");
  if (!sheet) {
    Logger.log("[RateLimit] ERROR: Sheet is undefined!");
    return { allowed: false, reason: "System error" };
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const usernameCol = headers.indexOf("username");
  const lastMsgCol = headers.indexOf("last_message_time");
  if (usernameCol === -1 || lastMsgCol === -1) {
    Logger.log("[RateLimit] ERROR: Required columns missing");
    return { allowed: false, reason: "System error" };
  }
  const normUsername = (username || "").toLowerCase().trim();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    const sheetUsername = (data[i][usernameCol] || "").toLowerCase().trim();
    if (sheetUsername === normUsername) {
      found = true;
      const lastTimeStr = data[i][lastMsgCol];
      const now = Date.now();
      let lastTime = 0;
      if (lastTimeStr) {
        try {
          lastTime = new Date(lastTimeStr).getTime();
        } catch (e) {
          Logger.log("[RateLimit] ERROR parsing last_message_time: " + lastTimeStr);
          lastTime = 0;
        }
      }
      Logger.log(`[RateLimit] Found user. Now: ${now}, Last: ${lastTime}, Diff: ${now - lastTime}`);
      if (lastTime && now - lastTime < RATE_LIMIT_COOLDOWN_MS) {
        Logger.log(`[RateLimit] BLOCKED: User sent message too soon. Wait ${(RATE_LIMIT_COOLDOWN_MS - (now - lastTime))/1000}s more.`);
        return { allowed: false, reason: "Too soon" };
      }
      // Update last_message_time
      sheet.getRange(i + 1, lastMsgCol + 1).setValue(new Date().toISOString());
      Logger.log("[RateLimit] ALLOWED: Updated last_message_time.");
      return { allowed: true };
    }
  }
  if (!found) {
    Logger.log(`[RateLimit] WARNING: Username not found in Users sheet: '${username}'. BLOCKING.`);
    return { allowed: false, reason: "User not found" };
  }
}

/**
 * Utility: Initialize last_message_time for all users if missing (set to 1970-01-01T00:00:00.000Z)
 */
function initializeLastMessageTimeForAllUsers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) throw new Error("Users sheet not found");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var lastMsgCol = headers.indexOf("last_message_time");
  if (lastMsgCol === -1) throw new Error("last_message_time column not found");
  var updated = 0;
  for (var i = 1; i < data.length; i++) {
    if (!data[i][lastMsgCol]) {
      sheet.getRange(i + 1, lastMsgCol + 1).setValue("1970-01-01T00:00:00.000Z");
      updated++;
    }
  }
  SpreadsheetApp.getUi().alert(updated + " users initialized with last_message_time.");
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

// Helper function to validate DHVSU email domain
function isValidDHVSUEmail(email) {
  if (!email) return false;
  email = email.toLowerCase().trim();
  return email.endsWith('@dhvsu.edu.ph');
}

function handleSignup(params, sheet) {
  if (!params) throw new Error('This function must be called via web request with parameters.');
  const username = params.username;
  const email = params.email;
  const password = params.password;
  
  Logger.log("Processing signup for: " + username + ", " + email);
  
  // Validate required parameters
  if (!username || !email || !password) {
    Logger.log("Signup failed: Missing required parameters");
    return createJsonResponse({
      success: false,
      message: "All fields are required"
    });
  }

  // Validate email domain using helper function
  if (!isValidDHVSUEmail(email)) {
    Logger.log("Signup failed: Invalid email domain");
    return createJsonResponse({
      success: false,
      message: "Only DHVSU email addresses (@dhvsu.edu.ph) are allowed"
    });
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const usernameCol = headers.indexOf("username");
  const emailCol = headers.indexOf("email");

  // Check for existing username or email
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

  // Create new user
  const newId = Utilities.getUuid();
  const dateCreated = new Date().toISOString();
  sheet.appendRow([newId, username, email, password, dateCreated, "", "", "", "student", ""]);
  
  Logger.log("Signup successful for: " + email);
  
  // Log the signup activity
  logActivity(email, "signup", "New user registration");
  
  return createJsonResponse({
    success: true,
    message: "User registered successfully"
  });
}

function handleLogin(params, sheet) {
  if (!params) throw new Error('This function must be called via web request with parameters.');
  if (!params || !params.email || !params.password) {
    Logger.log("Login failed: Missing email or password in params");
    return createJsonResponse({
      success: false,
      message: "Missing email or password"
    });
  }

  const email = params.email.toLowerCase().trim();
  const hashedPassword = params.password; // This is already hashed from frontend
  
  Logger.log("Attempting login for email: " + email);

  // Validate email domain
  if (!isValidDHVSUEmail(email)) {
    Logger.log("Login failed: Invalid email domain");
    return createJsonResponse({
      success: false,
      message: "Only DHVSU email addresses (@dhvsu.edu.ph) are allowed"
    });
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf("email");
  const passwordCol = headers.indexOf("password");
  const usernameCol = headers.indexOf("username");
  const roleCol = headers.indexOf("role");

  if (emailCol === -1 || passwordCol === -1 || usernameCol === -1) {
    Logger.log("Login failed: Required columns missing");
    return createJsonResponse({
      success: false,
      message: "System error: Required columns missing"
    });
  }

  for (let i = 1; i < data.length; i++) {
    const storedEmail = String(data[i][emailCol]).toLowerCase().trim();
    const storedPassword = String(data[i][passwordCol]);

    Logger.log("Comparing emails: '" + storedEmail + "' vs '" + email + "'");
    Logger.log("Password lengths - stored: " + storedPassword.length + ", provided: " + hashedPassword.length);

    if (storedEmail === email) {
      if (storedPassword === hashedPassword) {
        // Log the successful login
        logActivity(email, "login");
        Logger.log("Login successful for: " + email);
        return createJsonResponse({
          success: true,
          message: "Login successful",
          username: data[i][usernameCol],
          email: email,
          role: roleCol !== -1 ? (data[i][roleCol] || "student") : "student"
        });
      } else {
        Logger.log("Login failed: Password mismatch for " + email);
        return createJsonResponse({
          success: false,
          message: "Invalid password"
        });
      }
    }
  }
  
  Logger.log("Login failed: Email not found - " + email);
  return createJsonResponse({
    success: false,
    message: "Email not found"
  });
}

function handleGetUserProfile(sheet, identifier) {
  if (!identifier) throw new Error('This function must be called via web request with parameters.');
  Logger.log("Getting user profile for: " + identifier);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf("email");
  const usernameCol = headers.indexOf("username");
  const dateCreatedCol = headers.indexOf("dateCreated");
  const profilePicCol = headers.indexOf("profile_pic");
  const roleCol = headers.indexOf("role");

  for (let i = 1; i < data.length; i++) {
    // Check both email and username
    if (data[i][emailCol] === identifier || data[i][usernameCol] === identifier) {
      return createJsonResponse({
        success: true,
        profile: {
          username: data[i][usernameCol],
          email: data[i][emailCol],
          dateCreated: data[i][dateCreatedCol],
          profilePic: data[i][profilePicCol] || "",
          role: roleCol !== -1 ? (data[i][roleCol] || "student") : "student"
        }
      });
    }
  }
  return createJsonResponse({ success: false, message: "User not found" });
}

function handleDeleteUser(params, sheet) {
  const email = params.email;
  Logger.log("Deleting user: " + email);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf("email");
  if (emailCol === -1) {
    return createJsonResponse({ success: false, message: "Email column not found." });
  }
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailCol] === email) {
      sheet.deleteRow(i + 1);
      Logger.log("User deleted: " + email);
      return createJsonResponse({ success: true, message: "User deleted successfully." });
    }
  }
  Logger.log("User not found for deletion: " + email);
  return createJsonResponse({ success: false, message: "User not found." });
}

function handleUpdateUser(params, sheet) {
  if (!params) throw new Error('This function must be called via web request with parameters.');
  const email = params.email;
  const role = params.role;
  if (!email.toLowerCase().endsWith('@dhvsu.edu.ph')) {
      Logger.log("User update failed: Invalid email domain");
      return createJsonResponse({ success: false, message: "Only DHVSU email addresses (@dhvsu.edu.ph) are allowed." });
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf("email");
  const roleCol = headers.indexOf("role");
  if (emailCol === -1 || roleCol === -1) {
    return createJsonResponse({ success: false, message: "Required columns not found." });
  }
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailCol] === email) {
      if (role) sheet.getRange(i + 1, roleCol + 1).setValue(role);
      Logger.log("User updated: " + email);
      return createJsonResponse({ success: true, message: "User updated successfully." });
    }
  }
  return createJsonResponse({ success: false, message: "User not found." });
}

function handleUpdateUserProfile(sheet, params) {
  if (!params) throw new Error('This function must be called via web request with parameters.');
  const username = params.username;
  
  // Find user in spreadsheet
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const usernameCol = headers.indexOf("username");
  const profilePicCol = headers.indexOf("profile_pic");
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][usernameCol] === username) {
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
  if (!params) throw new Error('This function must be called via web request with parameters.');
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
  if (!params) throw new Error('This function must be called via web request with parameters.');
  Logger.log("Getting chat history for user: " + (params.email || params.username || params.identifier));
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf("email");
  const usernameCol = headers.indexOf("username");
  const timestampCol = headers.indexOf("timestamp");
  const questionCol = headers.indexOf("question");
  const answerCol = headers.indexOf("answer");
  const categoryCol = headers.indexOf("category"); // NEW: get category column if exists

  // Validate required columns
  if ((emailCol === -1 && usernameCol === -1) || timestampCol === -1 || questionCol === -1 || answerCol === -1) {
    Logger.log("ERROR: Required columns missing in Conversations sheet");
    return createJsonResponse({
      success: false,
      message: "Server configuration error"
    });
  }

  // Accept identifier as username or email
  const identifier = params.email || params.username || params.identifier;
  if (!identifier) {
    return createJsonResponse({ success: false, message: "No identifier provided" });
  }

  // Filter conversations for this user
  const userHistory = [];
  for (let i = 1; i < data.length; i++) {
    if (
      (emailCol !== -1 && data[i][emailCol] === identifier) ||
      (usernameCol !== -1 && data[i][usernameCol] === identifier)
    ) {
      let timestamp = data[i][timestampCol];
      // Try to parse and reformat timestamp to ISO if needed
      let isoTimestamp = '';
      try {
        const d = new Date(timestamp);
        isoTimestamp = isNaN(d.getTime()) ? '' : d.toISOString();
      } catch (e) {
        isoTimestamp = '';
      }
      userHistory.push({
        timestamp: isoTimestamp || timestamp,
        question: data[i][questionCol],
        answer: data[i][answerCol],
        category: categoryCol !== -1 ? data[i][categoryCol] : undefined
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
  // No params needed, skip guard
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
  // No params needed, skip guard
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
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      Logger.log("Adding missing headers: " + missingHeaders.join(", "));
      const lastCol = sheet.getLastColumn();
      missingHeaders.forEach((header, index) => {
        sheet.getRange(1, lastCol + index + 1).setValue(header);
      });
    }
    return true;
  } catch (error) {
    Logger.log("Error in ensureSheetColumns: " + error.toString());
    return false;
  }
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
      question: "Where can I have your ID validated?",
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

// Helper function to log activities
function logActivity(username, action, details = "") {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = getOrCreateSheet(ss, "ActivityLog", ["timestamp", "username", "action", "details", "ipAddress"]);
    logSheet.appendRow([new Date(), username, action, details, ""]);
  } catch (error) {
    Logger.log("Error logging activity: " + error.toString());
  }
}

function handleGetFAQs(sheet, isAdmin = false) {
  try {
    Logger.log("Getting FAQs, isAdmin: " + isAdmin);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const faqs = [];

    // Get column indices
    const idCol = headers.indexOf("id");
    const questionCol = headers.indexOf("question");
    const answerCol = headers.indexOf("answer");
    const keywordsCol = headers.indexOf("keywords");
    const statusCol = headers.indexOf("status");
    const categoryCol = headers.indexOf("category");
    const priorityCol = headers.indexOf("priority");

    // Validate required columns exist
    if (idCol === -1 || questionCol === -1 || answerCol === -1) {
      Logger.log("Error: Required FAQ columns missing");
      return createJsonResponse({
        success: false,
        message: "Database structure error"
      });
    }

    // Process each FAQ row
    for (let i = 1; i < data.length; i++) {
      const status = statusCol !== -1 ? data[i][statusCol] : "approved";
      // Only include approved FAQs for non-admin users
      if (!isAdmin && status !== "approved") continue;

      faqs.push({
        id: data[i][idCol],
        question: data[i][questionCol],
        answer: data[i][answerCol],
        keywords: keywordsCol !== -1 ? data[i][keywordsCol] : "",
        status: status,
        category: categoryCol !== -1 ? data[i][categoryCol] : "general",
        priority: priorityCol !== -1 ? data[i][priorityCol] : 3
      });
    }

    Logger.log("Retrieved " + faqs.length + " FAQs");
    return createJsonResponse({
      success: true,
      faqs: faqs
    });
  } catch (error) {
    Logger.log("Error in handleGetFAQs: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Error retrieving FAQs: " + error.toString()
    });
  }
}

// --- Improved FAQ Matching ---
function findBestMatch(userQuestion, faqs) {
  // Normalize input
  function normalize(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }

  const userQNorm = normalize(userQuestion);
  let bestMatch = null;
  let highestScore = 0;

  faqs.forEach(faq => {
    const faqQNorm = normalize(faq.question);
    let score = 0;

    // Exact match
    if (faqQNorm === userQNorm) {
      score = 100;
    } else {
      // Jaccard similarity
      const userWords = new Set(userQNorm.split(' '));
      const faqWords = new Set(faqQNorm.split(' '));
      const intersection = new Set([...userWords].filter(x => faqWords.has(x)));
      const union = new Set([...userWords, ...faqWords]);
      const jaccard = intersection.size / union.size;
      score += jaccard * 80; // up to 80 points

      // Keyword overlap
      if (faq.keywords) {
        const keywords = faq.keywords.toLowerCase().split(',').map(k => k.trim());
        keywords.forEach(keyword => {
          if (userQNorm.includes(keyword)) score += 10;
        });
      }

      // Partial phrase match (for questions like 'what is the mission of dhvsu')
      if (faqQNorm.includes(userQNorm) || userQNorm.includes(faqQNorm)) {
        score += 20;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = faq;
    }
  });

  // Set a reasonable threshold (e.g., 30)
  return highestScore >= 30 ? bestMatch : null;
}

// --- Improved FAQ Matching with Suggestions ---
function findBestMatches(userQuestion, faqs, maxSuggestions = 3) {
  function normalize(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }
  const userQNorm = normalize(userQuestion);
  let scoredFaqs = faqs.map(faq => {
    const faqQNorm = normalize(faq.question);
    let score = 0;
    if (faqQNorm === userQNorm) {
      score = 100;
    } else {
      const userWords = new Set(userQNorm.split(' '));
      const faqWords = new Set(faqQNorm.split(' '));
      const intersection = new Set([...userWords].filter(x => faqWords.has(x)));
      const union = new Set([...userWords, ...faqWords]);
      const jaccard = intersection.size / union.size;
      score += jaccard * 80;
      if (faq.keywords) {
        const keywords = faq.keywords.toLowerCase().split(',').map(k => k.trim());
        keywords.forEach(keyword => {
          if (userQNorm.includes(keyword)) score += 10;
        });
      }
      if (faqQNorm.includes(userQNorm) || userQNorm.includes(faqQNorm)) {
        score += 20;
      }
    }
    return { ...faq, _score: score };
  });
  scoredFaqs.sort((a, b) => b._score - a._score);
  const bestMatch = scoredFaqs[0]._score >= 30 ? scoredFaqs[0] : null;
  // Suggestions: next best matches, not the main answer, with score >= 20
  const suggestions = scoredFaqs.filter(faq => faq !== bestMatch && faq._score >= 20).slice(0, maxSuggestions);
  return { bestMatch, suggestions };
}

// Updated chat message handler with improved suggestion filtering
function handleChatMessage(e, conversationSheet, faqSheet) {
  try {
    Logger.log("Handling chat message with parameters:", JSON.stringify(e.parameter));
    
    // Validate parameters
    if (!e || !e.parameter) {
      Logger.log("ERROR: Missing event or parameters in handleChatMessage");
      return createJsonResponse({ 
        success: false, 
        message: "Missing parameters",
        error: "MISSING_PARAMETERS"
      });
    }

    const userQuestion = e.parameter.question;
    const username = e.parameter.username;
    const email = e.parameter.email || "";
    const context = e.parameter.context ? JSON.parse(e.parameter.context) : null;

    if (!userQuestion || !username) {
      Logger.log("ERROR: Missing required parameters in handleChatMessage");
      return createJsonResponse({
        success: false,
        message: "Missing required parameters",
        error: "MISSING_REQUIRED_PARAMETERS"
      });
    }

    // Check Users sheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = ss.getSheetByName("Users");
    if (!userSheet) {
      Logger.log("ERROR: Users sheet not found in handleChatMessage!");
      return createJsonResponse({
        success: false,
        message: "System error: Users sheet not found.",
        error: "MISSING_USERS_SHEET"
      });
    }

    // Rate limiting
    var rateLimitResult = checkRateLimit(username, userSheet);
    if (!rateLimitResult.allowed) {
      Logger.log("Rate limit exceeded for user:", username);
      return createJsonResponse({
        success: false,
        message: rateLimitResult.reason || "You are sending messages too quickly. Please wait a few seconds before trying again.",
        error: "RATE_LIMIT_EXCEEDED"
      });
    }

    // Get FAQs
    const data = faqSheet.getDataRange().getValues();
    const headers = data[0];
    const faqs = [];
    const questionCol = headers.indexOf("question");
    const answerCol = headers.indexOf("answer");
    const keywordsCol = headers.indexOf("keywords");
    const clarificationCol = headers.indexOf("clarificationOptions");
    const followUpCol = headers.indexOf("followUpQuestions");
    const requiresClarCol = headers.indexOf("requiresClarification");
    const categoryCol = headers.indexOf("category");
    const priorityCol = headers.indexOf("priority");

    if (questionCol === -1 || answerCol === -1) {
      Logger.log("ERROR: FAQ sheet missing required columns");
      return createJsonResponse({ 
        success: false, 
        message: "FAQ database error",
        error: "INVALID_FAQ_STRUCTURE"
      });
    }

    // Process FAQs
    for (let i = 1; i < data.length; i++) {
      faqs.push({
        question: data[i][questionCol],
        answer: data[i][answerCol],
        keywords: keywordsCol !== -1 ? data[i][keywordsCol] : "",
        clarificationOptions: clarificationCol !== -1 ? data[i][clarificationCol] : "",
        followUpQuestions: followUpCol !== -1 ? data[i][followUpCol] : "",
        requiresClarification: requiresClarCol !== -1 ? data[i][requiresClarCol] : "FALSE",
        category: categoryCol !== -1 ? data[i][categoryCol] : "",
        priority: priorityCol !== -1 ? data[i][priorityCol] : "3"
      });
    }

    // Use enhanced matching
    const { bestMatch, suggestions } = findBestMatches(userQuestion, faqs, context);
    Logger.log("Best match found:", bestMatch ? bestMatch.question : "none");
    Logger.log("Number of suggestions:", suggestions.length);

    // Response construction
    let responseType = "direct_answer";
    let answer = "";
    let clarificationOptions = null;
    let followUpQuestions = [];

    if (bestMatch) {
      if (bestMatch.requiresClarification === true || bestMatch.requiresClarification === "TRUE") {
        responseType = "clarification";
        answer = bestMatch.answer;
        try {
          clarificationOptions = JSON.parse(bestMatch.clarificationOptions);
        } catch (e) {
          clarificationOptions = bestMatch.clarificationOptions;
        }
      } else {
        responseType = "direct_answer";
        answer = bestMatch.answer;

        // Process follow-up questions
        if (bestMatch.followUpQuestions) {
          try {
            followUpQuestions = JSON.parse(bestMatch.followUpQuestions);
          } catch (e) {
            if (typeof bestMatch.followUpQuestions === "string" && bestMatch.followUpQuestions.length > 0) {
              followUpQuestions = bestMatch.followUpQuestions.split("|").map(q => q.trim()).filter(q => q);
            }
          }
        }

        // Add category-based follow-ups
        if (bestMatch.category) {
          const related = faqs
            .filter(f => f.category === bestMatch.category && f.question !== bestMatch.question)
            .sort((a, b) => (parseInt(b.priority) || 3) - (parseInt(a.priority) || 3))
            .slice(0, 2);
          followUpQuestions = followUpQuestions.concat(related.map(f => f.question));
        }
      }
    } else {
      responseType = "follow_up";
      answer = "I'm sorry, I couldn't find a specific answer to your question. Please try rephrasing or <b><a href='mailto:helpdesk@dhvsu.edu.ph?subject=AskBot%20Support%20Request'>contact support</a></b>.";
      followUpQuestions = suggestions.map(s => s.question);
    }

    // Log conversation
    const timestamp = new Date().toISOString();
    const conversationId = Utilities.getUuid();
    const category = bestMatch && bestMatch.category ? bestMatch.category : '';

    // Prepare row data
    let row = [
      conversationId,
      username,
      email,
      userQuestion,
      answer,
      timestamp
    ];

    // Add category if column exists
    const convHeaders = conversationSheet.getRange(1, 1, 1, conversationSheet.getLastColumn()).getValues()[0];
    const convCategoryCol = convHeaders.indexOf('category');
    if (convCategoryCol !== -1) {
      while (row.length < convCategoryCol) row.push("");
      row[convCategoryCol] = category;
    }

    // Append conversation
    conversationSheet.appendRow(row);

    // Log activity
    logActivity(username, "chat_message", "Question: " + userQuestion);

    // Return response
    return createJsonResponse({
      success: true,
      type: responseType,
      answer: answer,
      clarificationOptions: clarificationOptions,
      followUpQuestions: followUpQuestions,
      suggestions: suggestions.map(s => s.question),
      context: {
        lastQuestion: userQuestion,
        timestamp: timestamp,
        user: username
      }
    });

  } catch (error) {
    Logger.log("Error in handleChatMessage: " + error.toString());
    Logger.log("Stack trace: " + error.stack);
    return createJsonResponse({
      success: false,
      message: "Error processing chat message: " + error.toString(),
      error: "CHAT_PROCESSING_ERROR"
    });
  }
}

// Updated conversation logging handler
function handleLogConversation(params, sheet) {
  try {
    Logger.log("Logging conversation for user: " + params.username);
    
    // Ensure required parameters
    if (!params.username || !params.question || !params.answer) {
      Logger.log("Missing required conversation parameters");
      return createJsonResponse({
        success: false,
        message: "Missing required conversation data"
      });
    }

    // Add conversation to sheet
    const timestamp = new Date().toISOString();
    sheet.appendRow([
      Utilities.getUuid(), // id
      params.username,
      params.email || "", // email is optional
      params.question,
      params.answer,
      timestamp
    ]);

    // Log the activity
    logActivity(params.username, "conversation", "Question: " + params.question);

    Logger.log("Conversation logged successfully");
    return createJsonResponse({
      success: true,
      message: "Conversation logged successfully"
    });
  } catch (error) {
    Logger.log("Error logging conversation: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Error logging conversation: " + error.toString()
    });
  }
}

// Enhanced FAQ matching with context awareness
function findBestMatches(question, faqs, context = null) {
  if (!question || !faqs || !Array.isArray(faqs)) {
    Logger.log("ERROR in findBestMatches: Invalid input parameters");
    Logger.log("Question:", question);
    Logger.log("FAQs:", JSON.stringify(faqs));
    return { bestMatch: null, suggestions: [] };
  }

  function normalize(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function calculateJaccardSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  function calculateLevenshteinDistance(str1, str2) {
    if (!str1 || !str2) return Math.max(str1?.length || 0, str2?.length || 0);
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }
    return dp[m][n];
  }

  const userQNorm = normalize(question);
  Logger.log("Normalized question:", userQNorm);

  let scoredFaqs = faqs.map(faq => {
    if (!faq || !faq.question) {
      Logger.log("Invalid FAQ entry:", JSON.stringify(faq));
      return { ...faq, _score: 0 };
    }
    
    const faqQNorm = normalize(faq.question);
    let score = 0;

    // 1. Exact match (100 points)
    if (faqQNorm === userQNorm) {
      score = 100;
      Logger.log("Exact match found:", faqQNorm);
    } else {
      // 2. Jaccard similarity (up to 40 points)
      const jaccard = calculateJaccardSimilarity(userQNorm, faqQNorm);
      score += jaccard * 40;

      // 3. Levenshtein distance (up to 30 points)
      const maxLength = Math.max(userQNorm.length, faqQNorm.length);
      const levenshtein = calculateLevenshteinDistance(userQNorm, faqQNorm);
      const levenshteinScore = (1 - levenshtein / maxLength) * 30;
      score += levenshteinScore;

      // 4. Keyword matching (up to 20 points)
      if (faq.keywords) {
        const keywords = faq.keywords.toLowerCase().split(',').map(k => k.trim());
        const matchedKeywords = keywords.filter(k => userQNorm.includes(k));
        score += (matchedKeywords.length / keywords.length) * 20;
        if (matchedKeywords.length > 0) {
          Logger.log("Matched keywords:", matchedKeywords);
        }
      }

      // 5. Partial phrase match (10 points)
      if (faqQNorm.includes(userQNorm) || userQNorm.includes(faqQNorm)) {
        score += 10;
        Logger.log("Partial phrase match found");
      }

      // 6. Context boost (5 points)
      if (context && context.lastQuestion) {
        const lastQNorm = normalize(context.lastQuestion);
        if (faqQNorm.includes(lastQNorm) || lastQNorm.includes(faqQNorm)) {
          score += 5;
          Logger.log("Context boost applied");
        }
      }
    }

    // 7. Priority boost (up to 5 points)
    if (faq.priority) {
      const priority = parseInt(faq.priority) || 3;
      score += (6 - priority); // Higher priority (1-5) gives more points
    }

    return { ...faq, _score: score };
  });

  // Sort by score and filter out invalid entries
  scoredFaqs = scoredFaqs
    .filter(faq => faq && faq._score > 0)
    .sort((a, b) => b._score - a._score);

  // Lower threshold for better matching (20 instead of 30)
  const bestMatch = scoredFaqs[0] && scoredFaqs[0]._score >= 20 ? scoredFaqs[0] : null;
  
  // Get suggestions (next best matches with score >= 15)
  const suggestions = scoredFaqs
    .filter(faq => faq !== bestMatch && faq._score >= 15)
    .slice(0, 3);

  // Log matching results for debugging
  Logger.log(`Matching results for: "${question}"`);
  Logger.log(`Best match score: ${bestMatch ? bestMatch._score : 'none'}`);
  Logger.log(`Number of suggestions: ${suggestions.length}`);
  if (bestMatch) {
    Logger.log(`Best match question: ${bestMatch.question}`);
  }

  return { bestMatch, suggestions };
}

// Enhanced similarity calculation
function calculateSimilarity(str1, str2) {
  // Tokenize strings
  const tokens1 = str1.toLowerCase().split(/\s+/);
  const tokens2 = str2.toLowerCase().split(/\s+/);
  
  // Calculate Jaccard similarity
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  let jaccardScore = intersection.size / union.size;
  
  // Add Levenshtein distance for close matches
  const levenshteinScore = 1 - (levenshteinDistance(str1, str2) / Math.max(str1.length, str2.length));
  
  // Combine scores with weights
  return (jaccardScore * 0.7) + (levenshteinScore * 0.3);
}

// Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // substitution
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1      // insertion
        );
      }
    }
  }
  return dp[m][n];
}

// Enhanced error handling
function handleError(error, action) {
  Logger.log("handleError called with: " + JSON.stringify(error));
  console.error(`Error in ${action}:`, error);

  let errorMessage = 'An unexpected error occurred';
  let errorType = 'general';

  if (error && error.message) {
    if (error.message.includes('timeout')) {
      errorMessage = 'The request timed out. Please try again.';
      errorType = 'timeout';
    } else if (error.message.includes('permission')) {
      errorMessage = 'You do not have permission to perform this action.';
      errorType = 'permission';
    } else if (error.message.includes('validation')) {
      errorMessage = 'Invalid input. Please check your request.';
      errorType = 'validation';
    } else {
      errorMessage = error.message;
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    errorMessage = JSON.stringify(error);
  }

  return createJsonResponse({
    success: false,
    type: errorType,
    message: errorMessage
  });
}

function updateFAQSheetStructure() {
  var sheetName = "FAQs"; // Change if your sheet is named differently
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    SpreadsheetApp.getUi().alert("Sheet named '" + sheetName + "' not found.");
    return;
  }

  // Desired columns in order
  var desiredHeaders = [
    "id",
    "question",
    "answer",
    "keywords",
    "status",
    "category",
    "priority",
    "requiresClarification",
    "clarificationOptions",
    "followUpQuestions"
  ];

  // Get current headers
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Add missing columns at the end
  desiredHeaders.forEach(function(header) {
    if (currentHeaders.indexOf(header) === -1) {
      sheet.insertColumnAfter(sheet.getLastColumn());
      sheet.getRange(1, sheet.getLastColumn()).setValue(header);
    }
  });

  // Re-fetch headers after possible additions
  currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Reorder columns to match desiredHeaders
  var colMap = desiredHeaders.map(function(header) {
    return currentHeaders.indexOf(header) + 1;
  });

  // Move columns if out of order
  for (var i = 0; i < desiredHeaders.length; i++) {
    if (colMap[i] !== i + 1) {
      sheet.moveColumns(sheet.getRange(1, colMap[i], sheet.getMaxRows()), i + 1);
      // After moving, update colMap
      currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      colMap = desiredHeaders.map(function(header) {
        return currentHeaders.indexOf(header) + 1;
      });
    }
  }

  // Fill default values for new columns (if empty)
  var data = sheet.getDataRange().getValues();
  var numRows = data.length;
  var requiresClarCol = currentHeaders.indexOf("requiresClarification");
  var clarOptCol = currentHeaders.indexOf("clarificationOptions");
  var followUpCol = currentHeaders.indexOf("followUpQuestions");

  for (var r = 1; r < numRows; r++) {
    if (requiresClarCol !== -1 && !data[r][requiresClarCol]) {
      sheet.getRange(r + 1, requiresClarCol + 1).setValue("FALSE");
    }
    if (clarOptCol !== -1 && !data[r][clarOptCol]) {
      sheet.getRange(r + 1, clarOptCol + 1).setValue("");
    }
    if (followUpCol !== -1 && !data[r][followUpCol]) {
      sheet.getRange(r + 1, followUpCol + 1).setValue("");
    }
  }

  SpreadsheetApp.getUi().alert("FAQ sheet structure updated successfully!");
}

/**
 * DEMO: Populate the first 3 FAQs with smart features for testing.
 * 1. Clarification, 2. Follow-up, 3. Both
 * All referenced clarification/follow-up questions will also be updated with good answers.
 */
function demoPopulateSmartFAQs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("FAQs");
  if (!sheet) throw new Error("FAQs sheet not found");
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var clarCol = headers.indexOf("clarificationOptions") + 1;
  var followCol = headers.indexOf("followUpQuestions") + 1;
  var reqClarCol = headers.indexOf("requiresClarification") + 1;
  var qCol = headers.indexOf("question") + 1;
  var aCol = headers.indexOf("answer") + 1;
  // 1. Clarification only
  sheet.getRange(2, qCol).setValue("How do I get my ID?");
  sheet.getRange(2, aCol).setValue("Do you mean for new students or for lost ID?");
  sheet.getRange(2, reqClarCol).setValue("TRUE");
  sheet.getRange(2, clarCol).setValue('[{"text":"For new students","question":"How do new students get their ID?"},{"text":"For lost ID","question":"How to replace a lost ID?"}]');
  sheet.getRange(2, followCol).setValue("");
  // 2. Follow-up only
  sheet.getRange(3, qCol).setValue("How to enroll?");
  sheet.getRange(3, aCol).setValue("To enroll at DHVSU, visit the Admissions Office with your requirements. For detailed steps, see the follow-up questions below.");
  sheet.getRange(3, reqClarCol).setValue("FALSE");
  sheet.getRange(3, clarCol).setValue("");
  sheet.getRange(3, followCol).setValue('["What are the requirements for enrollment?","How to transfer to DHVSU?"]');
  // 3. Both
  sheet.getRange(4, qCol).setValue("How to request a document?");
  sheet.getRange(4, aCol).setValue("Which document do you want to request? Please clarify below.");
  sheet.getRange(4, reqClarCol).setValue("TRUE");
  sheet.getRange(4, clarCol).setValue('[{"text":"Transcript of Records (TOR)","question":"How to get TOR?"},{"text":"Certificate of Grades (COG)","question":"How to get Certificate of Grades?"}]');
  sheet.getRange(4, followCol).setValue('["How to get Good Moral?","How to get Certificate of Enrollment?"]');
  // --- Add/update referenced clarification/follow-up questions with good answers ---
  var demoAnswers = {
    "How do new students get their ID?": "New students can get their ID by visiting the Registrar's Office after enrollment. Please bring your Certificate of Registration (COR) and a valid ID.",
    "How to replace a lost ID?": "To replace a lost ID, go to the Office of Student Affairs for an ID profiling form, pay at the Cashier's Office, and proceed to the MIS Office for ID printing. Bring a valid ID and proof of payment.",
    "What are the requirements for enrollment?": "Requirements for enrollment include: accomplished application form, high school report card, birth certificate (PSA), certificate of good moral character, and 2x2 ID photos. Additional documents may be required for transferees.",
    "How to transfer to DHVSU?": "To transfer to DHVSU, secure a transfer credential from your previous school, prepare your transcript of records, and submit all requirements to the Admissions Office for evaluation.",
    "How to get TOR?": "To get your Transcript of Records (TOR), clear your account with the Accounting Office, then request and pay for your TOR at the Registrar's Office. Processing usually takes 2-3 days.",
    "How to get Certificate of Grades?": "Request a Certificate of Grades (COG) at the Registrar's Office one week after classes start. Payment is required. The class mayor may assist in submitting requests for the class.",
    "How to get Good Moral?": "Request a Certificate of Good Moral at the Guidance & Testing Center. State your purpose (enrollment, scholarship, etc.) and pay the required fee.",
    "How to get Certificate of Enrollment?": "After enrolling, request your Certificate of Enrollment (COE) from the Registrar's Office. It may also be available in your student portal."
  };
  // For each referenced question, update or add the answer
  Object.keys(demoAnswers).forEach(function(q) {
    var found = false;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if ((data[i][qCol-1] || "").toLowerCase().trim() === q.toLowerCase().trim()) {
        sheet.getRange(i+1, aCol).setValue(demoAnswers[q]);
        found = true;
        break;
      }
    }
    if (!found) {
      // Add new row if missing
      var row = [];
      row[qCol-1] = q;
      row[aCol-1] = demoAnswers[q];
      while (row.length < headers.length) row.push("");
      sheet.appendRow(row);
    }
  });
}

/**
 * Utility: Add missing FAQ rows for all clarification/follow-up options in the first 10 rows.
 * This ensures every clarification/follow-up question has a matching FAQ row.
 */
function addMissingClarificationFAQs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("FAQs");
  if (!sheet) throw new Error("FAQs sheet not found");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var questionCol = headers.indexOf("question");
  var answerCol = headers.indexOf("answer");
  var keywordsCol = headers.indexOf("keywords");
  var statusCol = headers.indexOf("status");
  var categoryCol = headers.indexOf("category");
  var priorityCol = headers.indexOf("priority");
  var existingQuestions = data.slice(1).map(row => (row[questionCol] || "").toLowerCase().trim());
  var toAdd = [];
  for (var i = 1; i <= Math.min(10, data.length - 1); i++) {
    var clarOpts = headers.indexOf("clarificationOptions") !== -1 ? data[i][headers.indexOf("clarificationOptions")] : "";
    var followUps = headers.indexOf("followUpQuestions") !== -1 ? data[i][headers.indexOf("followUpQuestions")] : "";
    // Parse clarification options
    if (clarOpts && clarOpts.length > 0) {
      try {
        var clarArr = JSON.parse(clarOpts);
        clarArr.forEach(opt => {
          var q = (typeof opt === 'string') ? opt : opt.question;
          if (q && !existingQuestions.includes(q.toLowerCase().trim())) {
            toAdd.push(q);
          }
        });
      } catch (e) {
        // Try pipe-separated fallback
        clarOpts.split('|').forEach(q => {
          if (q && !existingQuestions.includes(q.toLowerCase().trim())) {
            toAdd.push(q.trim());
          }
        });
      }
    }
    // Parse follow-up questions
    if (followUps && followUps.length > 0) {
      try {
        var followArr = JSON.parse(followUps);
        followArr.forEach(q => {
          if (q && !existingQuestions.includes(q.toLowerCase().trim())) {
            toAdd.push(q.trim());
          }
        });
      } catch (e) {
        followUps.split('|').forEach(q => {
          if (q && !existingQuestions.includes(q.toLowerCase().trim())) {
            toAdd.push(q.trim());
          }
        });
      }
    }
  }
  // Add missing questions
  var added = 0;
  toAdd = Array.from(new Set(toAdd)); // Remove duplicates
  toAdd.forEach(q => {
    var row = [];
    row[questionCol] = q;
    row[answerCol] = "[PLACEHOLDER] Please update this answer.";
    row[keywordsCol] = "";
    row[statusCol] = "approved";
    row[categoryCol] = "general";
    row[priorityCol] = 3;
    // Fill up to the number of columns
    while (row.length < headers.length) row.push("");
    sheet.appendRow(row);
    added++;
  });
  SpreadsheetApp.getUi().alert(added + " missing clarification/follow-up FAQs added. Please update their answers.");
}

function verifyAndFixFAQStructure() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const faqSheet = ss.getSheetByName("FAQs");
    
    if (!faqSheet) {
      Logger.log("Creating new FAQs sheet");
      return getOrCreateSheet(ss, "FAQs", SHEET_HEADERS.FAQS);
    }
    
    // Get current headers
    const headers = faqSheet.getRange(1, 1, 1, faqSheet.getLastColumn()).getValues()[0];
    const requiredHeaders = SHEET_HEADERS.FAQS;
    
    // Check for missing headers
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      Logger.log("Missing headers found: " + missingHeaders.join(", "));
      
      // Add missing headers
      const lastCol = faqSheet.getLastColumn();
      missingHeaders.forEach((header, index) => {
        faqSheet.getRange(1, lastCol + index + 1).setValue(header);
      });
      
      // Initialize new columns with default values
      const lastRow = faqSheet.getLastRow();
      if (lastRow > 1) {
        missingHeaders.forEach((header, index) => {
          const range = faqSheet.getRange(2, lastCol + index + 1, lastRow - 1, 1);
          switch (header) {
            case "status":
              range.setValue("active");
              break;
            case "category":
              range.setValue("general");
              break;
            case "priority":
              range.setValue(3);
              break;
            case "keywords":
              range.setValue("");
              break;
            default:
              range.setValue("");
          }
        });
      }
    }
    
    // Verify data types and fix if needed
    const data = faqSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      
      // Fix status
      const statusCol = headers.indexOf("status");
      if (statusCol !== -1) {
        const status = row[statusCol];
        if (!status || !["active", "pending", "archived"].includes(status)) {
          faqSheet.getRange(rowNum, statusCol + 1).setValue("active");
        }
      }
      
      // Fix priority
      const priorityCol = headers.indexOf("priority");
      if (priorityCol !== -1) {
        const priority = parseInt(row[priorityCol]);
        if (isNaN(priority) || priority < 1 || priority > 5) {
          faqSheet.getRange(rowNum, priorityCol + 1).setValue(3);
        }
      }
      
      // Fix category
      const categoryCol = headers.indexOf("category");
      if (categoryCol !== -1) {
        const category = row[categoryCol];
        if (!category) {
          faqSheet.getRange(rowNum, categoryCol + 1).setValue("general");
        }
      }
    }
    
    Logger.log("FAQ sheet structure verified and fixed");
    return faqSheet;
  } catch (error) {
    Logger.log("ERROR in verifyAndFixFAQStructure: " + error.toString());
    throw error;
  }
}

// Password reset handler functions
function handleForgotPassword(params, sheet) {
  try {
    if (!params || !params.email) {
      Logger.log("Forgot password failed: Missing email parameter");
      return createJsonResponse({
        success: false,
        message: "Missing email parameter"
      });
    }
    
    const email = params.email.toLowerCase().trim();
    Logger.log("Handling forgot password request for email: " + email);
    
    // Validate email domain
    if (!isValidDHVSUEmail(email)) {
      Logger.log("Forgot password failed: Invalid email domain");
      return createJsonResponse({
        success: false,
        message: "Only DHVSU email addresses (@dhvsu.edu.ph) are allowed"
      });
    }
    
    // Check if email exists
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");
    const usernameCol = headers.indexOf("username");
    const resetTokenCol = headers.indexOf("reset_token");
    const tokenExpiryCol = headers.indexOf("token_expiry");
    
    if (emailCol === -1) {
      Logger.log("Forgot password failed: Email column not found");
      return createJsonResponse({
        success: false,
        message: "System error: Email column not found"
      });
    }
    
    // Look for user with matching email
    let userRow = -1;
    let username = '';
    for (let i = 1; i < data.length; i++) {
      const storedEmail = String(data[i][emailCol]).toLowerCase().trim();
      if (storedEmail === email) {
        userRow = i + 1; // +1 because sheets are 1-indexed
        username = data[i][usernameCol];
        break;
      }
    }
    
    if (userRow === -1) {
      Logger.log("Forgot password failed: Email not found - " + email);
      return createJsonResponse({
        success: false,
        message: "No account found with this email address"
      });
    }
    
    // Generate reset token and set expiry (1 hour from now)
    const token = Utilities.getUuid();
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);
    const expiryString = expiry.toISOString();
    
    // Update user record with token and expiry
    if (resetTokenCol !== -1) {
      sheet.getRange(userRow, resetTokenCol + 1).setValue(token);
    } else {
      Logger.log("Creating reset_token column");
      const lastCol = sheet.getLastColumn();
      sheet.getRange(1, lastCol + 1).setValue("reset_token");
      sheet.getRange(userRow, lastCol + 1).setValue(token);
    }
    
    if (tokenExpiryCol !== -1) {
      sheet.getRange(userRow, tokenExpiryCol + 1).setValue(expiryString);
    } else {
      Logger.log("Creating token_expiry column");
      const lastCol = sheet.getLastColumn();
      sheet.getRange(1, lastCol + 1).setValue("token_expiry");
      sheet.getRange(userRow, lastCol + 1).setValue(expiryString);
    }
    
    // Get the script URL from the deployment
    const scriptUrl = ScriptApp.getService().getUrl();
    const baseUrl = params.resetUrl || "https://your-actual-website-domain.com/";
    
    // Make sure we're not using localhost/127.0.0.1 in the reset link
    let resetLinkBase = baseUrl;
    if (resetLinkBase.includes('127.0.0.1') || resetLinkBase.includes('localhost')) {
      // Fall back to a hardcoded production URL if resetUrl is localhost
      resetLinkBase = "https://ren-code23.github.io/Honorian-Askbot/";
    }
    
    const resetLink = `${resetLinkBase}reset_password.html?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    
    // Send reset email using MailApp
    try {
      const subject = "Pampanga State University AskBot - Password Reset";
      const htmlBody = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #003366; color: white; padding: 15px; text-align: center; }
              .content { padding: 20px; border: 1px solid #ddd; }
              .button { background-color: #003366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
              .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Pampanga State University AskBot</h2>
              </div>
              <div class="content">
                <p>Hello ${username || "User"},</p>
                <p>We received a request to reset your password for the Pampanga State University AskBot. If you didn't make this request, you can ignore this email.</p>
                <p>To reset your password, please click the button below (link expires in 1 hour):</p>
                <p style="text-align: center;">
                  <a href="${resetLink}" class="button">Reset Your Password</a>
                </p>
                <p>Or copy and paste this link in your browser:</p>
                <p>${resetLink}</p>
                <p>If you're having trouble, please contact our support team.</p>
                <p>Best regards,<br>Pampanga State University</p>
              </div>
              <div class="footer">
                <p>This is an automated message, please do not reply to this email.</p>
              </div>
            </div>
          </body>
        </html>
      `;
      
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody,
        name: "Pampanga State University AskBot",
        replyTo: "no-reply@pampangastate.edu.ph"
      });
      
      Logger.log("Password reset email sent successfully to: " + email);
    } catch (emailError) {
      Logger.log("Failed to send password reset email: " + emailError.toString());
      // Continue even if email fails - we'll still return success to not reveal email sending failures
    }
    
    // Log the activity
    logActivity(username || email, "password_reset_request");
    
    // Return success
    return createJsonResponse({
      success: true,
      message: "Password reset instructions have been sent to your email address. Please check your inbox and spam folder."
    });
  } catch (error) {
    Logger.log("ERROR in handleForgotPassword: " + error.toString());
    return handleError(error, "forgot_password");
  }
}

function validateResetToken(params, sheet) {
  try {
    if (!params || !params.email || !params.token) {
      Logger.log("Token validation failed: Missing required parameters");
      return createJsonResponse({
        success: false,
        message: "Missing required parameters"
      });
    }
    
    const email = params.email.toLowerCase().trim();
    const token = params.token;
    
    Logger.log("Validating reset token for email: " + email);
    
    // Get user data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");
    const resetTokenCol = headers.indexOf("reset_token");
    const tokenExpiryCol = headers.indexOf("token_expiry");
    
    if (emailCol === -1 || resetTokenCol === -1 || tokenExpiryCol === -1) {
      Logger.log("Token validation failed: Required columns missing");
      return createJsonResponse({
        success: false,
        message: "System error: Required columns missing"
      });
    }
    
    // Find user with matching email
    let userRow = -1;
    let storedToken = '';
    let tokenExpiry = null;
    
    for (let i = 1; i < data.length; i++) {
      const storedEmail = String(data[i][emailCol]).toLowerCase().trim();
      if (storedEmail === email) {
        userRow = i;
        storedToken = data[i][resetTokenCol];
        tokenExpiry = data[i][tokenExpiryCol];
        break;
      }
    }
    
    if (userRow === -1) {
      Logger.log("Token validation failed: Email not found - " + email);
      return createJsonResponse({
        success: false,
        message: "No account found with this email address"
      });
    }
    
    // Check if token matches
    if (!storedToken || storedToken !== token) {
      Logger.log("Token validation failed: Invalid token");
      return createJsonResponse({
        success: false,
        message: "Invalid or expired reset token"
      });
    }
    
    // Check if token has expired
    if (!tokenExpiry) {
      Logger.log("Token validation failed: No expiry time set");
      return createJsonResponse({
        success: false,
        message: "Invalid or expired reset token"
      });
    }
    
    const expiryTime = new Date(tokenExpiry).getTime();
    const currentTime = new Date().getTime();
    
    if (currentTime > expiryTime) {
      Logger.log("Token validation failed: Token expired");
      return createJsonResponse({
        success: false,
        message: "This reset link has expired. Please request a new one."
      });
    }
    
    // Token is valid
    Logger.log("Token validation successful for email: " + email);
    return createJsonResponse({
      success: true,
      message: "Token is valid"
    });
  } catch (error) {
    Logger.log("ERROR in validateResetToken: " + error.toString());
    return handleError(error, "validate_reset_token");
  }
}

function handleResetPassword(params, sheet) {
  try {
    if (!params || !params.email || !params.token || !params.password) {
      Logger.log("Reset password failed: Missing required parameters");
      return createJsonResponse({
        success: false,
        message: "Missing required parameters"
      });
    }
    
    const email = params.email.toLowerCase().trim();
    const token = params.token;
    const newPassword = params.password;
    
    Logger.log("Handling password reset for email: " + email);
    
    // First validate the token
    const validationResponse = validateResetToken(params, sheet);
    const validationResult = JSON.parse(validationResponse.getContent());
    
    if (!validationResult.success) {
      Logger.log("Reset password failed: Token validation failed");
      return createJsonResponse({
        success: false,
        message: validationResult.message
      });
    }
    
    // Get user data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");
    const passwordCol = headers.indexOf("password");
    const resetTokenCol = headers.indexOf("reset_token");
    const tokenExpiryCol = headers.indexOf("token_expiry");
    const usernameCol = headers.indexOf("username");
    
    if (emailCol === -1 || passwordCol === -1) {
      Logger.log("Reset password failed: Required columns missing");
      return createJsonResponse({
        success: false,
        message: "System error: Required columns missing"
      });
    }
    
    // Find user with matching email
    let userRow = -1;
    let username = '';
    
    for (let i = 1; i < data.length; i++) {
      const storedEmail = String(data[i][emailCol]).toLowerCase().trim();
      if (storedEmail === email) {
        userRow = i + 1; // +1 because sheets are 1-indexed
        username = data[i][usernameCol];
        break;
      }
    }
    
    if (userRow === -1) {
      Logger.log("Reset password failed: Email not found - " + email);
      return createJsonResponse({
        success: false,
        message: "No account found with this email address"
      });
    }
    
    // Update password
    sheet.getRange(userRow, passwordCol + 1).setValue(newPassword);
    
    // Clear token and expiry
    if (resetTokenCol !== -1) {
      sheet.getRange(userRow, resetTokenCol + 1).setValue("");
    }
    
    if (tokenExpiryCol !== -1) {
      sheet.getRange(userRow, tokenExpiryCol + 1).setValue("");
    }
    
    // Log the activity
    logActivity(username || email, "password_reset_success");
    
    // Return success
    return createJsonResponse({
      success: true,
      message: "Your password has been successfully reset."
    });
  } catch (error) {
    Logger.log("ERROR in handleResetPassword: " + error.toString());
    return handleError(error, "reset_password");
  }
}
