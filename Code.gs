// --- Global Configuration ---
// IMPORTANT: Replace these placeholders with your actual Folder ID and Spreadsheet ID.
const SPREADSHEET_ID = "1cJx3XWKjLfJWjk7ppZyALql2KTQBt-Q9HiqMRBL7c-Y";
const DRIVE_FOLDER_ID = "1AFOI4DlLYHYQTzSx5Hj2AjLSpHYBoCoq";
const LOG_SHEET_NAME = "Log";
const DROPDOWN_SHEET_NAME = "Dropdown";

/**
 * @description Serves the main web page.
 * This function is the entry point for the web app.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Staff Time-In')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * @description Includes other HTML files into the main template.
 * This allows us to keep our CSS separate.
 * @param {string} filename The name of the file to include.
 * @returns {string} The raw content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * @description Fetches the list of staff names from the Google Sheet.
 * This function is called by the client-side JavaScript to populate the dropdown.
 * @returns {string[]} An array of staff names.
 */
function getStaffNames() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DROPDOWN_SHEET_NAME);
    // Assumes names are in the first column (A), starting from row 2
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1);
    const names = range.getValues().flat().filter(String); // .flat() converts 2D array to 1D, .filter(String) removes empty rows
    return names;
  } catch (error) {
    Logger.log("Error in getStaffNames: " + error.message);
    return []; // Return an empty array on error
  }
}

/**
 * @description Fetches the list of work statuses from the Google Sheet.
 * @returns {string[]} An array of work status options.
 */
function getWorkStatuses() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DROPDOWN_SHEET_NAME);
    // Assumes statuses are in the second column (B), starting from row 2
    const range = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1);
    const statuses = range.getValues().flat().filter(String);
    return statuses;
  } catch (error) {
    Logger.log("Error in getWorkStatuses: " + error.message);
    return [];
  }
}

/**
 * @description Processes the user's log-in data. Saves selfie/location for full logs and only status for simple logs.
 * @param {object} data The data object sent from the client-side. It may or may not contain image and location data.
 * @returns {object} A success or error object.
 */
function logUserData(data) {
  try {
    const timestamp = new Date();
    const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET_NAME);

    // Check if this is a "full" log with image and location data
    if (data.imageData && data.latitude !== undefined && data.longitude !== undefined) {
      // --- Logic for "At Work Station" and "With TR" ---

      // 1. Decode the Base64 image data and create a file
      const decodedImage = Utilities.base64Decode(data.imageData.split(',')[1]);
      const blob = Utilities.newBlob(decodedImage, 'image/jpeg', `${data.staffName}_${timestamp.toISOString()}.jpg`);
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const file = folder.createFile(blob);
      const fileUrl = file.getUrl();

      // 2. Get human-readable address from coordinates
      const address = getReadableAddress(data.latitude, data.longitude);

      // 3. Create the Google Maps link from coordinates
      const gmapLink = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;

      // 4. Append the full log to the Google Sheet
      logSheet.appendRow([
        timestamp,
        data.staffName,
        fileUrl,
        `${data.latitude}, ${data.longitude}`,
        address,
        gmapLink,
        data.purpose,
        data.workStatus
      ]);

      // 5. Return the full success object for the receipt
      return {
        success: true,
        message: "Log-in successful! Data recorded.",
        timestamp: timestamp.toISOString(),
        address: address,
        purpose: data.purpose,
        workStatus: data.workStatus
      };

    } else {
      // --- Logic for Leave, Absent, etc. ---

      // 1. Append a row with only the available data. Other columns are left blank.
      logSheet.appendRow([
        timestamp,
        data.staffName,
        "", // Selfie Link
        "", // GeoTag Location
        "", // Location Name
        "", // Location Link
        "", // Purpose
        data.workStatus
      ]);

      // 2. Return a simpler success object for the receipt
      return {
        success: true,
        message: "Status successfully recorded.",
        timestamp: timestamp.toISOString(),
        workStatus: data.workStatus
        // No address or purpose is returned as they were not provided.
      };
    }

  } catch (error) {
    Logger.log("Error in logUserData: " + error.toString());
    return {
      success: false,
      message: "Error: Could not save data. " + error.toString()
    };
  }
}

/**
 * @description Converts latitude and longitude into a human-readable address.
 * Uses Google's Maps service for reverse geocoding.
 * @param {number} lat The latitude.
 * @param {number} lon The longitude.
 * @returns {string} The formatted address, or an error message.
 */
function getReadableAddress(lat, lon) {
  if (!lat || !lon) {
    return "No location provided";
  }
  try {
    // This uses the built-in Maps service in Apps Script
    const response = Maps.newGeocoder().reverseGeocode(lat, lon);
    if (response && response.results && response.results.length > 0) {
      // The first result is usually the most specific one.
      return response.results[0].formatted_address;
    }
    return "Address not found";
  } catch (error) {
    Logger.log("Error in getReadableAddress: " + error.message);
    return "Could not retrieve address";
  }
}

/**
 * ONE-TIME-USE FUNCTION: This function scans the 'Log' sheet and backfills the 
 * 'Location Link' for any old entries that are missing it.
 * To use: Select 'backfillLocationLinks' from the function list in the Apps Script
 * editor and click 'Run'.
 */
function backfillLocationLinks() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    // This message will appear in a popup in the script editor.
    Browser.msgBox("Error", "The 'Log' sheet could not be found. Please check the LOG_SHEET_NAME variable.", Browser.Buttons.OK);
    return;
  }

  const range = sheet.getDataRange();
  const values = range.getValues();

  // Get the headers to find the correct columns dynamically. This is safer than using fixed numbers.
  const headers = values[0];
  const geoTagColIndex = headers.indexOf("GeoTag Location"); // Should be column D
  const locationLinkColIndex = headers.indexOf("Location Link"); // Should be column F

  if (geoTagColIndex === -1 || locationLinkColIndex === -1) {
    Browser.msgBox("Error", "Could not find the 'GeoTag Location' or 'Location Link' headers in your sheet.", Browser.Buttons.OK);
    return;
  }

  let updatedCount = 0;
  // Loop through all data rows, starting at index 1 to skip the header row.
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const geoTagData = row[geoTagColIndex];
    const locationLinkData = row[locationLinkColIndex];

    // Check if a GeoTag exists but the Location Link is empty.
    if (geoTagData && !locationLinkData) {
      // If so, create the link and add it to our data array.
      values[i][locationLinkColIndex] = `https://www.google.com/maps?q=${geoTagData}`;
      updatedCount++;
    }
  }

  // If we found any rows to update, write the entire modified data array back to the sheet.
  // This is much more efficient than updating one cell at a time.
  if (updatedCount > 0) {
    range.setValues(values);
    Browser.msgBox("Success", `Operation complete. Updated ${updatedCount} rows with new location links.`, Browser.Buttons.OK);
  } else {
    Browser.msgBox("Info", "No rows required updating. All entries already have a location link.", Browser.Buttons.OK);
  }
}

// --- NEW FUNCTIONS FOR LOCATOR BOARD ---



/**
 * @description Fetches and processes data for the Locator Board for a specific date.
 * This version uses a robust string-based date comparison to avoid timezone issues.
 * @param {string} dateString The date in YYYY-MM-DD format.
 * @returns {Array<object>} An array of objects, each representing a staff member's status.
 */
function getLocatorData(dateString) {
  try {
    // This is the target date string from the UI, e.g., "2025-07-10"
    const targetDateString = dateString; 

    const allStaffNames = getStaffNames();
    const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET_NAME);
    const logData = logSheet.getDataRange().getValues();
    const headers = logData.shift();

    const headerMap = {
      tsIndex: headers.indexOf("Timestamp"),
      nameIndex: headers.indexOf("Staff Name"),
      selfieIndex: headers.indexOf("Selfie Link"),
      addressIndex: headers.indexOf("Location Name"),
      mapLinkIndex: headers.indexOf("Location Link"),
      purposeIndex: headers.indexOf("Purpose"),
      statusIndex: headers.indexOf("Work Status")
    };
    
    const missingHeaders = Object.keys(headerMap).filter(key => headerMap[key] === -1);
    if (missingHeaders.length > 0) {
      const nameMap = { tsIndex: "Timestamp", nameIndex: "Staff Name", selfieIndex: "Selfie Link", addressIndex: "Location Name", mapLinkIndex: "Location Link", purposeIndex: "Purpose", statusIndex: "Work Status" };
      const missingHeaderNames = missingHeaders.map(key => `"${nameMap[key]}"`);
      throw new Error(`The 'Log' sheet is missing or has misspelled columns: ${missingHeaderNames.join(', ')}. Please check the sheet.`);
    }

    const loggedInStaff = new Map();

    for (const row of logData) {
      // Create a Date object from the spreadsheet timestamp
      const timestamp = new Date(row[headerMap.tsIndex]);
      
      // **THE KEY FIX**: Convert the log's timestamp to a "YYYY-MM-DD" string in the correct timezone.
      const logDateString = Utilities.formatDate(timestamp, "Asia/Manila", "yyyy-MM-dd");

      // Now compare the simple strings. This is 100% reliable.
      if (logDateString === targetDateString) {
        const staffName = row[headerMap.nameIndex];
        if (!loggedInStaff.has(staffName)) {
          loggedInStaff.set(staffName, {
            staffName: staffName,
            time: timestamp.toISOString(),
            workStatus: row[headerMap.statusIndex],
            purpose: row[headerMap.purposeIndex],
            selfieUrl: row[headerMap.selfieIndex],
            locationName: row[headerMap.addressIndex],
            locationLink: row[headerMap.mapLinkIndex]
          });
        }
      }
    }

    const results = allStaffNames.map(name => {
      if (loggedInStaff.has(name)) {
        return loggedInStaff.get(name);
      } else {
        return { staffName: name, noLog: true };
      }
    });

    return results;

  } catch (error) {
    Logger.log("Error in getLocatorData: " + error.toString());
    throw new Error("Could not retrieve locator data. " + error.message);
  }
}
