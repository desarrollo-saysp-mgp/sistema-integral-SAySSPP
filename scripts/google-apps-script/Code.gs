/**
 * Google Apps Script - Complaints Backup
 * Syncs complaints from Supabase to Google Sheets
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Go to Project Settings (gear icon) > Script Properties
 * 5. Add the following properties:
 *    - SUPABASE_URL: Your Supabase project URL (e.g., https://xxxxx.supabase.co)
 *    - SUPABASE_KEY: Your Supabase anon/public key
 * 6. Save, refresh the sheet, and use the SGR - Backup menu
 */

// ================================
// CONFIGURATION
// ================================

/**
 * Get configuration from Script Properties (secure storage)
 */
function getConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();
  return {
    SUPABASE_URL: scriptProperties.getProperty('SUPABASE_URL'),
    SUPABASE_KEY: scriptProperties.getProperty('SUPABASE_KEY'),
  };
}

const COMPLAINTS_SHEET = 'Reclamos';
const HEADERS = [
  'Número de Reclamo',
  'Fecha de Reclamo',
  'Nombre y Apellido',
  'Dirección',
  'Número',
  'DNI',
  'Teléfono',
  'Email',
  'Servicio',
  'Causa',
  'Zona',
  'Desde Cuándo',
  'Medio de Contacto',
  'Detalle',
  'Estado',
  'Derivado',
  'Responsable de Carga',
  'Fecha de Carga',
  'Última Modificación',
];

// ================================
// MAIN SYNC FUNCTIONS
// ================================

/**
 * Manual sync - syncs ALL complaints (use for initial setup or full refresh)
 */
function syncAllComplaints() {
  try {
    Logger.log('Starting FULL complaint sync...');

    var complaints = fetchComplaintsFromSupabase();
    var sheet = getOrCreateSheet(COMPLAINTS_SHEET);

    // Clear and rewrite all
    updateComplaintsSheet(sheet, complaints);

    Logger.log('Successfully synced ' + complaints.length + ' complaints');
    SpreadsheetApp.getUi().alert(
      'Sincronización Completa',
      'Se sincronizaron ' + complaints.length + ' reclamos.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error syncing complaints: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Error de Sincronización',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Scheduled sync - only adds complaints created TODAY (runs daily at 11 PM)
 * Fetches complaints created between 3 AM and 11 PM today
 * This function is called by the trigger
 */
function syncNewComplaints() {
  try {
    Logger.log('Starting daily complaints sync...');

    // Fetch only today's complaints (3 AM to 11 PM)
    var todayComplaints = fetchTodayComplaintsFromSupabase();
    Logger.log('Found ' + todayComplaints.length + ' complaints created today');

    if (todayComplaints.length === 0) {
      Logger.log('No complaints created today');
      return;
    }

    var sheet = getOrCreateSheet(COMPLAINTS_SHEET);

    // Get existing IDs to avoid duplicates (in case of re-runs)
    var existingIds = getExistingIds(sheet);

    // Filter out any that already exist
    var newComplaints = todayComplaints.filter(function(complaint) {
      return existingIds.indexOf(complaint.id) === -1;
    });

    Logger.log('Found ' + newComplaints.length + ' NEW complaints to add');

    if (newComplaints.length === 0) {
      Logger.log('All today\'s complaints already synced');
      return;
    }

    // Append new complaints
    appendNewComplaints(sheet, newComplaints);

    Logger.log('Successfully added ' + newComplaints.length + ' new complaints');
  } catch (error) {
    Logger.log('Error syncing new complaints: ' + error.message);
  }
}

// ================================
// SUPABASE API
// ================================

/**
 * Fetch ALL complaints from Supabase using the complaint_details view
 */
function fetchComplaintsFromSupabase() {
  var config = getConfig();
  var url = config.SUPABASE_URL + '/rest/v1/complaint_details?select=*&order=id.desc';

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'apikey': config.SUPABASE_KEY,
      'Authorization': 'Bearer ' + config.SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  });

  var responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error('Supabase API error: ' + responseCode + ' - ' + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

/**
 * Fetch only TODAY's complaints (created between 3 AM and 11 PM)
 * More efficient for daily sync
 */
function fetchTodayComplaintsFromSupabase() {
  var config = getConfig();

  // Get today's date at 3:00 AM
  var today = new Date();
  var startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 3, 0, 0);

  // Format as ISO string for Supabase query
  var startDate = startOfDay.toISOString();

  // Query complaints created today (from 3 AM onwards)
  var url = config.SUPABASE_URL + '/rest/v1/complaint_details?select=*&created_at=gte.' + encodeURIComponent(startDate) + '&order=id.desc';

  Logger.log('Fetching complaints from: ' + startDate);

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'apikey': config.SUPABASE_KEY,
      'Authorization': 'Bearer ' + config.SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  });

  var responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error('Supabase API error: ' + responseCode + ' - ' + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

// ================================
// SHEET FUNCTIONS
// ================================

/**
 * Get list of complaint IDs already in the sheet
 */
function getExistingIds(sheet) {
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return []; // Only header or empty
  }

  // Column A contains IDs
  var range = sheet.getRange(2, 1, lastRow - 1, 1);
  var values = range.getValues();

  return values.map(function(row) {
    return Number(row[0]);
  }).filter(function(id) {
    return id > 0;
  });
}

/**
 * Append new complaints to the sheet (without clearing existing data)
 */
function appendNewComplaints(sheet, complaints) {
  var lastRow = sheet.getLastRow();

  // Initialize headers if sheet is empty
  if (lastRow === 0) {
    initializeHeaders(sheet);
    lastRow = 1;
  }

  // Prepare rows for new complaints
  var rows = complaints.map(function(complaint) {
    return complaintToRow(complaint);
  });

  // Append at the end
  if (rows.length > 0) {
    sheet.getRange(lastRow + 1, 1, rows.length, HEADERS.length).setValues(rows);

    // Apply status coloring to new rows
    applyStatusColorsToRange(sheet, lastRow + 1, rows.length);
  }
}

/**
 * Update complaints sheet with ALL data (clears and rewrites)
 */
function updateComplaintsSheet(sheet, complaints) {
  // Clear existing data
  sheet.clear();

  // Set headers
  initializeHeaders(sheet);

  // Prepare data rows
  var rows = complaints.map(function(complaint) {
    return complaintToRow(complaint);
  });

  // Write data
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);

    // Auto-resize columns
    for (var i = 1; i <= HEADERS.length; i++) {
      sheet.autoResizeColumn(i);
    }

    // Apply status coloring
    applyStatusColorsToRange(sheet, 2, rows.length);
  }
}

/**
 * Initialize sheet headers
 */
function initializeHeaders(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#0E3F75');
  sheet.getRange(1, 1, 1, HEADERS.length).setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
}

/**
 * Convert complaint object to row array
 */
function complaintToRow(complaint) {
  return [
    complaint.id,
    formatDate(complaint.complaint_date),
    complaint.complainant_name,
    complaint.address,
    complaint.street_number,
    complaint.dni || '',
    complaint.phone_number || '',
    complaint.email || '',
    complaint.service_name,
    complaint.cause_name,
    complaint.zone,
    formatDate(complaint.since_when),
    complaint.contact_method,
    complaint.details,
    complaint.status,
    complaint.referred ? 'Sí' : 'No',
    complaint.loaded_by_name,
    formatDateTime(complaint.created_at),
    formatDateTime(complaint.updated_at),
  ];
}

/**
 * Apply conditional coloring to status column
 */
function applyStatusColorsToRange(sheet, startRow, numRows) {
  var statusColumn = 15; // Column O (Estado)

  for (var row = startRow; row < startRow + numRows; row++) {
    var cell = sheet.getRange(row, statusColumn);
    var status = cell.getValue();

    switch (status) {
      case 'En proceso':
        cell.setBackground('#FEF3C7'); // Yellow
        cell.setFontColor('#92400E');
        break;
      case 'Resuelto':
        cell.setBackground('#D1FAE5'); // Green
        cell.setFontColor('#065F46');
        break;
      case 'No resuelto':
        cell.setBackground('#FEE2E2'); // Red
        cell.setFontColor('#991B1B');
        break;
    }
  }
}

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Get or create a sheet by name
 */
function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  return sheet;
}

/**
 * Format date to DD/MM/YYYY
 */
function formatDate(dateString) {
  if (!dateString) return '';

  var date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  var day = String(date.getDate()).padStart(2, '0');
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var year = date.getFullYear();

  return day + '/' + month + '/' + year;
}

/**
 * Format datetime to DD/MM/YYYY HH:MM
 */
function formatDateTime(dateString) {
  if (!dateString) return '';

  var date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  var day = String(date.getDate()).padStart(2, '0');
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var year = date.getFullYear();
  var hours = String(date.getHours()).padStart(2, '0');
  var minutes = String(date.getMinutes()).padStart(2, '0');

  return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
}

// ================================
// CUSTOM MENU
// ================================

/**
 * Create custom menu when spreadsheet opens
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SGR - Backup')
    .addItem('Sincronizar TODOS los Reclamos', 'syncAllComplaints')
    .addItem('Sincronizar Reclamos de HOY', 'syncNewComplaintsManual')
    .addSeparator()
    .addItem('Configurar Sync Diario (11 PM)', 'setupAutoSync')
    .addItem('Desactivar Sync Automático', 'removeAutoSync')
    .addSeparator()
    .addItem('Verificar Configuración', 'verifyConfiguration')
    .addToUi();
}

/**
 * Manual trigger for syncing today's complaints (with UI feedback)
 */
function syncNewComplaintsManual() {
  try {
    Logger.log('Starting TODAY\'s complaints sync (manual)...');

    // Fetch only today's complaints
    var todayComplaints = fetchTodayComplaintsFromSupabase();

    if (todayComplaints.length === 0) {
      SpreadsheetApp.getUi().alert(
        'Sin Reclamos Hoy',
        'No hay reclamos creados hoy.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    var sheet = getOrCreateSheet(COMPLAINTS_SHEET);
    var existingIds = getExistingIds(sheet);

    var newComplaints = todayComplaints.filter(function(complaint) {
      return existingIds.indexOf(complaint.id) === -1;
    });

    if (newComplaints.length === 0) {
      SpreadsheetApp.getUi().alert(
        'Ya Sincronizados',
        'Los ' + todayComplaints.length + ' reclamos de hoy ya están en la hoja.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    appendNewComplaints(sheet, newComplaints);

    SpreadsheetApp.getUi().alert(
      'Sincronización Completada',
      'Se agregaron ' + newComplaints.length + ' reclamos de hoy.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Error',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

// ================================
// AUTO SYNC (TRIGGERS)
// ================================

/**
 * Set up automatic daily sync at 11 PM
 */
function setupAutoSync() {
  var ui = SpreadsheetApp.getUi();

  var response = ui.alert(
    'Configurar Sincronización Diaria',
    'Esto configurará la sincronización automática de reclamos NUEVOS todos los días a las 11:00 PM.\n\n¿Desea continuar?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  try {
    // Remove existing triggers first
    removeAutoSync(true);

    // Create daily trigger at 11 PM (hour 23)
    ScriptApp.newTrigger('syncNewComplaints')
      .timeBased()
      .atHour(23)
      .everyDays(1)
      .create();

    ui.alert(
      'Sincronización Configurada',
      '✓ Sincronización diaria activada.\n\nLos reclamos NUEVOS se sincronizarán todos los días a las 11:00 PM.',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('Error', 'No se pudo configurar: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * Remove automatic sync triggers
 */
function removeAutoSync(silent) {
  var triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  if (!silent) {
    SpreadsheetApp.getUi().alert(
      'Sincronización Desactivada',
      'Se eliminaron ' + triggers.length + ' trigger(s).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

// ================================
// CONFIGURATION CHECK
// ================================

/**
 * Verify configuration is set up correctly
 */
function verifyConfiguration() {
  var ui = SpreadsheetApp.getUi();
  var config = getConfig();

  if (!config.SUPABASE_URL) {
    ui.alert(
      'Configuración Incompleta',
      'Falta SUPABASE_URL.\n\nVe a Project Settings > Script Properties para configurar.',
      ui.ButtonSet.OK
    );
    return;
  }

  if (!config.SUPABASE_KEY) {
    ui.alert(
      'Configuración Incompleta',
      'Falta SUPABASE_KEY.\n\nVe a Project Settings > Script Properties para configurar.',
      ui.ButtonSet.OK
    );
    return;
  }

  // Test connection
  try {
    var testUrl = config.SUPABASE_URL + '/rest/v1/services?select=id&limit=1';
    var response = UrlFetchApp.fetch(testUrl, {
      method: 'get',
      headers: {
        'apikey': config.SUPABASE_KEY,
        'Authorization': 'Bearer ' + config.SUPABASE_KEY,
      },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() === 200) {
      ui.alert(
        'Verificación Exitosa',
        '✓ Configuración correcta.\n✓ Conexión a Supabase exitosa.',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        'Error de Conexión',
        '✓ Configuración encontrada.\n✗ Error: ' + response.getResponseCode() + '\n\n' + response.getContentText(),
        ui.ButtonSet.OK
      );
    }
  } catch (e) {
    ui.alert(
      'Error de Conexión',
      '✓ Configuración encontrada.\n✗ Error: ' + e.message,
      ui.ButtonSet.OK
    );
  }
}
