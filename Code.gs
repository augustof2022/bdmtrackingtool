/**
 * This script provides the backend logic for the workflow management web app.
 */

// --- GLOBAL VARIABLES ---
const SPREADSHEET_ID = '1koGPL1twCHEUwKM7cjdeldLUOHcqAVu7ubICF8J8sRM';
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
let usersSheet = ss.getSheetByName('Users');
let transactionsSheet = ss.getSheetByName('Transactions');
let transactionHistorySheet = ss.getSheetByName('TransactionHistory'); // MODIFIED
let activityLogSheet = ss.getSheetByName('ActivityLog'); // MODIFIED
let dropdownsSheet = ss.getSheetByName('Dropdowns');
let granteeDataSheet = ss.getSheetByName('GranteeData');
let directivesSheet = ss.getSheetByName('Directives'); // NEW

/**
 * A robust setup function to create, verify, and repair all required sheets and headers.
 * Run this function manually from the Apps Script Editor to prepare or fix your spreadsheet.
 * How to run:
 * 1. Open the Apps Script editor.
 * 2. Select "setupSpreadsheet" from the function dropdown list above.
 * 3. Click "Run".
 * 4. A summary of actions will appear.
 */
function setupSpreadsheet() {
  const sheetConfigs = {
    'Transactions': ['TRANSACTION_ID', 'BATCH_NO', 'DATE_SUBMITTED', 'SUBMITTED_BY', 'HH_ID_NO', 'GRANTEE_NAME', 'ENTRY_ID_NO', 'MEMBER_NAME', 'CASE_MANAGER', 'UPDATE_TYPE', 'REQUIREMENTS_STATUS', 'NEW_VALUE', 'ATTACHMENTS', 'VALIDATION', 'RECOMMENDATION', 'CURRENT_STATUS', 'STATUS_CHANGED_BY', 'DATE_STATUS_CHANGED', 'REMARKS'],
    'Users': ['EmailAddress', 'Password', 'FullName', 'Role', 'AreaName', 'ApprovalStatus', 'UserCode'],
    'ActivityLog': ['LOG_ID', 'TIMESTAMP', 'USER_EMAIL', 'ACTION_TYPE', 'DETAILS'],
    'TransactionHistory': ['HISTORY_ID', 'TRANSACTION_ID', 'TIMESTAMP', 'USER_EMAIL', 'PREVIOUS_STATUS', 'NEW_STATUS', 'REMARKS'],
    'Dropdowns': ['CaseManagers', 'UpdateTypes', 'FieldToUpdateTemplate', 'OldValueTemplate', 'NewValueTemplate', 'StatusOptions', 'Roles', 'ViewTypes', 'DirectiveType', 'DirectiveStatus'], // ADDED Directive Columns
    'GranteeData': ['HH_ID', 'GranteeFullName', 'EntryID', 'MemberFullName'],
    'Directives': ['DIRECTIVE_ID', 'HOUSEHOLD_ID', 'GRANTEE_NAME', 'ENTRY_ID', 'MEMBER_NAME', 'DIRECTIVE_TYPE', 'DATE_ENDORSED', 'DETAILS', 'CURRENT_STATUS', 'CASE_MANAGER', 'REMARKS', 'DATE_UPDATED', 'UPDATED_BY'] // NEW Directives Sheet with CASE_MANAGER
  };

  const sheetNames = Object.keys(sheetConfigs);
  let summaryLog = ['Spreadsheet Setup Summary:'];

  // Ensure TransactionHistory and ActivityLog exist before attempting to delete the old Log sheet
  if (!ss.getSheetByName('TransactionHistory')) {
      ss.insertSheet('TransactionHistory');
  }
  if (!ss.getSheetByName('ActivityLog')) {
      ss.insertSheet('ActivityLog');
  }

  // Clean up the old "Log" sheet if it exists
  const oldLogSheet = ss.getSheetByName('Log');
  if (oldLogSheet) {
    ss.deleteSheet(oldLogSheet);
    summaryLog.push(`- REMOVED old 'Log' sheet.`);
  }

  sheetNames.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    const headers = sheetConfigs[sheetName];

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      summaryLog.push(`- CREATED new sheet: '${sheetName}'.`);
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      summaryLog.push(`- ADDED headers to new sheet: '${sheetName}'.`);
    } else {
      // MODIFIED LOGIC: Handle sheets that exist but might be empty.
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        // This case handles a sheet that exists but is completely blank.
        sheet.appendRow(headers);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
        summaryLog.push(`- POPULATED empty sheet: '${sheetName}' with headers.`);
      } else {
        // This case handles a sheet that has content, so we check the headers.
        const currentHeaders = sheet.getRange(1, 1, 1, sheet.getRange("A1:1").getLastColumn()).getValues()[0];
        const headersMatch = headers.length === currentHeaders.length && headers.every((value, index) => value === currentHeaders[index]);

        if (headersMatch) {
          summaryLog.push(`- OK: Sheet '${sheetName}' headers are correct.`);
        } else {
          // Clear existing headers and set new ones to prevent issues with different column counts
          sheet.getRange(1, 1, 1, sheet.getLastColumn()).clearContent();
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.setFrozenRows(1);
          sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
          summaryLog.push(`- REPAIRED: Headers for sheet '${sheetName}' were incorrect and have been fixed.`);
        }
      }
    }
  });

  // Re-initialize all sheet variables to ensure they are correct
  usersSheet = ss.getSheetByName('Users');
  transactionsSheet = ss.getSheetByName('Transactions');
  transactionHistorySheet = ss.getSheetByName('TransactionHistory');
  activityLogSheet = ss.getSheetByName('ActivityLog');
  dropdownsSheet = ss.getSheetByName('Dropdowns');
  granteeDataSheet = ss.getSheetByName('GranteeData');
  directivesSheet = ss.getSheetByName('Directives'); // NEW
  
  summaryLog.push('\nSetup process finished. Please run this again if you encounter header-related errors.');
  Logger.log(summaryLog.join('\n'));
  Browser.msgBox(summaryLog.join('\n'));
}

/**
 * Creates the first administrative user. Run this AFTER running setupSpreadsheet.
 */
function setupInitialUser() {
  const email = "your_email@example.com"; // <-- IMPORTANT: CHANGE THIS
  const password = "your_strong_password"; // <-- IMPORTANT: CHANGE THIS
  const fullName = "Admin User";
  const role = "BDM Team";
  const areaName = "HQ";
  
  const users = usersSheet.getDataRange().getValues();
  const userExists = users.some(row => row[0].toLowerCase() === email.toLowerCase());
  
  if (userExists) {
    Logger.log('User with this email already exists.');
    return;
  }
  
  usersSheet.appendRow([email, password, fullName, role, areaName, 'Approved']);
  Logger.log('Initial user created successfully. Email: ' + email);
}


// --- WEB APP ENTRY POINT ---

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Workflow Management App')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// --- USER AUTHENTICATION & DATA ---

/**
 * Creates a new user with 'Pending' status.
 * @param {object} userData Object with email, password, fullName, areaName.
 * @returns {object} A result object with success status and message.
 */
function createNewUser(userData) {
  try {
    const users = usersSheet.getDataRange().getValues();
    const emailExists = users.some(row => row[0].toLowerCase() === userData.email.toLowerCase());
    if (emailExists) {
      return { success: false, message: 'An account with this email already exists.' };
    }
    
    // Add new user with the selected role and 'Pending' status
    usersSheet.appendRow([
      userData.email,
      userData.password,
      userData.fullName,
      userData.role, // Use the role from the form
      userData.areaName,
      'Pending'     // Initial status
    ]);

    logActivity_('USER_REGISTRATION', `New user registered: ${userData.email} with role ${userData.role}. Awaiting approval.`);
    return { success: true, message: 'Registration successful! Your account is pending approval.' };
  } catch (e) {
    Logger.log(`Error in createNewUser: ${e}`);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}


/**
 * Verifies user credentials against the 'Users' sheet.
 * @param {string} email The user's email.
 * @param {string} password The user's password.
 * @returns {object|null} The user object if credentials are valid, otherwise null with a reason.
 */
function verifyUser(email, password) {
  try {
    const roleMapping = getRoleViewMapping_(); // Get the role-to-view mapping
    const usersData = usersSheet.getDataRange().getValues();
    const headers = usersData[0];
    const userCodeIndex = headers.indexOf('UserCode');
    const roleIndex = headers.indexOf('Role');

    for (let i = 1; i < usersData.length; i++) {
      const row = usersData[i];
      if (row[0].toLowerCase() === email.toLowerCase() && row[1] === password) {
        if (row[5] === 'Approved') {
          const userRole = row[roleIndex];
          // Determine the viewType based on the mapping, with a safe default
          const viewType = roleMapping[userRole] || 'BDM_view'; 

          logActivity_('USER_LOGIN', `User ${email} logged in successfully.`);
          return { 
            status: 'SUCCESS',
            user: {
              email: row[0],
              fullName: row[2],
              role: userRole,
              areaName: row[4],
              userCode: userCodeIndex !== -1 ? row[userCodeIndex] : null,
              viewType: viewType // Pass the determined view type to the client
            }
          };
        } else {
          return { status: 'PENDING_APPROVAL', user: null };
        }
      }
    }
    return { status: 'INVALID_CREDENTIALS', user: null };
  } catch (e) {
    Logger.log(`Error in verifyUser: ${e}`);
    return { status: 'ERROR', user: null };
  }
}

function getDropdownOptions() {
  const data = dropdownsSheet.getDataRange().getValues();
  const headers = data.shift(); // Get headers

  // Find column indices
  const caseManagerIndex = headers.indexOf('CaseManagers');
  const updateTypeIndex = headers.indexOf('UpdateTypes');
  const fieldTemplateIndex = headers.indexOf('FieldToUpdateTemplate');
  const oldTemplateIndex = headers.indexOf('OldValueTemplate');
  const newTemplateIndex = headers.indexOf('NewValueTemplate');
  const statusOptionsIndex = headers.indexOf('StatusOptions');
  const rolesIndex = headers.indexOf('Roles');
  const directiveTypeIndex = headers.indexOf('DirectiveType'); // NEW
  const directiveStatusIndex = headers.indexOf('DirectiveStatus'); // NEW


  const options = {
    updateTypeTemplates: [],
    statusOptions: [],
    caseManagers: [],
    roleOptions: [],
    directiveTypes: [], // NEW
    directiveStatuses: [] // NEW
  };

  data.forEach(row => {
    // Populate Update Type templates
    const updateType = row[updateTypeIndex];
    if (updateType && String(updateType).trim() !== '') {
      options.updateTypeTemplates.push({
        updateType: updateType,
        fieldTemplate: row[fieldTemplateIndex] || '',
        oldValueTemplate: row[oldTemplateIndex] || '',
        newValueTemplate: row[newTemplateIndex] || ''
      });
    }

    // Populate Status Options
    const statusOption = row[statusOptionsIndex];
    if (statusOption && String(statusOption).trim() !== '') {
      options.statusOptions.push(statusOption);
    }

    // Populate Case Managers
    const caseManager = row[caseManagerIndex];
    if (caseManager && String(caseManager).trim() !== '') {
      options.caseManagers.push(caseManager);
    }
    
    // Populate Role Options
    const roleOption = row[rolesIndex];
    if (roleOption && String(roleOption).trim() !== '') {
      options.roleOptions.push(roleOption);
    }

    // Populate Directive Type Options (NEW)
    if (directiveTypeIndex !== -1) {
      const directiveType = row[directiveTypeIndex];
      if (directiveType && String(directiveType).trim() !== '') {
        options.directiveTypes.push(directiveType);
      }
    }

    // Populate Directive Status Options (NEW)
    if (directiveStatusIndex !== -1) {
      const directiveStatus = row[directiveStatusIndex];
      if (directiveStatus && String(directiveStatus).trim() !== '') {
        options.directiveStatuses.push(directiveStatus);
      }
    }
  });

  return options;
}

/**
 * Fetches the Grantee Name and a list of all household members for a given HH_ID.
 * @param {string} hhId The Household ID to look up.
 * @returns {object} An object containing the granteeName and an array of member objects.
 */
function getHouseholdData(hhId) {
  try {
    const data = granteeDataSheet.getDataRange().getValues();
    const headers = data.shift(); // Remove headers to work with indices
    
    const hhIdIndex = headers.indexOf('HH_ID');
    const granteeNameIndex = headers.indexOf('GranteeFullName');
    const entryIdIndex = headers.indexOf('EntryID');
    const memberNameIndex = headers.indexOf('MemberFullName');

    let granteeName = null;
    const members = [];

    data.forEach(row => {
      if (row[hhIdIndex] && row[hhIdIndex].toString() === hhId.toString()) {
        // The first time we find the HH_ID, we grab the main grantee name.
        if (!granteeName) {
          granteeName = row[granteeNameIndex];
        }
        // We collect every member associated with this HH_ID.
        if (row[entryIdIndex] && row[memberNameIndex]) {
          members.push({
            entryId: row[entryIdIndex],
            memberName: row[memberNameIndex]
          });
        }
      }
    });

    return { granteeName, members };
  } catch (e) {
    Logger.log(`Error in getHouseholdData: ${e}`);
    return { granteeName: null, members: [] };
  }
}

// --- ADMIN FUNCTIONS ---

/**
 * Fetches all users for the admin management page. Excludes passwords.
 * @param {object} userInfo The logged-in user's information.
 * @returns {Array<object>} A list of user objects.
 */
function getUsersForAdmin(userInfo) {
  // Use the new viewType for a robust security check
  if (userInfo.viewType !== 'Admin_view') {
    throw new Error('Access denied. Admin role required.');
  }

  const usersData = usersSheet.getDataRange().getValues();
  const headers = usersData.shift(); // Remove header row

  const emailIndex = headers.indexOf('EmailAddress');
  const nameIndex = headers.indexOf('FullName');
  const roleIndex = headers.indexOf('Role');
  const areaIndex = headers.indexOf('AreaName');
  const statusIndex = headers.indexOf('ApprovalStatus');
  const userCodeIndex = headers.indexOf('UserCode');

  const users = usersData.map(row => ({
    email: row[emailIndex],
    fullName: row[nameIndex],
    role: row[roleIndex],
    areaName: row[areaIndex],
    approvalStatus: row[statusIndex],
    userCode: userCodeIndex !== -1 ? row[userCodeIndex] : ''
  }));

  return users;
}

/**
 * Updates a user's details, such as approval status and user code, with duplicate code validation.
 * @param {string} userEmail The email of the user to update.
 * @param {object} details An object containing details to update, e.g., { newStatus: 'Approved', userCode: 'JDC' }.
 * @param {object} adminInfo The admin user performing the action.
 * @returns {object} A success or failure message.
 */
function updateUserDetailsByAdmin(userEmail, details, adminInfo) {
  // Use the new viewType for a robust security check
  if (adminInfo.viewType !== 'Admin_view') {
    throw new Error('Access denied. Admin role required.');
  }

  const usersData = usersSheet.getDataRange().getValues();
  const headers = usersData[0];
  const emailColIndex = headers.indexOf('EmailAddress');
  const statusColIndex = headers.indexOf('ApprovalStatus');
  const userCodeColIndex = headers.indexOf('UserCode');

  if (userCodeColIndex === -1) {
    throw new Error('UserCode column not found in Users sheet. Please run setup.');
  }

  // --- Duplicate UserCode Check ---
  if (details.hasOwnProperty('userCode') && details.userCode) {
    const codeToCheck = details.userCode.trim().toUpperCase();
    
    for (let i = 1; i < usersData.length; i++) {
      const existingCode = usersData[i][userCodeColIndex];
      const existingEmail = usersData[i][emailColIndex];
      
      if (existingCode && existingCode.toUpperCase() === codeToCheck && existingEmail.toLowerCase() !== userEmail.toLowerCase()) {
        return { success: false, message: `User Code '${codeToCheck}' is already assigned to another user. Please choose a different one.` };
      }
    }
  }

  // Find the user and update their details.
  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][emailColIndex].toLowerCase() === userEmail.toLowerCase()) {
      const rowToUpdate = i + 1; // 1-based index
      let logParts = [`Admin ${adminInfo.email} updated user ${userEmail}.`];

      if (details.newStatus && ['Approved', 'Rejected', 'Pending'].includes(details.newStatus)) {
        usersSheet.getRange(rowToUpdate, statusColIndex + 1).setValue(details.newStatus);
        logParts.push(`Status set to '${details.newStatus}'.`);
      }
      
      if (details.hasOwnProperty('userCode')) {
        usersSheet.getRange(rowToUpdate, userCodeColIndex + 1).setValue(details.userCode);
        logParts.push(`UserCode set to '${details.userCode}'.`);
      }

      logActivity_('USER_DETAILS_UPDATE', logParts.join(' '));
      return { success: true, message: `User ${userEmail} details have been updated.` };
    }
  }
  throw new Error('User not found.');
}

// --- TRANSACTION LOGIC ---

/**
 * Generates a new, unique Batch Number based on the specified format.
 * Format: {UserCode}-{Y}{HexMonth}{DD}{Sequence}
 * @param {object} userInfo The logged-in user's information, must contain a `userCode`.
 * @returns {string} The newly generated Batch Number.
 */
function generateNewBatchNo(userInfo) {
  if (!userInfo || !userInfo.userCode) {
    throw new Error("User Code not found for your account. Cannot generate a Batch No. Please contact an administrator.");
  }
  
  const userCode = userInfo.userCode;
  const today = new Date();
  
  const year = today.getFullYear().toString().slice(-1);
  const month = (today.getMonth() + 1).toString(16).toUpperCase();
  const day = today.getDate().toString().padStart(2, '0');
  
  const datePart = `${year}${month}${day}`;
  const batchPrefix = `${userCode}-${datePart}`;
  
  const lastRow = transactionsSheet.getLastRow();
  if (lastRow < 2) { // No transactions yet
    return `${batchPrefix}A`;
  }

  const batchNoColumn = transactionsSheet.getRange(2, 2, lastRow - 1, 1).getValues().flat();
  const todaysBatches = batchNoColumn.filter(b => b && b.toString().startsWith(batchPrefix));
  
  if (todaysBatches.length === 0) {
    return `${batchPrefix}A`;
  }

  let maxSeqChar = '@'; // ASCII character before 'A'
  todaysBatches.forEach(b => {
    const seqChar = b.slice(-1);
    if (seqChar > maxSeqChar) {
      maxSeqChar = seqChar;
    }
  });
  
  const newSeqChar = String.fromCharCode(maxSeqChar.charCodeAt(0) + 1);
  
  return `${batchPrefix}${newSeqChar}`;
}

/**
 * Creates a batch of new transactions.
 * @param {object} batchData An object containing the batchNo and an array of transaction objects.
 * @param {object} userInfo The logged-in user's information.
 * @returns {string} The batch number if successful.
 */
function createTransactionsBatch(batchData, userInfo) {
  try {
    const { batchNo, transactions } = batchData;
    if (!batchNo || !transactions || transactions.length === 0) {
      throw new Error('Invalid batch data received.');
    }

    const timestamp = new Date();
    const rowsToAdd = [];
    const userEmail = userInfo.email;

    transactions.forEach(data => {
      if (!data.transactionId || !data.hhId) {
        return; 
      }
      
      const newRow = [
        data.transactionId,        // TRANSACTION_ID
        batchNo,                   // BATCH_NO
        timestamp,                 // DATE_SUBMITTED
        userInfo.fullName,         // SUBMITTED_BY
        data.hhId,                 // HH_ID_NO
        data.granteeName,          // GRANTEE_NAME
        data.entryId,              // ENTRY_ID_NO
        data.memberName,           // MEMBER_NAME
        userInfo.fullName,         // CASE_MANAGER
        data.updateType,           // UPDATE_TYPE
        data.requirementsStatus,   // REQUIREMENTS_STATUS
        data.newValue,             // NEW_VALUE
        data.attachments,          // ATTACHMENTS
        data.validation,           // VALIDATION
        data.recommendation,       // RECOMMENDATION
        'Submitted',               // CURRENT_STATUS
        '',                        // STATUS_CHANGED_BY
        '',                        // DATE_STATUS_CHANGED
        ''                         // REMARKS
      ];
      rowsToAdd.push(newRow);

      // Log the initial status in the new history sheet
      logTransactionHistory_(data.transactionId, userEmail, 'Created', 'Submitted', 'Initial submission.');
    });

    if (rowsToAdd.length > 0) {
      transactionsSheet.getRange(transactionsSheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length)
                     .setValues(rowsToAdd);
      
      const logDetails = `${rowsToAdd.length} transactions created in batch ${batchNo} by ${userEmail}.`;
      logActivity_('CREATE_BATCH_TRANSACTION', logDetails);
    }
    
    return batchNo;
  } catch (e) {
    Logger.log(`Error in createTransactionsBatch: ${e}`);
    throw new Error('Failed to create transaction batch.');
  }
}

function searchTransactions(query) {
    if (!query || String(query).trim() === '') {
        return [];
    }
    const lowerCaseQuery = String(query).toLowerCase();
    
    const dataRange = transactionsSheet.getRange(1, 1, transactionsSheet.getLastRow(), transactionsSheet.getLastColumn());
    
    // Get original values to preserve data types (like dates) for the final result
    const originalValues = dataRange.getValues();
    const headers = originalValues.shift(); // Remove header row

    // Get display values (strings) for a reliable text-based search
    const displayValues = dataRange.getDisplayValues();
    displayValues.shift(); // Remove header row to align with originalValues

    const results = [];

    // Iterate through the display values for a safe search
    displayValues.forEach((row, rowIndex) => {
        // .some() is efficient and stops as soon as a match is found in the row
        const isMatch = row.some(cell => cell.toLowerCase().includes(lowerCaseQuery));

        if (isMatch) {
            // If we find a match, build the result object from the original data
            // to ensure data types are correct for the client.
            const resultObj = {};
            headers.forEach((header, colIndex) => {
                const originalValue = originalValues[rowIndex][colIndex];
                
                // Standardize dates into ISO strings for reliable client-side parsing
                if (originalValue instanceof Date) {
                    resultObj[header] = originalValue.toISOString();
                } else {
                    resultObj[header] = originalValue;
                }
            });
            results.push(resultObj);
        }
    });

    return results;
}

function updateTransactionStatus(transactionId, newStatus, remarks, userInfo) {
  try {
    const data = transactionsSheet.getDataRange().getValues();
    const headers = data[0];
    const idColIndex = headers.indexOf('TRANSACTION_ID');
    const statusColIndex = headers.indexOf('CURRENT_STATUS');
    const remarksColIndex = headers.indexOf('REMARKS');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIndex] === transactionId) {
        const oldStatus = data[i][statusColIndex];
        const oldRemarks = data[i][remarksColIndex] || '';
        const rowToUpdate = i + 1;

        // Check if anything has actually changed
        const statusChanged = oldStatus !== newStatus;
        const remarksChanged = oldRemarks !== remarks;
        
        if (!statusChanged && !remarksChanged) {
            return { success: false, message: 'No changes detected.' };
        }

        // Update the fields
        transactionsSheet.getRange(rowToUpdate, statusColIndex + 1).setValue(newStatus);
        transactionsSheet.getRange(rowToUpdate, remarksColIndex + 1).setValue(remarks);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('STATUS_CHANGED_BY') + 1).setValue(userInfo.fullName);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('DATE_STATUS_CHANGED') + 1).setValue(new Date());

        // Log the change in history - only if status actually changed
        if (statusChanged) {
          logTransactionHistory_(transactionId, userInfo.email, oldStatus, newStatus, remarks);
        } else {
          // If only remarks changed, we could optionally log this differently
          logActivity_('REMARKS_UPDATE', `Remarks updated for transaction ${transactionId} by ${userInfo.email}`);
        }

        let message = 'Transaction ' + transactionId + ' updated: ';
        if (statusChanged && remarksChanged) {
          message += 'Status and remarks changed.';
        } else if (statusChanged) {
          message += 'Status changed.';
        } else if (remarksChanged) {
          message += 'Remarks updated.';
        }

        return { success: true, message: message };
      }
    }
    throw new Error('Transaction ID not found.');
  } catch(e) {
    Logger.log(`Error in updateTransactionStatus: ${e}`);
    throw new Error('Failed to update transaction.');
  }
}


// --- UTILITY ---

/**
 * Logs a general application activity to the 'ActivityLog' sheet.
 * @param {string} actionType The type of action performed (e.g., USER_LOGIN).
 * @param {string} details A description of the event.
 */
function logActivity_(actionType, details) {
  try {
    const logId = activityLogSheet.getLastRow(); // Use a simple row count for ID
    const user = Session.getActiveUser() ? Session.getActiveUser().getEmail() : 'SYSTEM';
    activityLogSheet.appendRow([logId, new Date(), user, actionType, details]);
  } catch (e) {
    Logger.log(`Failed to write to ActivityLog sheet: ${e}`);
  }
}

/**
 * Logs a transaction's status change to the 'TransactionHistory' sheet.
 * This creates a structured audit trail for every transaction.
 * @param {string} transactionId The ID of the transaction being updated.
 * @param {string} userEmail The email of the user making the change.
 * @param {string} previousStatus The status before the change.
 * @param {string} newStatus The status after the change.
 * @param {string} remarks Any notes associated with the change.
 */
function logTransactionHistory_(transactionId, userEmail, previousStatus, newStatus, remarks) {
  try {
    const historyId = transactionHistorySheet.getLastRow(); // Use a simple row count for ID
    transactionHistorySheet.appendRow([
      historyId,
      transactionId,
      new Date(),
      userEmail,
      previousStatus,
      newStatus,
      remarks
    ]);
  } catch (e) {
    Logger.log(`Failed to write to TransactionHistory sheet for TX_ID ${transactionId}: ${e}`);
  }
}

/**
 * Fetches all transactions submitted by the current user.
 * @param {object} userInfo The logged-in user's information.
 * @returns {Array<object>} A list of transaction objects.
 */
function getSubmittedByUser(userInfo) {
  const data = transactionsSheet.getDataRange().getValues();
  const headers = data.shift();
  const submittedByIndex = headers.indexOf('SUBMITTED_BY');
  
  const results = data.filter(row => row[submittedByIndex] === userInfo.fullName)
    .map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        // Ensure dates are in a standardized ISO format for reliable parsing on the client-side
        if (row[i] instanceof Date) {
          obj[header] = row[i].toISOString();
        } else {
          obj[header] = row[i];
        }
      });
      return obj;
    })
    .sort((a, b) => {
      // Robust sorting to handle invalid or missing dates
      const dateA = new Date(a.DATE_SUBMITTED);
      const dateB = new Date(b.DATE_SUBMITTED);
      
      const timeA = !isNaN(dateA.getTime()) ? dateA.getTime() : 0;
      const timeB = !isNaN(dateB.getTime()) ? dateB.getTime() : 0;

      return timeB - timeA; // Sort most recent (highest timestamp) first
    });
    
  return results;
}

/**
 * Allows a CL user to update a transaction they submitted, but only if it's still in 'Submitted' status.
 * @param {object} transactionData The updated data for the transaction, including its ID.
 * @param {object} userInfo The logged-in user performing the action.
 * @returns {object} A success or failure message.
 */
function updateTransactionByCL(transactionData, userInfo) {
  try {
    const data = transactionsSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const idColIndex = headers.indexOf('TRANSACTION_ID');
    const statusColIndex = headers.indexOf('CURRENT_STATUS');
    const submittedByColIndex = headers.indexOf('SUBMITTED_BY');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIndex] === transactionData.TRANSACTION_ID) {
        // SECURITY CHECK: Ensure the transaction is still 'Submitted' and belongs to the user
        if (data[i][statusColIndex] !== 'Submitted') {
          throw new Error('This transaction has already been processed and can no longer be edited.');
        }
        if (data[i][submittedByColIndex] !== userInfo.fullName) {
          throw new Error('You can only edit transactions you have submitted.');
        }

        const rowToUpdate = i + 1; // 1-based index
        
        // Update only the fields a CL user is allowed to change
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('HH_ID_NO') + 1).setValue(transactionData.HH_ID_NO);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('GRANTEE_NAME') + 1).setValue(transactionData.GRANTEE_NAME);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('ENTRY_ID_NO') + 1).setValue(transactionData.ENTRY_ID_NO);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('MEMBER_NAME') + 1).setValue(transactionData.MEMBER_NAME);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('UPDATE_TYPE') + 1).setValue(transactionData.UPDATE_TYPE);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('NEW_VALUE') + 1).setValue(transactionData.NEW_VALUE);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('REQUIREMENTS_STATUS') + 1).setValue(transactionData.REQUIREMENTS_STATUS);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('ATTACHMENTS') + 1).setValue(transactionData.ATTACHMENTS);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('VALIDATION') + 1).setValue(transactionData.VALIDATION);
        transactionsSheet.getRange(rowToUpdate, headers.indexOf('RECOMMENDATION') + 1).setValue(transactionData.RECOMMENDATION);
        
        const logDetails = `Transaction ${transactionData.TRANSACTION_ID} was edited by submitter ${userInfo.email}.`;
        logActivity_('EDIT_TRANSACTION', logDetails);

        return { success: true, message: `Transaction ${transactionData.TRANSACTION_ID} updated successfully.` };
      }
    }
    throw new Error('Transaction ID not found.');
  } catch (e) {
    Logger.log(`Error in updateTransactionByCL: ${e}`);
    throw new Error(e.message || 'Failed to update transaction.');
  }
}

/**
 * Allows a CL user to DELETE a transaction they submitted, but only if it's in 'Submitted' status.
 * @param {string} transactionId The ID of the transaction to delete.
 * @param {object} userInfo The logged-in user performing the action.
 * @returns {object} A success or failure message.
 */
function deleteTransactionByCL(transactionId, userInfo) {
  try {
    const data = transactionsSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const idColIndex = headers.indexOf('TRANSACTION_ID');
    const statusColIndex = headers.indexOf('CURRENT_STATUS');
    const submittedByColIndex = headers.indexOf('SUBMITTED_BY');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIndex] === transactionId) {
        // SECURITY CHECK: Ensure the transaction is still 'Submitted' and belongs to the user
        if (data[i][statusColIndex] !== 'Submitted') {
          throw new Error('This transaction has already been processed and cannot be deleted.');
        }
        if (data[i][submittedByColIndex] !== userInfo.fullName) {
          throw new Error('You can only delete transactions you have submitted.');
        }

        const rowToDelete = i + 1; // 1-based index
        transactionsSheet.deleteRow(rowToDelete);
        
        const logDetails = `Transaction ${transactionId} was deleted by submitter ${userInfo.email}.`;
        logActivity_('DELETE_TRANSACTION', logDetails);

        return { success: true, message: `Transaction ${transactionId} was successfully deleted.` };
      }
    }
    throw new Error('Transaction ID not found.');
  } catch (e) {
    Logger.log(`Error in deleteTransactionByCL: ${e}`);
    throw new Error(e.message || 'Failed to delete transaction.');
  }
}

/**
 * Internal helper function to get the mapping of roles to view types.
 * @returns {object} An object like {'City Link': 'CL_view', 'WebAdmin': 'Admin_view'}
 */
function getRoleViewMapping_() {
  const mapping = {};
  // Assuming Roles is Col G, ViewTypes is Col H. Adjust if necessary.
  const data = dropdownsSheet.getRange("G2:H" + dropdownsSheet.getLastRow()).getValues(); 

  data.forEach(row => {
    const role = row[0];
    const viewType = row[1];
    if (role && viewType) {
      mapping[role] = viewType;
    }
  });
  return mapping;
}

// --- REGIONAL DIRECTIVE FUNCTIONS ---

/**
 * Generates a new, unique Directive ID.
 * Format: D-{UserCode}-{YYYYMMDD}-{Sequence}
 * @param {object} userInfo The logged-in user's information.
 * @returns {string} The newly generated Directive ID.
 */
function generateNewDirectiveId(userInfo) {
  if (!userInfo || !userInfo.userCode) {
    throw new Error("User Code not found. Cannot generate a Directive ID.");
  }
  
  const userCode = userInfo.userCode;
  const today = new Date();
  
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  
  const datePart = `${year}${month}${day}`;
  const idPrefix = `D-${userCode}-${datePart}`;
  
  const lastRow = directivesSheet.getLastRow();
  if (lastRow < 2) {
    return `${idPrefix}-1`;
  }

  const idColumn = directivesSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const todaysDirectives = idColumn.filter(id => id && id.toString().startsWith(idPrefix));
  
  return `${idPrefix}-${todaysDirectives.length + 1}`;
}

/**
 * Saves a new directive or updates an existing one, logging status changes.
 * @param {object} directiveData The data for the directive.
 * @param {object} userInfo The user performing the action.
 * @returns {object} A result object with success status and the saved data.
 */
function saveOrUpdateDirective(directiveData, userInfo) {
  try {
    const headers = directivesSheet.getRange(1, 1, 1, directivesSheet.getLastColumn()).getValues()[0];
    const idColIndex = headers.indexOf('DIRECTIVE_ID');
    const allIds = directivesSheet.getLastRow() > 1 ? directivesSheet.getRange(2, idColIndex + 1, directivesSheet.getLastRow() - 1, 1).getValues().flat() : [];
    const rowIndex = allIds.indexOf(directiveData.DIRECTIVE_ID);

    const timestamp = new Date();
    const userEmail = userInfo.email;
    const userFullName = userInfo.fullName;

    const endorsedDate = new Date(directiveData.DATE_ENDORSED);
    if (isNaN(endorsedDate.getTime())) {
      throw new Error("Invalid 'Date Endorsed' value provided.");
    }

    const rowData = [
      directiveData.DIRECTIVE_ID, directiveData.HOUSEHOLD_ID, directiveData.GRANTEE_NAME,
      directiveData.ENTRY_ID, directiveData.MEMBER_NAME, directiveData.DIRECTIVE_TYPE,
      endorsedDate, directiveData.DETAILS, directiveData.CURRENT_STATUS,
      directiveData.CASE_MANAGER, directiveData.REMARKS, timestamp, userFullName
    ];

    if (rowIndex !== -1) {
      // --- UPDATE PATH ---
      const rowToUpdate = rowIndex + 2;
      const oldRowData = directivesSheet.getRange(rowToUpdate, 1, 1, headers.length).getValues()[0];

      const oldDataMap = headers.reduce((acc, header, i) => {
        acc[header] = oldRowData[i];
        return acc;
      }, {});

      const oldDateEndorsedStr = (oldDataMap.DATE_ENDORSED instanceof Date) ? oldDataMap.DATE_ENDORSED.toISOString().split('T')[0] : '';
      
      const hasChanged = (
        String(oldDataMap.HOUSEHOLD_ID || '') != String(directiveData.HOUSEHOLD_ID || '') ||
        String(oldDataMap.GRANTEE_NAME || '') != String(directiveData.GRANTEE_NAME || '') ||
        String(oldDataMap.MEMBER_NAME || '') != String(directiveData.MEMBER_NAME || '') ||
        String(oldDataMap.DIRECTIVE_TYPE || '') != String(directiveData.DIRECTIVE_TYPE || '') ||
        oldDateEndorsedStr != directiveData.DATE_ENDORSED ||
        String(oldDataMap.DETAILS || '') != String(directiveData.DETAILS || '') ||
        String(oldDataMap.CURRENT_STATUS || '') != String(directiveData.CURRENT_STATUS || '') ||
        String(oldDataMap.CASE_MANAGER || '') != String(directiveData.CASE_MANAGER || '') ||
        String(oldDataMap.REMARKS || '') != String(directiveData.REMARKS || '')
      );

      if (!hasChanged) {
        return { success: true, message: 'No changes detected. Nothing was saved.' };
      }

      directivesSheet.getRange(rowToUpdate, 1, 1, rowData.length).setValues([rowData]);
      logActivity_('UPDATE_DIRECTIVE', `Directive ${directiveData.DIRECTIVE_ID} updated by ${userEmail}.`);

      logTransactionHistory_(
        directiveData.DIRECTIVE_ID,
        userEmail,
        oldDataMap.CURRENT_STATUS,
        directiveData.CURRENT_STATUS,
        directiveData.REMARKS
      );

    } else {
      // --- CREATE PATH ---
      directivesSheet.appendRow(rowData);
      logActivity_('CREATE_DIRECTIVE', `New directive ${directiveData.DIRECTIVE_ID} created by ${userEmail}.`);

      logTransactionHistory_(
        directiveData.DIRECTIVE_ID,
        userEmail,
        'Created',
        directiveData.CURRENT_STATUS,
        directiveData.REMARKS || 'Initial directive creation.'
      );
    }

    return { success: true, data: directiveData, message: 'Directive saved successfully.' };
  } catch (e) {
    Logger.log(`Error in saveOrUpdateDirective: ${e}`);
    throw new Error('Failed to save the directive.');
  }
}

/**
 * Fetches directives based on search criteria.
 * @param {object} searchCriteria Can be { type: 'pending' } or { type: 'hhId', value: '...' }.
 * @returns {Array<object>} A list of directive objects.
 */
function getDirectives(searchCriteria) {
  if (directivesSheet.getLastRow() < 2) return [];

  const data = directivesSheet.getDataRange().getValues();
  const headers = data.shift();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today's date for accurate day counting

  const hhIdIndex = headers.indexOf('HOUSEHOLD_ID');
  const statusIndex = headers.indexOf('CURRENT_STATUS');
  const dateEndorsedIndex = headers.indexOf('DATE_ENDORSED');

  const pendingStatuses = ['Received', 'Pending for CL Validation', 'Pending for Consolidation/Report to Region'];

  let filteredData;
  if (searchCriteria.type === 'pending') {
    filteredData = data.filter(row => pendingStatuses.includes(row[statusIndex]));
  } else if (searchCriteria.type === 'hhId' && searchCriteria.value) {
    filteredData = data.filter(row => row[hhIdIndex] === searchCriteria.value);
  } else {
    return [];
  }

  const results = filteredData.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      const value = row[i];
      if (value instanceof Date) {
        obj[header] = value.toISOString(); // Standardize dates
      } else {
        obj[header] = value;
      }
    });

    // Calculate Days Lapsed
    const endorsedDate = new Date(obj.DATE_ENDORSED);
    endorsedDate.setHours(0, 0, 0, 0);
    if (!isNaN(endorsedDate.getTime())) {
      const diffTime = Math.abs(today - endorsedDate);
      obj.DAYS_LAPSED = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      obj.DAYS_LAPSED = null;
    }
    
    return obj;
  }).sort((a, b) => {
    // Sort by Date Endorsed, most recent at the bottom (ascending order)
    const dateA = new Date(a.DATE_ENDORSED).getTime();
    const dateB = new Date(b.DATE_ENDORSED).getTime();
    return dateA - dateB;
  });

  return results;
}
