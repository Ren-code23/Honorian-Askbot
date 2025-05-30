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

    // Try to parse parameters from multiple sources
    let params = {};
    
    // 1. First check for direct URL parameters - these are most reliable
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      Logger.log("Found parameters in e.parameter");
      params = Object.assign({}, e.parameter);
    }
    
    // 2. Then try FormData - how FormData is usually received
    if (Object.keys(params).length === 0 && e.postData && e.postData.type === "application/x-www-form-urlencoded") {
      Logger.log("Found form-urlencoded data");
      try {
        if (e.postData.contents) {
          // Parse form data
          const formDataPairs = e.postData.contents.split('&');
          formDataPairs.forEach(pair => {
            const [key, value] = pair.split('=').map(decodeURIComponent);
            if (key && value !== undefined) {
              params[key] = value;
            }
          });
          Logger.log("Parsed form data: " + JSON.stringify(params));
        }
      } catch (formError) {
        Logger.log("Warning: Error parsing form data: " + formError.toString());
      }
    }
    
    // 3. Try multipart form data
    if (Object.keys(params).length === 0 && e.postData && e.postData.type && e.postData.type.indexOf("multipart/form-data") !== -1) {
      Logger.log("Found multipart form data, parameters should be in e.parameter");
      // Parameters from multipart form data should already be in e.parameter
      // This is just a fallback check
    }
    
    // 4. Finally try JSON data
    if (Object.keys(params).length === 0 && e.postData && e.postData.contents) {
      try {
        Logger.log("Attempting to parse postData.contents as JSON");
        const postData = JSON.parse(e.postData.contents);
        params = Object.assign({}, postData);
        Logger.log("Successfully parsed postData as JSON");
      } catch (parseError) {
        Logger.log("Warning: Could not parse postData contents as JSON: " + parseError.toString());
      }
    }

    Logger.log("Final parsed parameters: " + JSON.stringify(params));

    // Check if this is a callback request (for iframe approach)
    const callback = params.callback;
    const isIframeRequest = callback === 'parent';
    
    if (Object.keys(params).length === 0) {
      const errorResponse = {
        success: false,
        message: "No parameters found in request. If you're using FormData, make sure you're not setting Content-Type manually.",
        error: "MISSING_PARAMETERS"
      };
      
      if (isIframeRequest) {
        return ContentService.createTextOutput(
          `<html><body><script>parent.postMessage({action:"signup_response", success:false, message:"No parameters found in request"}, "*");</script></body></html>`
        ).setMimeType(ContentService.MimeType.HTML);
      }
      
      return createJsonResponse(errorResponse);
    }

    const action = params.action;
    
    if (!action) {
      const errorResponse = {
        success: false,
        message: "No action specified",
        error: "MISSING_ACTION"
      };
      
      if (isIframeRequest) {
        return ContentService.createTextOutput(
          `<html><body><script>parent.postMessage({action:"signup_response", success:false, message:"No action specified"}, "*");</script></body></html>`
        ).setMimeType(ContentService.MimeType.HTML);
      }
      
      return createJsonResponse(errorResponse);
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
        case "test":
          // Simple test endpoint for connection testing
          return createJsonResponse({
            success: true,
            message: "Backend connection test successful",
            timestamp: new Date().toISOString()
          });
        case "login":
          return handleLogin(params, userSheet);
        case "signup":
          return handleSignup(params, userSheet);
        case "forgotPassword":
          return handleForgotPassword(params, userSheet);
        case "validateResetToken":
          return validateResetToken(params, userSheet);
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
        case "checkEmailExists":
          return handleCheckEmailExists(params, userSheet);
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
 * Added admin role preservation to ensure admin status isn't lost.
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
  const roleCol = headers.indexOf("role");
  const emailCol = headers.indexOf("email");
  
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
      const role = data[i][roleCol];
      const email = emailCol !== -1 ? data[i][emailCol] : '';
      
      // Check if user is an admin and ensure role preservation
      const isAdmin = (role === 'admin') || 
                     (sheetUsername === 'admin') || 
                     (email && email.includes('admin@'));
      
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
      
      Logger.log(`[RateLimit] Found user. Now: ${now}, Last: ${lastTime}, Diff: ${now - lastTime}, Role: ${role}`);
      
      if (lastTime && now - lastTime < RATE_LIMIT_COOLDOWN_MS) {
        Logger.log(`[RateLimit] BLOCKED: User sent message too soon. Wait ${(RATE_LIMIT_COOLDOWN_MS - (now - lastTime))/1000}s more.`);
        return { allowed: false, reason: "Too soon" };
      }
      
      // Only update the last_message_time column and don't touch other columns
      sheet.getRange(i + 1, lastMsgCol + 1).setValue(new Date().toISOString());
      
      // If this is an admin but the role is not 'admin', fix it
      if (isAdmin && role !== 'admin' && roleCol !== -1) {
        sheet.getRange(i + 1, roleCol + 1).setValue('admin');
        Logger.log("[RateLimit] NOTICE: Reset admin role for user: " + sheetUsername);
      }
      
      Logger.log("[RateLimit] ALLOWED: Updated last_message_time only.");
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
  try {
    Logger.log("Response data: " + JSON.stringify(data));
    
    // Check if this is a callback request (for iframe approach)
    if (data && data._callback) {
      const callback = data._callback;
      delete data._callback; // Remove from the data object
      
      // Return HTML with script to call the parent window's callback function
      const scriptContent = `
        <html><body><script>
          try {
            if (window.parent && window.parent.${callback}) {
              window.parent.${callback}(${JSON.stringify(data)});
            } else {
              window.parent.postMessage(${JSON.stringify(data)}, "*");
            }
          } catch(e) {
            console.error("Error posting message to parent", e);
            window.parent.postMessage(${JSON.stringify(data)}, "*");
          }
        </script></body></html>
      `;
      
      return ContentService.createTextOutput(scriptContent)
        .setMimeType(ContentService.MimeType.HTML);
    }
    
    const output = ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
    
    // Enhanced CORS headers for better compatibility
    output.addHeader('Access-Control-Allow-Origin', '*');
    output.addHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    output.addHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    output.addHeader('Access-Control-Max-Age', '3600');
    output.addHeader('X-Content-Type-Options', 'nosniff');
    
    return output;
  } catch (error) {
    Logger.log("ERROR creating JSON response: " + error.toString());
    const fallbackOutput = ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Error creating response: " + error.message
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
    fallbackOutput.addHeader('Access-Control-Allow-Origin', '*');
    fallbackOutput.addHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    fallbackOutput.addHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return fallbackOutput;
  }
}

// Helper function to validate DHVSU email domain
function isValidDHVSUEmail(email) {
  if (!email) return false;
  email = email.toLowerCase().trim();
  return email.endsWith('@dhvsu.edu.ph') && email.indexOf('@') > 0;
}

function handleSignup(params, sheet) {
  try {
    if (!params || !params.username || !params.email || !params.password) {
      return createJsonResponse({
        success: false,
        message: "All fields are required"
      });
    }

    const username = params.username.trim();
    const email = params.email.toLowerCase().trim();
    const hashedPassword = params.password.trim(); // This is already SHA-256 hashed from the frontend

    // Validate email format
    if (!isValidDHVSUEmail(email)) {
      return createJsonResponse({
        success: false,
        message: "Only DHVSU email addresses (@dhvsu.edu.ph) are allowed"
      });
    }

    // Get all data at once
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf("username");
    const emailCol = headers.indexOf("email");

    if (usernameCol === -1 || emailCol === -1) {
      return createJsonResponse({
        success: false,
        message: "System error: Required columns missing"
      });
    }

    // Check for existing username or email - case insensitive for email
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[usernameCol]).trim() === username) {
        return createJsonResponse({
          success: false,
          message: "Username already exists"
        });
      }
      if (String(row[emailCol]).toLowerCase().trim() === email) {
        return createJsonResponse({
          success: false,
          message: "Email already registered"
        });
      }
    }

    // Prepare new user data
    const newRow = Array(headers.length).fill("");
    const idCol = headers.indexOf("id");
    const passwordCol = headers.indexOf("password");
    const dateCol = headers.indexOf("dateCreated");
    const roleCol = headers.indexOf("role");

    // Generate a unique ID
    const newId = Utilities.getUuid();
    
    // Fill in the user data - storing the already hashed password
    if (idCol !== -1) newRow[idCol] = newId;
    if (usernameCol !== -1) newRow[usernameCol] = username;
    if (emailCol !== -1) newRow[emailCol] = email;
    if (passwordCol !== -1) newRow[passwordCol] = hashedPassword;
    if (dateCol !== -1) newRow[dateCol] = new Date().toISOString();
    if (roleCol !== -1) newRow[roleCol] = "student";

    // Append the new user
    sheet.appendRow(newRow);

    // Verify the user was actually created
    const verifyData = sheet.getDataRange().getValues();
    let userCreated = false;
    
    for (let i = 1; i < verifyData.length; i++) {
      const row = verifyData[i];
      if (String(row[emailCol]).toLowerCase().trim() === email) {
        userCreated = true;
        break;
      }
    }

    if (!userCreated) {
      throw new Error("Failed to verify user creation");
    }

    // Log the signup
    try {
      logActivity(email, "signup", "New user registration");
    } catch (e) {
      console.error("Signup log error:", e);
    }

    return createJsonResponse({
      success: true,
      message: "User registered successfully",
      username: username,
      email: email
    });

  } catch (error) {
    console.error("Signup error:", error);
    return createJsonResponse({
      success: false,
      message: "Server error: " + error.message
    });
  }
}

function handleLogin(params, sheet) {
  try {
    if (!params || !params.email || !params.password) {
      return createJsonResponse({
        success: false,
        message: "Missing email or password"
      });
    }

    const email = params.email.toLowerCase().trim();
    const hashedPassword = params.password; // This is already SHA-256 hashed from the frontend
    
    // Validate email format first
    if (!isValidDHVSUEmail(email)) {
      return createJsonResponse({
        success: false,
        message: "Only DHVSU email addresses (@dhvsu.edu.ph) are allowed"
      });
    }

    // Get all data at once for faster processing
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");
    const passwordCol = headers.indexOf("password");
    const usernameCol = headers.indexOf("username");
    const roleCol = headers.indexOf("role");

    if (emailCol === -1 || passwordCol === -1 || usernameCol === -1) {
      return createJsonResponse({
        success: false,
        message: "System error: Required columns missing"
      });
    }

    // Find user by email - case insensitive comparison
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const storedEmail = String(row[emailCol]).toLowerCase().trim();
      const storedPassword = String(row[passwordCol]).trim();
      
      if (storedEmail === email) {
        // Compare passwords exactly as stored - both should already be SHA-256 hashed
        if (storedPassword === hashedPassword) {
          const username = String(row[usernameCol]).trim();
          const role = roleCol !== -1 ? (String(row[roleCol]).trim() || "student") : "student";
          
          // Log successful login
          try {
            logActivity(email, "login", "Successful login");
          } catch (e) {
            console.error("Login log error:", e);
          }

          return createJsonResponse({
            success: true,
            message: "Login successful",
            username: username,
            email: email,
            role: role
          });
        } else {
          // Log failed attempt but don't expose details
          console.log("Password mismatch for " + email);
          console.log("Expected hash: " + storedPassword);
          console.log("Received hash: " + hashedPassword);
          
          return createJsonResponse({
            success: false,
            message: "Invalid password"
          });
        }
      }
    }

    return createJsonResponse({
      success: false,
      message: "Email not found"
    });

  } catch (error) {
    console.error("Login error:", error);
    return createJsonResponse({
      success: false,
      message: "Server error: " + error.message
    });
  }
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
  const username = params.username;
  
  // Need either email or username
  if (!email && !username) {
    Logger.log("ERROR: Missing email or username for deletion");
    return createJsonResponse({ success: false, message: "Username or email required for deletion." });
  }
  
  Logger.log("Deleting user by " + (email ? "email: " + email : "username: " + username));
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf("email");
  const usernameCol = headers.indexOf("username");
  
  if (emailCol === -1 && usernameCol === -1) {
    return createJsonResponse({ success: false, message: "Email or username column not found." });
  }
  
  for (let i = 1; i < data.length; i++) {
    // Match by email or username
    if ((email && emailCol !== -1 && data[i][emailCol] === email) ||
        (username && usernameCol !== -1 && data[i][usernameCol] === username)) {
      sheet.deleteRow(i + 1);
      Logger.log("User deleted: " + (email || username));
      return createJsonResponse({ success: true, message: "User deleted successfully." });
    }
  }
  
  Logger.log("User not found for deletion: " + (email || username));
  return createJsonResponse({ success: false, message: "User not found." });
}

function handleUpdateUser(params, sheet) {
  if (!params) throw new Error('This function must be called via web request with parameters.');
  
  // Get parameters
  const username = params.username;
  const email = params.email;
  const role = params.role;
  
  // Need either email or username
  if (!email && !username) {
    Logger.log("ERROR: Missing email or username for updating");
    return createJsonResponse({ success: false, message: "Username or email required for updating." });
  }
  
  Logger.log("ADMIN ACTION: Attempting to update user. " +
            (email ? "Email: " + email : "Username: " + username) + 
            (role ? ", New role: " + role : ""));
  
  // If email is provided, validate domain
  if (email && !email.toLowerCase().endsWith('@dhvsu.edu.ph')) {
    Logger.log("User update failed: Invalid email domain");
    return createJsonResponse({ success: false, message: "Only DHVSU email addresses (@dhvsu.edu.ph) are allowed." });
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf("email");
  const usernameCol = headers.indexOf("username");
  const roleCol = headers.indexOf("role");
  
  if ((emailCol === -1 && usernameCol === -1) || roleCol === -1) {
    return createJsonResponse({ success: false, message: "Required columns not found." });
  }
  
  for (let i = 1; i < data.length; i++) {
    // Match by either email or username
    if ((email && emailCol !== -1 && data[i][emailCol] === email) ||
        (username && usernameCol !== -1 && data[i][usernameCol] === username)) {
      
      const currentRole = data[i][roleCol] || "student";
      
      // Update role if provided
      if (role) {
        sheet.getRange(i + 1, roleCol + 1).setValue(role);
        Logger.log(`ROLE UPDATE: User ${email || username} role changed from '${currentRole}' to '${role}'`);
      }
      
      // Update email if new email provided (and different username was used to find user)
      if (email && username && emailCol !== -1 && data[i][emailCol] !== email) {
        sheet.getRange(i + 1, emailCol + 1).setValue(email);
        Logger.log(`EMAIL UPDATE: User ${username} email changed to '${email}'`);
      }
      
      // Update username if new username provided (and different email was used to find user)
      if (username && email && usernameCol !== -1 && data[i][usernameCol] !== username) {
        sheet.getRange(i + 1, usernameCol + 1).setValue(username);
        Logger.log(`USERNAME UPDATE: User ${email} username changed to '${username}'`);
      }
      
      return createJsonResponse({ success: true, message: "User updated successfully." });
    }
  }
  
  Logger.log("User update failed: User not found - " + (email || username));
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
  const categoryCol = headers.indexOf("category"); // Get category column if exists
  const faqIdCol = headers.indexOf("faqId"); // May contain reference to FAQ for category

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

  // Get FAQs to cross-reference categories if needed
  let faqCategories = {};
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const faqSheet = ss.getSheetByName("FAQs");
    if (faqSheet) {
      const faqData = faqSheet.getDataRange().getValues();
      const faqHeaders = faqData[0];
      const faqIdCol = faqHeaders.indexOf("id");
      const faqCatCol = faqHeaders.indexOf("category");
      
      if (faqIdCol !== -1 && faqCatCol !== -1) {
        for (let i = 1; i < faqData.length; i++) {
          const id = faqData[i][faqIdCol];
          const category = faqData[i][faqCatCol];
          if (id && category) {
            faqCategories[id] = category;
          }
        }
      }
    }
  } catch (e) {
    Logger.log("Error loading FAQ categories: " + e.toString());
  }

  // Filter conversations for this user
  const userHistory = [];
  
  // Keep track of used timestamps to ensure uniqueness
  const usedTimestamps = new Set();
  
  for (let i = 1; i < data.length; i++) {
    if (
      (emailCol !== -1 && data[i][emailCol] === identifier) ||
      (usernameCol !== -1 && data[i][usernameCol] === identifier)
    ) {
      // Process timestamp with improved handling
      let timestamp = data[i][timestampCol];
      let formattedTimestamp = timestamp;
      let timestampObj = null;
      
      try {
        if (typeof timestamp === 'string') {
          // Parse string timestamp
          timestampObj = new Date(timestamp);
          if (!isNaN(timestampObj.getTime())) {
            formattedTimestamp = timestampObj.toISOString();
          }
        } else if (timestamp instanceof Date) {
          // Direct Date object
          timestampObj = timestamp;
          formattedTimestamp = timestamp.toISOString();
        } else if (typeof timestamp === 'object' && timestamp !== null) {
          // Google Sheets date object format
          if (timestamp.year) {
            timestampObj = new Date(
              timestamp.year, 
              timestamp.month - 1, 
              timestamp.day || 1, 
              timestamp.hours || 0, 
              timestamp.minutes || 0,
              timestamp.seconds || 0
            );
            formattedTimestamp = timestampObj.toISOString();
          }
        }
      } catch (e) {
        Logger.log("Error formatting timestamp: " + e.toString());
      }
      
      // Create uniqueness if parsing failed or timestamp already exists
      if (!timestampObj || isNaN(timestampObj.getTime()) || usedTimestamps.has(formattedTimestamp)) {
        // Use current time with random milliseconds for uniqueness
        const now = new Date();
        // Add some randomness to ensure uniqueness (i value + random ms)
        now.setMilliseconds(now.getMilliseconds() + i + Math.floor(Math.random() * 1000));
        formattedTimestamp = now.toISOString();
        timestampObj = now;
      }
      
      // Add this timestamp to the used set to ensure uniqueness
      usedTimestamps.add(formattedTimestamp);
      
      // Determine category with improved detection logic
      let category = "general";
      
      // First check if category is directly available in the sheet
      if (categoryCol !== -1 && data[i][categoryCol] && data[i][categoryCol].toString().trim() !== "") {
        category = data[i][categoryCol].toString().trim().toLowerCase();
      }
      // Then check if we can get it from FAQ reference
      else if (faqIdCol !== -1 && data[i][faqIdCol] && faqCategories[data[i][faqIdCol]]) {
        category = faqCategories[data[i][faqIdCol]].toLowerCase();
      }
      // Otherwise infer from question content
      else {
        const question = data[i][questionCol].toLowerCase();
        
        if (question.includes("id") || question.includes("card") || question.includes("registration") ||
            question.includes("certificate") || question.includes("record") || question.includes("transcript")) {
          category = "registrar";
        } 
        else if (question.includes("enroll") || question.includes("admission") || 
                question.includes("apply") || question.includes("application")) {
          category = "admissions";
        }
        else if (question.includes("class") || question.includes("course") || 
                question.includes("program") || question.includes("subject")) {
          category = "academics";
        }
        else if (question.includes("president") || question.includes("dean") || 
                question.includes("director") || question.includes("admin")) {
          category = "administration";
        }
        else if (question.includes("scholarship") || question.includes("library") || 
                question.includes("dormitory") || question.includes("student service")) {
          category = "student-services";
        }
      }
      
      userHistory.push({
        timestamp: formattedTimestamp,
        question: data[i][questionCol],
        answer: data[i][answerCol],
        category: category
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
  
  // Ensure the comment column exists in the sheet
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Add 'comment' column if missing
  let commentCol = headers.indexOf('comment');
  if (commentCol === -1) {
    sheet.insertColumnAfter(headers.length);
    sheet.getRange(1, headers.length + 1).setValue('comment');
    commentCol = headers.length; // New column index is the previous length
  }
  
  // Create new row data
  const rowData = [timestamp, username, message, feedbackType];
  
  // Add comment in the right position
  while (rowData.length <= commentCol) {
    rowData.push('');
  }
  rowData[commentCol] = comment;
  
  // Append the row
  sheet.appendRow(rowData);
  
  Logger.log(`Feedback logged: ${username} - ${feedbackType}${comment ? " - " + comment : ""}`);
  
  return createJsonResponse({ 
    success: true, 
    message: "Feedback logged successfully." 
  });
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

/**
 * Add a new FAQ to the database
 */
function handleAddFAQ(params, sheet) {
  try {
    if (!params) throw new Error('This function must be called via web request with parameters.');
    Logger.log("Adding new FAQ");
    
    // Validate required parameters
    const question = params.question;
    const answer = params.answer;
    
    if (!question || !answer) {
      Logger.log("Missing required parameters for FAQ");
      return createJsonResponse({
        success: false,
        message: "Question and answer are required"
      });
    }
    
    // Get optional parameters
    const keywords = params.keywords || "";
    const status = params.status || "pending";
    const category = params.category || "general";
    const priority = params.priority || "3";
    
    // Ensure headers exist
    ensureFAQHeaders(sheet);
    
    // Create a new FAQ with unique ID
    const newId = Utilities.getUuid();
    sheet.appendRow([
      newId,
      question,
      answer,
      keywords,
      status,
      category,
      priority
    ]);
    
    Logger.log("New FAQ added successfully with ID: " + newId);
    
    // Log the activity
    logActivity(params.username || "unknown", "add_faq", "Added FAQ: " + question);
    
    return createJsonResponse({
      success: true,
      message: "FAQ added successfully",
      id: newId
    });
  } catch (error) {
    Logger.log("Error in handleAddFAQ: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Error adding FAQ: " + error.toString()
    });
  }
}

/**
 * Edit an existing FAQ
 */
function handleEditFAQ(params, sheet) {
  try {
    if (!params) throw new Error('This function must be called via web request with parameters.');
    
    // Validate required parameters
    const id = params.id;
    const question = params.question;
    const answer = params.answer;
    
    if (!id || !question || !answer) {
      Logger.log("Missing required parameters for FAQ edit");
      return createJsonResponse({
        success: false,
        message: "ID, question, and answer are required"
      });
    }
    
    Logger.log("Editing FAQ with ID: " + id);
    
    // Get optional parameters
    const keywords = params.keywords || "";
    const status = params.status || "pending";
    const category = params.category || "general";
    const priority = params.priority || "3";
    
    // Find the FAQ in the sheet
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf("id");
    const questionCol = headers.indexOf("question");
    const answerCol = headers.indexOf("answer");
    const keywordsCol = headers.indexOf("keywords");
    const statusCol = headers.indexOf("status");
    const categoryCol = headers.indexOf("category");
    const priorityCol = headers.indexOf("priority");
    
    // Validate required columns
    if (idCol === -1 || questionCol === -1 || answerCol === -1) {
      Logger.log("Required columns missing in FAQ sheet");
      return createJsonResponse({
        success: false,
        message: "Database structure error"
      });
    }
    
    // Find the row with the matching FAQ ID
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === id) {
        rowIndex = i + 1; // +1 because sheet rows are 1-indexed
        break;
      }
    }
    
    if (rowIndex === -1) {
      Logger.log("FAQ with ID " + id + " not found");
      return createJsonResponse({
        success: false,
        message: "FAQ not found"
      });
    }
    
    // Update the FAQ
    sheet.getRange(rowIndex, questionCol + 1).setValue(question);
    sheet.getRange(rowIndex, answerCol + 1).setValue(answer);
    
    if (keywordsCol !== -1) {
      sheet.getRange(rowIndex, keywordsCol + 1).setValue(keywords);
    }
    
    if (statusCol !== -1) {
      sheet.getRange(rowIndex, statusCol + 1).setValue(status);
    }
    
    if (categoryCol !== -1) {
      sheet.getRange(rowIndex, categoryCol + 1).setValue(category);
    }
    
    if (priorityCol !== -1) {
      sheet.getRange(rowIndex, priorityCol + 1).setValue(priority);
    }
    
    Logger.log("FAQ updated successfully");
    
    // Log the activity
    logActivity(params.username || "unknown", "edit_faq", "Edited FAQ: " + id);
    
    return createJsonResponse({
      success: true,
      message: "FAQ updated successfully"
    });
  } catch (error) {
    Logger.log("Error in handleEditFAQ: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Error updating FAQ: " + error.toString()
    });
  }
}

/**
 * Delete an FAQ
 */
function handleDeleteFAQ(params, sheet) {
  try {
    if (!params) throw new Error('This function must be called via web request with parameters.');
    
    // Validate required parameters
    const id = params.id;
    
    if (!id) {
      Logger.log("Missing FAQ ID for deletion");
      return createJsonResponse({
        success: false,
        message: "FAQ ID is required"
      });
    }
    
    Logger.log("Deleting FAQ with ID: " + id);
    
    // Find the FAQ in the sheet
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf("id");
    
    if (idCol === -1) {
      Logger.log("ID column missing in FAQ sheet");
      return createJsonResponse({
        success: false,
        message: "Database structure error"
      });
    }
    
    // Find the row with the matching FAQ ID
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === id) {
        rowIndex = i + 1; // +1 because sheet rows are 1-indexed
        break;
      }
    }
    
    if (rowIndex === -1) {
      Logger.log("FAQ with ID " + id + " not found");
      return createJsonResponse({
        success: false,
        message: "FAQ not found"
      });
    }
    
    // Delete the FAQ
    sheet.deleteRow(rowIndex);
    
    Logger.log("FAQ deleted successfully");
    
    // Log the activity
    logActivity(params.username || "unknown", "delete_faq", "Deleted FAQ: " + id);
    
    return createJsonResponse({
      success: true,
      message: "FAQ deleted successfully"
    });
  } catch (error) {
    Logger.log("Error in handleDeleteFAQ: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Error deleting FAQ: " + error.toString()
    });
  }
}

// --- Improved FAQ Matching ---
function findBestMatches(userQuestion, faqs, maxSuggestions = 3) {
  // Normalize input
  function normalize(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Enhanced keyword matching with synonyms
  function enhancedKeywordMatching(userText, keywords) {
    if (!keywords || !userText) return 0;
    
    const keywordsList = keywords.toLowerCase().split(',').map(k => k.trim());
    let matches = 0;
    
    // Synonym dictionary for educational terms
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
        Logger.log("Keyword match: " + keyword);
      }
      
      // Check synonym matches
      Object.keys(synonyms).forEach(key => {
        if (keyword.includes(key) || key.includes(keyword)) {
          synonyms[key].forEach(synonym => {
            if (userText.includes(synonym)) {
              matches += 0.7; // Slightly lower weight for synonyms
              Logger.log("Synonym match: " + synonym + " for keyword " + keyword);
            }
          });
        }
      });
    });
    
    return Math.min(1, matches / Math.max(keywordsList.length, 1));
  }

  const userQNorm = normalize(userQuestion);
  
  // Detect question intent/topic for boosting
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

  Logger.log(`Question analysis - about ID: ${isAboutId}, transcript: ${isAboutTranscript}, location: ${isAboutLocation}`);
  
  let scoredFaqs = faqs.map(faq => {
    const faqQNorm = normalize(faq.question);
    let score = 0;

    // Exact match (100 points)
    if (faqQNorm === userQNorm) {
      score = 100;
      Logger.log("Exact match found: " + faqQNorm);
    } else {
      // Jaccard similarity (up to 40 points)
      const userWords = new Set(userQNorm.split(' '));
      const faqWords = new Set(faqQNorm.split(' '));
      const intersection = new Set([...userWords].filter(x => faqWords.has(x)));
      const union = new Set([...userWords, ...faqWords]);
      const jaccard = intersection.size / union.size;
      score += jaccard * 40;
      
      if (jaccard > 0.3) {
        Logger.log(`Good jaccard match (${jaccard.toFixed(2)}) for: ${faq.question}`);
      }

      // Enhanced keyword matching with synonyms (up to 30 points)
      if (faq.keywords) {
        const keywordScore = enhancedKeywordMatching(userQNorm, faq.keywords);
        score += keywordScore * 30;
        
        if (keywordScore > 0.3) {
          Logger.log(`Good keyword match (${keywordScore.toFixed(2)}) for: ${faq.question}`);
        }
      }

      // Topic-specific boosts (up to 20 points)
      // For ID questions, boost ID-related FAQs
      if (isAboutId && (
          faqQNorm.includes('id') || 
          faqQNorm.includes('identification') || 
          faqQNorm.includes('card'))) {
        score += 20;
        Logger.log("Applied ID topic boost to: " + faq.question);
      }
      
      // For transcript questions, boost transcript-related FAQs
      else if (isAboutTranscript && (
          faqQNorm.includes('transcript') || 
          faqQNorm.includes('tor') || 
          faqQNorm.includes('record'))) {
        score += 20;
        Logger.log("Applied transcript topic boost to: " + faq.question);
      }
      
      // For location questions, boost location-related FAQs
      else if (isAboutLocation && (
          faqQNorm.includes('where') || 
          faqQNorm.includes('location') || 
          faqQNorm.includes('office'))) {
        score += 15;
        Logger.log("Applied location topic boost to: " + faq.question);
      }

      // Phrase matching (15 points)
      if (faqQNorm.includes(userQNorm) || userQNorm.includes(faqQNorm)) {
        score += 15;
        Logger.log("Phrase match found between user Q and FAQ Q");
      }
    }

    // Priority boost (up to 5 points)
    if (faq.priority) {
      const priority = parseInt(faq.priority) || 3;
      score += (6 - priority); // Higher priority (1-5) gives more points
    }

    return { ...faq, _score: score };
  });

  scoredFaqs = scoredFaqs
    .filter(faq => faq._score > 0)
    .sort((a, b) => b._score - a._score);

  // Higher threshold (25) for better precision
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
      
      suggestions = [...suggestions, ...remainingSuggestions];
    }
  }

  Logger.log(`Best match score: ${bestMatch ? bestMatch._score.toFixed(2) : 'none'}`);
  Logger.log(`Number of suggestions: ${suggestions.length}`);
  if (bestMatch) {
    Logger.log(`Best match question: ${bestMatch.question}`);
  }

  return { bestMatch, suggestions };
}

// --- Import the enhanced FAQ matcher ---
// Note: Since Apps Script doesn't support ES6 imports, we need to ensure faq_matcher.js is included in the project

// Update the handleChatMessage function to use the improved matcher
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
    
    // Parse context if available
    let context = null;
    try {
      if (e.parameter.context) {
        context = JSON.parse(e.parameter.context);
        Logger.log("Parsed context: " + JSON.stringify(context));
      }
    } catch (error) {
      Logger.log("Error parsing context: " + error.toString());
      // Continue without context if parsing fails
    }

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
    const statusCol = headers.indexOf("status");

    if (questionCol === -1 || answerCol === -1) {
      Logger.log("ERROR: FAQ sheet missing required columns");
      return createJsonResponse({ 
        success: false, 
        message: "FAQ database error",
        error: "INVALID_FAQ_STRUCTURE"
      });
    }

    // Process FAQs - only include approved FAQs
    for (let i = 1; i < data.length; i++) {
      // Skip inactive/unapproved FAQs
      if (statusCol !== -1 && data[i][statusCol] !== "approved" && data[i][statusCol] !== "") {
        continue;
      }
      
      faqs.push({
        question: data[i][questionCol],
        answer: data[i][answerCol],
        keywords: keywordsCol !== -1 ? data[i][keywordsCol] : "",
        clarificationOptions: clarificationCol !== -1 ? data[i][clarificationCol] : "",
        followUpQuestions: followUpCol !== -1 ? data[i][followUpCol] : "",
        requiresClarification: requiresClarCol !== -1 ? 
          (data[i][requiresClarCol] === true || 
           data[i][requiresClarCol] === "TRUE" || 
           data[i][requiresClarCol] === "true") : false,
        category: categoryCol !== -1 ? data[i][categoryCol] : "",
        priority: priorityCol !== -1 ? data[i][priorityCol] : "3"
      });
    }

    Logger.log(`Loaded ${faqs.length} FAQs for processing`);

    // Special handling for clarification responses
    if (context && context.awaitingClarification && context.originalQuestion) {
      Logger.log("Processing clarification response to: " + context.originalQuestion);
      
      // Find the original FAQ that needed clarification
      const originalFAQ = faqs.find(faq => 
        faq.question.toLowerCase() === context.originalQuestion.toLowerCase());
        
      if (originalFAQ) {
        // Try to match clarification response with one of the options
        let matchedClarification = null;
        let clarificationOptions = [];
        
        try {
          // Parse clarification options if they exist
          if (originalFAQ.clarificationOptions) {
            if (typeof originalFAQ.clarificationOptions === 'string') {
              if (originalFAQ.clarificationOptions.startsWith('[') && 
                  originalFAQ.clarificationOptions.endsWith(']')) {
                clarificationOptions = JSON.parse(originalFAQ.clarificationOptions);
              } else {
                clarificationOptions = originalFAQ.clarificationOptions.split('|').map(o => ({
                  text: o.trim(),
                  response: ""
                }));
              }
            }
            
            // Find matching option
            matchedClarification = clarificationOptions.find(option => 
              userQuestion.toLowerCase().includes(option.text.toLowerCase()));
          }
        } catch (error) {
          Logger.log("Error processing clarification options: " + error.toString());
        }
        
        if (matchedClarification && matchedClarification.response) {
          // If matching option found, return its response
          Logger.log("Matched clarification option: " + matchedClarification.text);
          
          // Generate unique timestamp with milliseconds
          const now = new Date();
          const timestamp = now.toISOString();
          
          const conversationId = Utilities.getUuid();
          let row = [
            conversationId, username, email, userQuestion,
            matchedClarification.response, timestamp
          ];
          
          // Add category if column exists
          const convHeaders = conversationSheet.getRange(1, 1, 1, conversationSheet.getLastColumn()).getValues()[0];
          const convCategoryCol = convHeaders.indexOf('category');
          if (convCategoryCol !== -1) {
            while (row.length < convCategoryCol) row.push("");
            row[convCategoryCol] = originalFAQ.category || '';
          }
          
          conversationSheet.appendRow(row);
          
          // Return clarification response
          return createJsonResponse({
            success: true,
            type: "direct_answer",
            answer: matchedClarification.response,
            followUpQuestions: [],
            suggestions: [],
            context: {
              lastQuestion: userQuestion,
              lastCategory: originalFAQ.category || '',
              timestamp: timestamp,
              user: username
            }
          });
        }
      }
      
      // If we couldn't match a clarification option, continue with normal processing
      Logger.log("No matching clarification option found, proceeding with normal processing");
    }

    // --- START OF ADDED PREPROCESSING ---
    // Special preprocessing for common question topics
    const lowercaseQuestion = userQuestion.toLowerCase();
    
    // Log basic question analysis
    Logger.log(`Processing question: "${userQuestion}"`);
    Logger.log(`Question contains "id": ${lowercaseQuestion.includes('id')}`);
    Logger.log(`Question contains "where": ${lowercaseQuestion.includes('where')}`);
    Logger.log(`Question contains "how": ${lowercaseQuestion.includes('how')}`);
    
    // Handle ID-related questions - boost ID FAQs
    if (lowercaseQuestion.includes('id') || 
        lowercaseQuestion.includes('identification') || 
        lowercaseQuestion.includes('card')) {
      Logger.log("ID-related question detected - prioritizing ID answers");
      
      // Find and boost ID-related FAQs
      faqs.forEach(faq => {
        const faqText = (faq.question + " " + (faq.keywords || "")).toLowerCase();
        if (faqText.includes('id') || faqText.includes('identification') || faqText.includes('card')) {
          // Temporarily improve priority (lower number = higher priority)
          const currentPriority = parseInt(faq.priority) || 3;
          faq.priority = Math.max(1, currentPriority - 1);
          
          // Temporarily boost keywords for better matching
          if (faq.keywords) {
            faq.keywords += ",id,identification,card";
          } else {
            faq.keywords = "id,identification,card";
          }
        }
      });
    }
    
    // Handle lost ID questions specifically (common issue)
    if ((lowercaseQuestion.includes('lost') || lowercaseQuestion.includes('missing')) && 
        lowercaseQuestion.includes('id')) {
      Logger.log("Lost ID question detected - highly prioritizing lost ID answers");
      
      // Find and highly boost lost ID FAQs
      faqs.forEach(faq => {
        const faqText = (faq.question + " " + (faq.keywords || "")).toLowerCase();
        if ((faqText.includes('lost') || faqText.includes('replace')) && faqText.includes('id')) {
          // Give maximum priority to exact match for lost ID questions
          faq.priority = 1;
        }
      });
    }
    // --- END OF ADDED PREPROCESSING ---

    // Use enhanced matching
    // First try to use dedicated faq_matcher.js if available in the namespace
    let matchResult;
    try {
      if (typeof this.findBestMatches === 'function' && this.findBestMatches !== findBestMatches) {
        // This would use the more advanced matcher from faq_matcher.js if available
        Logger.log("Using advanced matcher from faq_matcher.js");
        matchResult = this.findBestMatches(userQuestion, faqs, 3, context);
      } else {
        // Fall back to the local implementation
        Logger.log("Using built-in matcher");
        matchResult = findBestMatches(userQuestion, faqs, 3);
      }
    } catch (error) {
      Logger.log("Error using advanced matcher: " + error.toString() + ", falling back to built-in");
      matchResult = findBestMatches(userQuestion, faqs, 3);
    }
    
    const { bestMatch, suggestions } = matchResult;
    Logger.log("Best match found:", bestMatch ? bestMatch.question : "none");
    Logger.log("Number of suggestions:", suggestions.length);

    // Response construction
    let responseType = "direct_answer";
    let answer = "";
    let clarificationOptions = null;
    let followUpQuestions = [];

    if (bestMatch) {
      // Check if this FAQ requires clarification
      if (bestMatch.requiresClarification) {
        responseType = "clarification";
        answer = bestMatch.answer;
        
        try {
          // Process clarification options
          if (typeof bestMatch.clarificationOptions === 'string') {
            if (bestMatch.clarificationOptions.startsWith('[') && 
                bestMatch.clarificationOptions.endsWith(']')) {
              clarificationOptions = JSON.parse(bestMatch.clarificationOptions);
            } else if (bestMatch.clarificationOptions.trim() !== '') {
              clarificationOptions = bestMatch.clarificationOptions.split('|').map(o => ({
                text: o.trim(),
                response: ""
              }));
            }
          } else {
            clarificationOptions = bestMatch.clarificationOptions;
          }
        } catch (e) {
          Logger.log("Error parsing clarification options: " + e.toString());
          clarificationOptions = [];
        }
      } else {
        responseType = "direct_answer";
        answer = bestMatch.answer;

        // Process follow-up questions
        try {
          if (bestMatch.followUpQuestions) {
            // Parse follow-up questions from various formats
            if (typeof bestMatch.followUpQuestions === 'string') {
              if (bestMatch.followUpQuestions.startsWith('[') && 
                  bestMatch.followUpQuestions.endsWith(']')) {
                followUpQuestions = JSON.parse(bestMatch.followUpQuestions);
              } else if (bestMatch.followUpQuestions.trim() !== '') {
                followUpQuestions = bestMatch.followUpQuestions.split('|')
                  .map(q => q.trim())
                  .filter(q => q.length > 0);
              }
            } else if (Array.isArray(bestMatch.followUpQuestions)) {
              followUpQuestions = bestMatch.followUpQuestions;
            }
          }
        } catch (e) {
          Logger.log("Error parsing follow-up questions: " + e.toString());
          followUpQuestions = [];
        }

        // Add category-based follow-ups (from FAQs with same category)
        if (bestMatch.category) {
          const related = faqs
            .filter(f => f.category === bestMatch.category && 
                      f.question !== bestMatch.question)
            .sort((a, b) => {
              const priorityA = parseInt(a.priority) || 3;
              const priorityB = parseInt(b.priority) || 3;
              return priorityA - priorityB;  // Lower priority number = higher priority
            })
            .slice(0, 2);
            
          const relatedQuestions = related.map(f => f.question);
          
          // Combine with existing follow-ups, avoiding duplicates
          followUpQuestions = [...new Set([...followUpQuestions, ...relatedQuestions])].slice(0, 3);
        }
      }
    } else {
      responseType = "follow_up";
      answer = "I'm sorry, I couldn't find a specific answer to your question. Please try rephrasing or <b><a href='mailto:helpdesk@dhvsu.edu.ph?subject=AskBot%20Support%20Request'>contact support</a></b>.";
      followUpQuestions = suggestions.map(s => s.question);
    }

    // Determine category using improved logic
    let category = bestMatch && bestMatch.category ? bestMatch.category : '';
    
    // If no category assigned from FAQ, try to infer from question content
    if (!category) {
        const lowerQuestion = userQuestion.toLowerCase();
        
        if (lowerQuestion.includes("id") || lowerQuestion.includes("card") || 
            lowerQuestion.includes("registration") || lowerQuestion.includes("certificate") || 
            lowerQuestion.includes("record") || lowerQuestion.includes("transcript")) {
            category = "registrar";
        } 
        else if (lowerQuestion.includes("enroll") || lowerQuestion.includes("admission") || 
                lowerQuestion.includes("apply") || lowerQuestion.includes("application")) {
            category = "admissions";
        }
        else if (lowerQuestion.includes("class") || lowerQuestion.includes("course") || 
                lowerQuestion.includes("program") || lowerQuestion.includes("subject")) {
            category = "academics";
        }
        else if (lowerQuestion.includes("president") || lowerQuestion.includes("dean") || 
                lowerQuestion.includes("director") || lowerQuestion.includes("admin")) {
            category = "administration";
        }
        else if (lowerQuestion.includes("scholarship") || lowerQuestion.includes("library") || 
                lowerQuestion.includes("dormitory") || lowerQuestion.includes("student service")) {
            category = "student-services";
        }
        else {
            category = "general"; // Default category
        }
    }
    
    Logger.log("Determined category for question: " + category);

    // Generate unique timestamp with milliseconds
    const now = new Date();
    const timestamp = now.toISOString();
    
    const conversationId = Utilities.getUuid();

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
    } else {
      // If category column doesn't exist, add it
      try {
        conversationSheet.insertColumnAfter(convHeaders.length);
        conversationSheet.getRange(1, convHeaders.length + 1).setValue('category');
        
        // Update row to include category in the new column
        row.push(category);
      } catch (e) {
        Logger.log("Error adding category column: " + e.toString());
      }
    }

    // Append conversation
    conversationSheet.appendRow(row);

    // Log activity
    logActivity(username, "chat_message", "Question: " + userQuestion);

    // Return response with enhanced context info
    return createJsonResponse({
      success: true,
      type: responseType,
      answer: answer,
      clarificationOptions: clarificationOptions,
      followUpQuestions: followUpQuestions || [],
      suggestions: suggestions && Array.isArray(suggestions) ? suggestions.map(s => s.question) : [],
      context: {
        lastQuestion: userQuestion,
        lastCategory: category,
        timestamp: timestamp,
        user: username,
        // Add clarification context if needed
        awaitingClarification: responseType === "clarification" ? true : undefined,
        originalQuestion: responseType === "clarification" ? bestMatch.question : undefined
      }
    });
  } catch (error) {
    Logger.log("Error in handleChatMessage: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "An error occurred while processing your message",
      error: "SERVER_ERROR"
    });
  }
}

// Add this after ensureFAQHeaders function

/**
 * Ensure FAQ sheet has columns for clarification and follow-up features
 * This function creates the necessary columns if they don't exist
 */
function ensureClarificationColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("FAQs");
  if (!sheet) return;
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Required columns for clarification and follow-up features
  var requiredColumns = [
    { name: "requiresClarification", defaultValue: "FALSE" },
    { name: "clarificationOptions", defaultValue: "" },
    { name: "followUpQuestions", defaultValue: "" }
  ];
  
  var columnsAdded = 0;
  
  // Check each required column and add if missing
  requiredColumns.forEach(column => {
    if (headers.indexOf(column.name) === -1) {
      // Add new column at the end
      var newColIndex = headers.length + columnsAdded + 1;
      sheet.getRange(1, newColIndex).setValue(column.name);
      
      // Set default values for all rows
      if (sheet.getLastRow() > 1) {
        var range = sheet.getRange(2, newColIndex, sheet.getLastRow() - 1, 1);
        range.setValue(column.defaultValue);
      }
      
      columnsAdded++;
      Logger.log(`Added column: ${column.name}`);
    }
  });
  
  if (columnsAdded > 0) {
    SpreadsheetApp.getUi().alert(`Added ${columnsAdded} columns to support clarification and follow-up features.`);
  }
  
  return columnsAdded;
}

/**
 * Helper function to create a FAQ with clarification options
 * @param {string} question - The main FAQ question
 * @param {string} baseAnswer - The initial response before clarification
 * @param {Array} options - Array of clarification options with their answers
 * @param {string} keywords - Comma-separated keywords
 * @param {string} category - FAQ category
 * @param {number} priority - Priority level (1-5)
 */
function createClarificationFAQ(question, baseAnswer, options, keywords, category, priority) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("FAQs");
  if (!sheet) return false;
  
  // Ensure the sheet has the necessary columns
  ensureClarificationColumns();
  
  // Get the headers to find column positions
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var columns = {
    id: headers.indexOf("id"),
    question: headers.indexOf("question"),
    answer: headers.indexOf("answer"),
    keywords: headers.indexOf("keywords"),
    status: headers.indexOf("status"),
    category: headers.indexOf("category"),
    priority: headers.indexOf("priority"),
    requiresClarification: headers.indexOf("requiresClarification"),
    clarificationOptions: headers.indexOf("clarificationOptions"),
    followUpQuestions: headers.indexOf("followUpQuestions")
  };
  
  // Create row data
  var rowData = Array(sheet.getLastColumn()).fill("");
  
  // Set basic FAQ fields
  rowData[columns.id] = Utilities.getUuid();
  rowData[columns.question] = question;
  rowData[columns.answer] = baseAnswer;
  rowData[columns.keywords] = keywords || "";
  rowData[columns.status] = "approved";
  rowData[columns.category] = category || "general";
  rowData[columns.priority] = priority || 3;
  
  // Set clarification fields
  rowData[columns.requiresClarification] = "TRUE";
  
  // Format clarification options as JSON
  if (options && Array.isArray(options)) {
    rowData[columns.clarificationOptions] = JSON.stringify(options);
  }
  
  // Append the row
  sheet.appendRow(rowData);
  
  return true;
}

// Example usage:
/*
function addClarificationFAQExample() {
  createClarificationFAQ(
    "How do I request a document?",
    "There are several document types available. Which document do you need?",
    [
      { text: "transcript", response: "To request a transcript, visit the Registrar's Office with valid ID." },
      { text: "certificate of enrollment", response: "For certificates of enrollment, go to the Registrar's Office." },
      { text: "good moral", response: "Good moral certificates are issued by the Guidance Office." }
    ],
    "document,request,transcript,certificate,good moral",
    "registrar",
    2
  );
}
*/

/**
 * Utility function to restore admin role for users
 * Call this function from the Apps Script editor when needed
 */
function restoreAdminRole() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) {
    Logger.log("Users sheet not found");
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var emailCol = headers.indexOf("email");
  var usernameCol = headers.indexOf("username");
  var roleCol = headers.indexOf("role");
  
  if (emailCol === -1 || roleCol === -1) {
    Logger.log("Required columns missing");
    return;
  }
  
  // Enter the email addresses of admin users you want to restore
  var adminEmails = [
    "admin@dhvsu.edu.ph"  // Add your admin email here
  ];
  
  // Also add a check for admin username
  var adminUsernames = [
    "admin"  // Add your admin username here
  ];
  
  var updatedCount = 0;
  
  for (var i = 1; i < data.length; i++) {
    var email = data[i][emailCol];
    var username = data[i][usernameCol];
    var currentRole = data[i][roleCol];
    
    if ((adminEmails.includes(email) || adminUsernames.includes(username)) && currentRole !== "admin") {
      sheet.getRange(i + 1, roleCol + 1).setValue("admin");
      Logger.log("Restored admin role for " + email + " (username: " + username + ")");
      updatedCount++;
    }
  }
  
  Logger.log(updatedCount + " admin roles restored");
  return updatedCount;
}

/**
 * This function is called after login to ensure admins stay admins
 */
function ensureAdminRole(email, username) {
  if (!email && !username) return false;
  
  // Check if this user should be an admin
  var adminEmails = ["admin@dhvsu.edu.ph"]; // Same list as in restoreAdminRole
  var adminUsernames = ["admin"];           // Same list as in restoreAdminRole
  
  if (adminEmails.includes(email) || adminUsernames.includes(username)) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Users");
    if (!sheet) return false;
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var emailCol = headers.indexOf("email");
    var usernameCol = headers.indexOf("username");
    var roleCol = headers.indexOf("role");
    
    if (emailCol === -1 || usernameCol === -1 || roleCol === -1) return false;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][emailCol] === email || data[i][usernameCol] === username) {
        if (data[i][roleCol] !== "admin") {
          sheet.getRange(i + 1, roleCol + 1).setValue("admin");
          Logger.log("Reset admin role for " + email + " (username: " + username + ")");
          return true;
        }
        return false; // already admin
      }
    }
  }
  return false;
}

// Add these missing functions after handleLogFeedback

/**
 * Get all feedback entries for admin panel
 */
function handleGetFeedback(sheet) {
  try {
    Logger.log("Getting feedback for admin panel");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const feedbacks = [];
    
    // Validate required columns
    const timestampCol = headers.indexOf("timestamp");
    const usernameCol = headers.indexOf("username");
    const messageCol = headers.indexOf("message");
    const feedbackTypeCol = headers.indexOf("feedbackType");
    const commentCol = headers.indexOf("comment");
    
    if (usernameCol === -1 || messageCol === -1 || feedbackTypeCol === -1) {
      Logger.log("Error: Required feedback columns missing");
      return createJsonResponse({
        success: false,
        message: "Feedback sheet structure error"
      });
    }
    
    // Process each feedback row
    for (let i = 1; i < data.length; i++) {
      feedbacks.push({
        timestamp: timestampCol !== -1 ? data[i][timestampCol] : "",
        username: data[i][usernameCol] || "",
        message: data[i][messageCol] || "",
        feedbackType: data[i][feedbackTypeCol] || "",
        comment: commentCol !== -1 ? data[i][commentCol] : ""
      });
    }
    
    Logger.log("Retrieved " + feedbacks.length + " feedback entries");
    return createJsonResponse({
      success: true,
      feedbacks: feedbacks
    });
  } catch (error) {
    Logger.log("Error in handleGetFeedback: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Error retrieving feedback: " + error.toString()
    });
  }
}

/**
 * Get activity logs for admin panel
 */
function handleGetLogs(sheet) {
  try {
    Logger.log("Getting activity logs for admin panel");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const logs = [];
    
    // Validate required columns
    const timestampCol = headers.indexOf("timestamp");
    const usernameCol = headers.indexOf("username");
    const actionCol = headers.indexOf("action");
    const detailsCol = headers.indexOf("details");
    const ipAddressCol = headers.indexOf("ipAddress");
    
    if (timestampCol === -1 || usernameCol === -1 || actionCol === -1) {
      Logger.log("Error: Required log columns missing");
      return createJsonResponse({
        success: false,
        message: "Log sheet structure error"
      });
    }
    
    // Process each log row
    for (let i = 1; i < data.length; i++) {
      logs.push({
        timestamp: data[i][timestampCol] || "",
        username: data[i][usernameCol] || "",
        action: data[i][actionCol] || "",
        details: detailsCol !== -1 ? data[i][detailsCol] : "",
        ipAddress: ipAddressCol !== -1 ? data[i][ipAddressCol] : ""
      });
    }
    
    Logger.log("Retrieved " + logs.length + " log entries");
    return createJsonResponse({
      success: true,
      logs: logs
    });
  } catch (error) {
    Logger.log("Error in handleGetLogs: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Error retrieving logs: " + error.toString()
    });
  }
}

/**
 * Get analytics data for admin panel charts
 */
function handleGetAnalytics(faqSheet, feedbackSheet) {
  try {
    Logger.log("Generating analytics data for admin panel");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const conversationSheet = ss.getSheetByName("Conversations");
    const activityLogSheet = ss.getSheetByName("ActivityLog");
    
    if (!conversationSheet || !activityLogSheet) {
      Logger.log("Error: Required sheets missing");
      return createJsonResponse({
        success: false,
        message: "Analytics sheets not found"
      });
    }
    
    const analytics = {
      userActivity: {
        labels: [],
        data: []
      },
      faqPerformance: {
        labels: [],
        data: []
      },
      ratings: [0, 0, 0, 0, 0]  // Default values [Helpful, Not Helpful, 3 Stars, 2 Stars, 1 Star]
    };
    
    // Generate user activity data (last 7 days) from actual activity logs
    try {
      const activityData = activityLogSheet.getDataRange().getValues();
      const activityHeaders = activityData[0];
      const timestampCol = activityHeaders.indexOf("timestamp");
      
      if (timestampCol === -1) {
        Logger.log("Error: Activity log timestamp column missing");
        throw new Error("Activity log timestamp column missing");
      }
      
      // Create date range for last 7 days
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        last7Days.push({
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          date: new Date(date.setHours(0, 0, 0, 0)), // Start of day
          endDate: new Date(date.setHours(23, 59, 59, 999)), // End of day
          count: 0
        });
      }
      
      // Count activities by date
      for (let i = 1; i < activityData.length; i++) {
        const timestamp = activityData[i][timestampCol];
        if (!timestamp) continue;
        
        let activityDate;
        if (timestamp instanceof Date) {
          activityDate = timestamp;
        } else {
          try {
            activityDate = new Date(timestamp);
            if (isNaN(activityDate.getTime())) continue; // Invalid date
          } catch (e) {
            continue; // Skip invalid timestamps
          }
        }
        
        // Check if activity falls within the last 7 days
        for (const day of last7Days) {
          if (activityDate >= day.date && activityDate <= day.endDate) {
            day.count++;
            break;
          }
        }
      }
      
      // Populate analytics object with real data
      analytics.userActivity.labels = last7Days.map(day => day.label);
      analytics.userActivity.data = last7Days.map(day => day.count);
      
      Logger.log("User activity data generated successfully");
    } catch (error) {
      Logger.log("Error processing user activity data: " + error.toString());
      // Fall back to empty data rather than random numbers
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        analytics.userActivity.labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        analytics.userActivity.data.push(0);
      }
    }
    
    // Get actual FAQ performance data from conversations
    try {
      const conversationData = conversationSheet.getDataRange().getValues();
      const conversationHeaders = conversationData[0];
      const questionCol = conversationHeaders.indexOf("question");
      const timestampCol = conversationHeaders.indexOf("timestamp");
      
      if (questionCol === -1) {
        Logger.log("Error: Conversation question column missing");
        throw new Error("Conversation question column missing");
      }
      
      // Count questions in conversations (actual usage frequency)
      const faqCounts = {};
      
      // Get list of FAQs to match against
      const faqData = faqSheet.getDataRange().getValues();
      const faqHeaders = faqData[0];
      const faqQuestionCol = faqHeaders.indexOf("question");
      const faqIdCol = faqHeaders.indexOf("id");
      
      if (faqQuestionCol === -1) {
        Logger.log("Error: FAQ question column missing");
        throw new Error("FAQ question column missing");
      }
      
      // Create a map of FAQ questions for faster lookup
      const faqMap = {};
      for (let i = 1; i < faqData.length; i++) {
        const question = faqData[i][faqQuestionCol];
        if (question) {
          const faqId = faqIdCol !== -1 ? faqData[i][faqIdCol] : `faq_${i}`;
          faqMap[question.toLowerCase()] = {
            id: faqId,
            question: question,
            count: 0
          };
        }
      }
      
      // Count occurrences of each FAQ in conversations
      // We'll use a fuzzy matching approach to count related questions
      for (let i = 1; i < conversationData.length; i++) {
        const question = conversationData[i][questionCol];
        if (!question) continue;
        
        // Only count recent conversations (last 30 days)
        if (timestampCol !== -1) {
          const timestamp = conversationData[i][timestampCol];
          if (timestamp) {
            let convDate;
            if (timestamp instanceof Date) {
              convDate = timestamp;
            } else {
              try {
                convDate = new Date(timestamp);
                if (isNaN(convDate.getTime())) continue; // Invalid date
              } catch (e) {
                continue; // Skip invalid timestamps
              }
            }
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            if (convDate < thirtyDaysAgo) continue; // Skip older conversations
          }
        }
        
        // Check for exact or partial matches with FAQs
        const normalizedQuestion = question.toLowerCase();
        let matched = false;
        
        // First try exact match
        if (faqMap[normalizedQuestion]) {
          faqMap[normalizedQuestion].count++;
          matched = true;
          continue;
        }
        
        // Then try fuzzy matching
        for (const faqQuestion in faqMap) {
          // Check if the conversation question contains the FAQ question or vice versa
          if (normalizedQuestion.includes(faqQuestion) || faqQuestion.includes(normalizedQuestion)) {
            faqMap[faqQuestion].count++;
            matched = true;
            break;
          }
          
          // Check for word overlap (more than 50% of words match)
          const questionWords = normalizedQuestion.split(/\s+/);
          const faqWords = faqQuestion.split(/\s+/);
          let matchCount = 0;
          for (const word of questionWords) {
            if (word.length > 3 && faqWords.includes(word)) { // Only count meaningful words
              matchCount++;
            }
          }
          const matchPercentage = questionWords.length > 0 ? matchCount / questionWords.length : 0;
          if (matchPercentage >= 0.5) {
            faqMap[faqQuestion].count++;
            matched = true;
            break;
          }
        }
        
        // If no match found, add to generic count
        if (!matched) {
          if (!faqCounts["Other Questions"]) {
            faqCounts["Other Questions"] = { count: 0 };
          }
          faqCounts["Other Questions"].count++;
        }
      }
      
      // Convert the FAQ map to array and sort by count
      const faqCountsArray = Object.values(faqMap)
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Get top 5 FAQs
      
      // Populate FAQ performance chart data
      if (faqCountsArray.length > 0) {
        analytics.faqPerformance.labels = faqCountsArray.map(item => 
          item.question.length > 20 ? item.question.substring(0, 20) + '...' : item.question
        );
        analytics.faqPerformance.data = faqCountsArray.map(item => item.count);
      }
      
      Logger.log("FAQ performance data generated successfully: " + JSON.stringify(analytics.faqPerformance));
    } catch (error) {
      Logger.log("Error processing FAQ performance data: " + error.toString());
      // Fall back to empty array rather than random numbers
      analytics.faqPerformance.labels = [];
      analytics.faqPerformance.data = [];
    }
    
    // Get actual feedback ratings
    try {
      const feedbackData = feedbackSheet.getDataRange().getValues();
      const feedbackHeaders = feedbackData[0];
      const feedbackTypeCol = feedbackHeaders.indexOf("feedbackType");
      
      // Count by feedback type
      if (feedbackTypeCol !== -1) {
        let positiveCount = 0;
        let negativeCount = 0;
        
        for (let i = 1; i < feedbackData.length; i++) {
          const feedbackType = feedbackData[i][feedbackTypeCol];
          if (feedbackType === 'positive' || feedbackType === 'helpful') {
            positiveCount++;
          } else if (feedbackType === 'negative' || feedbackType === 'not_helpful') {
            negativeCount++;
          }
        }
        
        analytics.ratings[0] = positiveCount;
        analytics.ratings[1] = negativeCount;
        
        Logger.log("Feedback ratings data generated successfully: " + JSON.stringify(analytics.ratings));
      }
    } catch (error) {
      Logger.log("Error processing feedback ratings data: " + error.toString());
    }
    
    return createJsonResponse({
      success: true,
      analytics: analytics
    });
  } catch (error) {
    Logger.log("Error in handleGetAnalytics: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Error generating analytics: " + error.toString()
    });
  }
}

// Add this new function to check if an email exists in the database
function handleCheckEmailExists(params, sheet) {
  try {
    // Validate parameters
    if (!params || !params.email) {
      Logger.log("Email existence check failed: Missing email parameter");
      return createJsonResponse({
        success: false,
        message: "Email parameter is required",
        exists: false
      });
    }

    const email = params.email.toLowerCase().trim();
    
    // Validate email format
    if (!isValidDHVSUEmail(email)) {
      Logger.log("Email existence check failed: Invalid email format");
      return createJsonResponse({
        success: false,
        message: "Invalid email format",
        exists: false
      });
    }
    
    Logger.log("Checking if email exists: " + email);
    
    // Get data from sheet
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");
    
    if (emailCol === -1) {
      Logger.log("Email existence check failed: Email column not found");
      return createJsonResponse({
        success: false,
        message: "Database error: Email column not found",
        exists: false
      });
    }
    
    // Search for the email
    for (let i = 1; i < data.length; i++) {
      const storedEmail = String(data[i][emailCol]).toLowerCase().trim();
      
      if (storedEmail === email) {
        Logger.log("Email found: " + email);
        return createJsonResponse({
          success: true,
          message: "Email exists in the database",
          exists: true
        });
      }
    }
    
    // Email not found
    Logger.log("Email not found: " + email);
    return createJsonResponse({
      success: true,
      message: "Email does not exist in the database",
      exists: false
    });
  } catch (error) {
    Logger.log("Error in handleCheckEmailExists: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Error checking email existence: " + error.message,
      exists: false
    });
  }
}

function handleForgotPassword(params, userSheet) {
  try {
    if (!params || !params.email) {
      return createJsonResponse({
        success: false,
        message: "Email is required"
      });
    }

    const email = params.email.toLowerCase().trim();
    const resetUrl = params.resetUrl || '';
    const callback = params.callback || '';

    // Log all parameters for debugging
    Logger.log("Forgot password request params: " + JSON.stringify({
      email: email,
      resetUrl: resetUrl,
      callback: callback
    }));

    // Validate email format
    if (!isValidDHVSUEmail(email)) {
      const response = {
        success: false,
        message: "Only DHVSU email addresses (@dhvsu.edu.ph) are allowed"
      };

      // Add callback if provided for iframe response
      if (callback) {
        response._callback = callback;
        response.action = "forgot_password_response";
      }
      
      return createJsonResponse(response);
    }

    // Find the user by email
    const data = userSheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");

    if (emailCol === -1) {
      const response = {
        success: false,
        message: "System error: Email column not found"
      };
      
      if (callback) {
        response._callback = callback;
        response.action = "forgot_password_response";
      }
      
      return createJsonResponse(response);
    }

    let found = false;
    let userRow = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailCol].toLowerCase().trim() === email) {
        found = true;
        userRow = i + 1; // 1-indexed row
        break;
      }
    }

    if (!found) {
      const response = {
        success: false,
        message: "Email not found in our records"
      };
      
      if (callback) {
        response._callback = callback;
        response.action = "forgot_password_response";
      }
      
      return createJsonResponse(response);
    }

    // Generate reset token
    const resetToken = Utilities.getUuid();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 1); // Token valid for 1 hour

    // Update user record with token
    const tokenCol = headers.indexOf("reset_token");
    const expiryCol = headers.indexOf("token_expiry");

    if (tokenCol === -1 || expiryCol === -1) {
      // Need to add the columns
      if (tokenCol === -1) {
        userSheet.insertColumnAfter(userSheet.getLastColumn());
        userSheet.getRange(1, userSheet.getLastColumn() + 1).setValue("reset_token");
      }
      if (expiryCol === -1) {
        userSheet.insertColumnAfter(userSheet.getLastColumn());
        userSheet.getRange(1, userSheet.getLastColumn() + 1).setValue("token_expiry");
      }
      
      // Refresh the data
      const refreshedData = userSheet.getDataRange().getValues();
      const refreshedHeaders = refreshedData[0];
      const refreshedTokenCol = refreshedHeaders.indexOf("reset_token");
      const refreshedExpiryCol = refreshedHeaders.indexOf("token_expiry");
      
      // Update the token
      userSheet.getRange(userRow, refreshedTokenCol + 1).setValue(resetToken);
      userSheet.getRange(userRow, refreshedExpiryCol + 1).setValue(tokenExpiry.toISOString());
    } else {
      // Update existing columns
      userSheet.getRange(userRow, tokenCol + 1).setValue(resetToken);
      userSheet.getRange(userRow, expiryCol + 1).setValue(tokenExpiry.toISOString());
    }

    // Construct reset URL - ensure it has correct protocol
    let formattedResetUrl = resetUrl;
    if (formattedResetUrl && !formattedResetUrl.startsWith('http')) {
      formattedResetUrl = 'https://' + formattedResetUrl.replace(/^\/+/, '');
    }
    if (!formattedResetUrl.endsWith('/')) {
      formattedResetUrl += '/';
    }
    
    const resetLink = `${formattedResetUrl}reset_password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;
    Logger.log("Generated reset link: " + resetLink);
    
    // Try to send email
    let emailSent = false;
    let emailError = null;
    try {
      // Get the active user's email to see who's sending this
      const activeUserEmail = Session.getActiveUser().getEmail();
      Logger.log("Sending email as: " + (activeUserEmail || "unknown user"));
      
      const subject = "Pampanga State University Password Reset";
      const body = `
        <p>Dear User,</p>
        <p>We received a request to reset your password for your Pampanga State University Askbot account.</p>
        <p>Please click the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Best regards,</p>
        <p>Pampanga State University Askbot Team</p>
      `;
      
      try {
        // Try the standard MailApp first
        MailApp.sendEmail({
          to: email,
          subject: subject,
          htmlBody: body
        });
        emailSent = true;
        Logger.log("Password reset email sent via MailApp to: " + email);
      } catch (mailAppError) {
        Logger.log("MailApp failed: " + mailAppError.toString());
        emailError = mailAppError.toString();
        
        // Try GmailApp as fallback if MailApp fails
        try {
          GmailApp.sendEmail(email, subject, "Please view this email in HTML format", {
            htmlBody: body
          });
          emailSent = true;
          Logger.log("Password reset email sent via GmailApp to: " + email);
        } catch (gmailError) {
          Logger.log("GmailApp also failed: " + gmailError.toString());
          emailError = emailError + "; GmailApp error: " + gmailError.toString();
        }
      }
    } catch (outerEmailError) {
      Logger.log("Error sending password reset email: " + outerEmailError.toString());
      emailError = outerEmailError.toString();
    }

    // Log the activity
    logActivity(email, "forgot_password", "Password reset requested");
    
    const response = {
      success: true,
      message: emailSent 
        ? "Password reset link has been sent to your email" 
        : "Password reset link generated but email delivery failed. Use the link below to reset your password.",
      resetLink: resetLink,
      token: resetToken,
      emailSent: emailSent,
      debug: {
        emailError: emailError,
        script: ScriptApp.getScriptId(),
        user: Session.getEffectiveUser().getEmail()
      }
    };
    
    // Add callback if provided for iframe response
    if (callback) {
      response._callback = callback;
      response.action = "forgot_password_response";
    }
    
    return createJsonResponse(response);
    
  } catch (error) {
    Logger.log("Error in handleForgotPassword: " + error.toString());
    Logger.log("Stack trace: " + error.stack);
    
    const response = {
      success: false,
      message: "Server error: " + error.message,
      debug: {
        error: error.toString(),
        stack: error.stack
      }
    };
    
    // Add callback if provided
    if (params && params.callback) {
      response._callback = params.callback;
      response.action = "forgot_password_response";
    }
    
    return createJsonResponse(response);
  }
}

function validateResetToken(params, sheet) {
  try {
    if (!params || !params.email || !params.token) {
      const response = {
        success: false,
        message: "Email and token are required"
      };
      
      // Add callback if provided
      if (params && params.callback) {
        response._callback = params.callback;
        response.action = "validate_token_response";
      }
      
      return createJsonResponse(response);
    }

    const email = params.email.toLowerCase().trim();
    const token = params.token.trim();
    const callback = params.callback || '';

    // Find the user by email
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");
    const tokenCol = headers.indexOf("reset_token");
    const expiryCol = headers.indexOf("token_expiry");

    if (emailCol === -1 || tokenCol === -1 || expiryCol === -1) {
      const response = {
        success: false,
        message: "System error: Required columns not found"
      };
      
      if (callback) {
        response._callback = callback;
        response.action = "validate_token_response";
      }
      
      return createJsonResponse(response);
    }

    // Search for the user and validate token
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailCol].toLowerCase().trim() === email) {
        const storedToken = data[i][tokenCol];
        const expiryStr = data[i][expiryCol];
        
        if (!storedToken || storedToken !== token) {
          const response = {
            success: false,
            message: "Invalid reset token"
          };
          
          if (callback) {
            response._callback = callback;
            response.action = "validate_token_response";
          }
          
          return createJsonResponse(response);
        }
        
        // Check if token has expired
        if (!expiryStr) {
          const response = {
            success: false,
            message: "Token expiry not set"
          };
          
          if (callback) {
            response._callback = callback;
            response.action = "validate_token_response";
          }
          
          return createJsonResponse(response);
        }
        
        try {
          const expiry = new Date(expiryStr);
          const now = new Date();
          
          if (now > expiry) {
            const response = {
              success: false,
              message: "Reset token has expired. Please request a new password reset."
            };
            
            if (callback) {
              response._callback = callback;
              response.action = "validate_token_response";
            }
            
            return createJsonResponse(response);
          }
        } catch (dateError) {
          Logger.log("Error parsing date: " + dateError.toString());
          const response = {
            success: false,
            message: "Error validating token expiry"
          };
          
          if (callback) {
            response._callback = callback;
            response.action = "validate_token_response";
          }
          
          return createJsonResponse(response);
        }
        
        // Token is valid
        const response = {
          success: true,
          message: "Token is valid"
        };
        
        if (callback) {
          response._callback = callback;
          response.action = "validate_token_response";
        }
        
        return createJsonResponse(response);
      }
    }

    // User not found
    const response = {
      success: false,
      message: "User not found"
    };
    
    if (callback) {
      response._callback = callback;
      response.action = "validate_token_response";
    }
    
    return createJsonResponse(response);
    
  } catch (error) {
    Logger.log("Error in validateResetToken: " + error.toString());
    
    const response = {
      success: false,
      message: "Server error: " + error.message
    };
    
    // Add callback if provided
    if (params && params.callback) {
      response._callback = params.callback;
      response.action = "validate_token_response";
    }
    
    return createJsonResponse(response);
  }
}

function handleResetPassword(params, sheet) {
  try {
    if (!params || !params.email || !params.token || !params.password) {
      const response = {
        success: false,
        message: "Email, token, and password are required"
      };
      
      // Add callback if provided
      if (params && params.callback) {
        response._callback = params.callback;
        response.action = "reset_password_response";
      }
      
      return createJsonResponse(response);
    }

    const email = params.email.toLowerCase().trim();
    const token = params.token.trim();
    const password = params.password.trim();
    const callback = params.callback || '';

    // Find the user by email
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("email");
    const passwordCol = headers.indexOf("password");
    const tokenCol = headers.indexOf("reset_token");
    const expiryCol = headers.indexOf("token_expiry");

    if (emailCol === -1 || passwordCol === -1 || tokenCol === -1 || expiryCol === -1) {
      const response = {
        success: false,
        message: "System error: Required columns not found"
      };
      
      if (callback) {
        response._callback = callback;
        response.action = "reset_password_response";
      }
      
      return createJsonResponse(response);
    }

    // Search for the user and validate token
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailCol].toLowerCase().trim() === email) {
        const storedToken = data[i][tokenCol];
        const expiryStr = data[i][expiryCol];
        
        if (!storedToken || storedToken !== token) {
          const response = {
            success: false,
            message: "Invalid reset token"
          };
          
          if (callback) {
            response._callback = callback;
            response.action = "reset_password_response";
          }
          
          return createJsonResponse(response);
        }
        
        // Check if token has expired
        if (!expiryStr) {
          const response = {
            success: false,
            message: "Token expiry not set"
          };
          
          if (callback) {
            response._callback = callback;
            response.action = "reset_password_response";
          }
          
          return createJsonResponse(response);
        }
        
        try {
          const expiry = new Date(expiryStr);
          const now = new Date();
          
          if (now > expiry) {
            const response = {
              success: false,
              message: "Reset token has expired. Please request a new password reset."
            };
            
            if (callback) {
              response._callback = callback;
              response.action = "reset_password_response";
            }
            
            return createJsonResponse(response);
          }
        } catch (dateError) {
          Logger.log("Error parsing date: " + dateError.toString());
          const response = {
            success: false,
            message: "Error validating token expiry"
          };
          
          if (callback) {
            response._callback = callback;
            response.action = "reset_password_response";
          }
          
          return createJsonResponse(response);
        }
        
        // Update the password
        sheet.getRange(i + 1, passwordCol + 1).setValue(password);
        
        // Clear the token and expiry
        sheet.getRange(i + 1, tokenCol + 1).setValue("");
        sheet.getRange(i + 1, expiryCol + 1).setValue("");
        
        // Log the activity
        logActivity(email, "reset_password", "Password reset successful");
        
        const response = {
          success: true,
          message: "Password has been reset successfully"
        };
        
        if (callback) {
          response._callback = callback;
          response.action = "reset_password_response";
        }
        
        return createJsonResponse(response);
      }
    }

    // User not found
    const response = {
      success: false,
      message: "User not found"
    };
    
    if (callback) {
      response._callback = callback;
      response.action = "reset_password_response";
    }
    
    return createJsonResponse(response);
    
  } catch (error) {
    Logger.log("Error in handleResetPassword: " + error.toString());
    
    const response = {
      success: false,
      message: "Server error: " + error.message
    };
    
    // Add callback if provided
    if (params && params.callback) {
      response._callback = params.callback;
      response.action = "reset_password_response";
    }
    
    return createJsonResponse(response);
  }
}
