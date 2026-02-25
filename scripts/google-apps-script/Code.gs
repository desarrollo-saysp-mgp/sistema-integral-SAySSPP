/**
 * Google Apps Script - Complaint Sync for Sistema de Gestion de Reclamos
 *
 * This script syncs complaint data from Supabase to Google Sheets.
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Go to Project Settings (gear icon) > Script Properties
 * 5. Add the following properties:
 *    - SUPABASE_URL: Your Supabase project URL (e.g., https://xxxxx.supabase.co)
 *    - SUPABASE_KEY: Your Supabase anon/public key
 *    - ADMIN_EMAIL: Email address for error notifications
 * 6. Save and run setupTriggers() once to enable automatic sync
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
    ADMIN_EMAIL: scriptProperties.getProperty('ADMIN_EMAIL') || '',
  };
}

// Sheet names
const COMPLAINTS_SHEET = 'Reclamos';
const SERVICES_SHEET = 'Servicios';
const USERS_SHEET = 'Usuarios';
const SYNC_STATUS_SHEET = '_SyncStatus';

// ================================
// MAIN SYNC FUNCTIONS
// ================================

/**
 * Main sync function - runs on schedule (every 15 minutes)
 * Syncs all complaints from Supabase to the Google Sheet
 */
function syncComplaintsToSheet() {
  try {
    Logger.log('Starting complaint sync...');

    const complaints = fetchComplaintsFromSupabase();
    const sheet = getOrCreateSheet(COMPLAINTS_SHEET);

    updateComplaintsSheet(sheet, complaints);
    updateSyncStatus('Reclamos', complaints.length, 'success');

    Logger.log(`Successfully synced ${complaints.length} complaints`);
  } catch (error) {
    Logger.log('Error syncing complaints: ' + error.message);
    updateSyncStatus('Reclamos', 0, 'error', error.message);
    sendErrorNotification(error, 'syncComplaintsToSheet');
  }
}

/**
 * Sync services to sheet (runs every hour)
 */
function syncServicesToSheet() {
  try {
    Logger.log('Starting services sync...');

    const services = fetchServicesFromSupabase();
    const sheet = getOrCreateSheet(SERVICES_SHEET);

    updateServicesSheet(sheet, services);
    updateSyncStatus('Servicios', services.length, 'success');

    Logger.log(`Successfully synced ${services.length} services`);
  } catch (error) {
    Logger.log('Error syncing services: ' + error.message);
    updateSyncStatus('Servicios', 0, 'error', error.message);
    sendErrorNotification(error, 'syncServicesToSheet');
  }
}

/**
 * Sync users to sheet (runs every hour)
 */
function syncUsersToSheet() {
  try {
    Logger.log('Starting users sync...');

    const users = fetchUsersFromSupabase();
    const sheet = getOrCreateSheet(USERS_SHEET);

    updateUsersSheet(sheet, users);
    updateSyncStatus('Usuarios', users.length, 'success');

    Logger.log(`Successfully synced ${users.length} users`);
  } catch (error) {
    Logger.log('Error syncing users: ' + error.message);
    updateSyncStatus('Usuarios', 0, 'error', error.message);
    sendErrorNotification(error, 'syncUsersToSheet');
  }
}

/**
 * Full sync - syncs all data (complaints, services, users)
 */
function syncAll() {
  syncComplaintsToSheet();
  syncServicesToSheet();
  syncUsersToSheet();
}

// ================================
// SUPABASE API FUNCTIONS
// ================================

/**
 * Fetch complaints from Supabase using the complaint_details view
 */
function fetchComplaintsFromSupabase() {
  const config = getConfig();
  const url = `${config.SUPABASE_URL}/rest/v1/complaint_details?select=*&order=id.desc`;

  const options = {
    method: 'get',
    headers: {
      'apikey': config.SUPABASE_KEY,
      'Authorization': `Bearer ${config.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error(`Supabase API error: ${responseCode} - ${response.getContentText()}`);
  }

  return JSON.parse(response.getContentText());
}

/**
 * Fetch services with causes from Supabase
 */
function fetchServicesFromSupabase() {
  const config = getConfig();
  const url = `${config.SUPABASE_URL}/rest/v1/services?select=*,causes(name)&active=eq.true&order=id`;

  const options = {
    method: 'get',
    headers: {
      'apikey': config.SUPABASE_KEY,
      'Authorization': `Bearer ${config.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error(`Supabase API error: ${responseCode} - ${response.getContentText()}`);
  }

  return JSON.parse(response.getContentText());
}

/**
 * Fetch users from Supabase
 */
function fetchUsersFromSupabase() {
  const config = getConfig();
  const url = `${config.SUPABASE_URL}/rest/v1/users?select=full_name,email,role,created_at&active=eq.true&order=full_name`;

  const options = {
    method: 'get',
    headers: {
      'apikey': config.SUPABASE_KEY,
      'Authorization': `Bearer ${config.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error(`Supabase API error: ${responseCode} - ${response.getContentText()}`);
  }

  return JSON.parse(response.getContentText());
}

// ================================
// SHEET UPDATE FUNCTIONS
// ================================

/**
 * Update complaints sheet with data
 */
function updateComplaintsSheet(sheet, complaints) {
  // Clear existing data (except header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clear();
  }

  // Set headers if first run
  if (sheet.getLastRow() === 0) {
    const headers = [
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
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#0E3F75');
    sheet.getRange(1, 1, 1, headers.length).setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // Prepare data rows
  const rows = complaints.map(complaint => [
    complaint.complaint_number,
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
  ]);

  // Write data
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);

    // Auto-resize columns
    for (let i = 1; i <= rows[0].length; i++) {
      sheet.autoResizeColumn(i);
    }

    // Apply alternating row colors
    const dataRange = sheet.getRange(2, 1, rows.length, rows[0].length);
    dataRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);

    // Apply status coloring
    applyStatusColors(sheet, rows.length);
  }
}

/**
 * Apply conditional coloring to status column
 */
function applyStatusColors(sheet, numRows) {
  const statusColumn = 15; // Column O (Estado)

  for (let row = 2; row <= numRows + 1; row++) {
    const cell = sheet.getRange(row, statusColumn);
    const status = cell.getValue();

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

/**
 * Update services sheet
 */
function updateServicesSheet(sheet, services) {
  // Clear and set headers
  sheet.clear();
  const headers = ['ID', 'Servicio', 'Causas'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#0E3F75');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  // Prepare rows
  const rows = services.map(service => [
    service.id,
    service.name,
    service.causes ? service.causes.map(c => c.name).join(', ') : '',
  ]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    sheet.autoResizeColumns(1, headers.length);
  }
}

/**
 * Update users sheet
 */
function updateUsersSheet(sheet, users) {
  // Clear and set headers
  sheet.clear();
  const headers = ['Nombre y Apellido', 'Email', 'Rol', 'Fecha de Alta'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#0E3F75');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  // Prepare rows
  const rows = users.map(user => [
    user.full_name,
    user.email,
    user.role,
    formatDateTime(user.created_at),
  ]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    sheet.autoResizeColumns(1, headers.length);
  }
}

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Get or create a sheet by name
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

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

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format datetime to DD/MM/YYYY HH:MM
 */
function formatDateTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Update sync status tracking sheet
 */
function updateSyncStatus(syncType, recordCount, status, errorMessage) {
  const sheet = getOrCreateSheet(SYNC_STATUS_SHEET);
  const now = new Date();

  // Initialize headers if needed
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 5).setValues([['Tipo', 'Última Sincronización', 'Registros', 'Estado', 'Error']]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }

  // Find or create row for this sync type
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === syncType) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    rowIndex = sheet.getLastRow() + 1;
  }

  // Update row
  sheet.getRange(rowIndex, 1, 1, 5).setValues([[
    syncType,
    formatDateTime(now.toISOString()),
    recordCount,
    status === 'success' ? '✓ OK' : '✗ Error',
    errorMessage || '',
  ]]);

  // Color the status cell
  const statusCell = sheet.getRange(rowIndex, 4);
  if (status === 'success') {
    statusCell.setBackground('#D1FAE5');
    statusCell.setFontColor('#065F46');
  } else {
    statusCell.setBackground('#FEE2E2');
    statusCell.setFontColor('#991B1B');
  }
}

/**
 * Send error notification email
 */
function sendErrorNotification(error, functionName) {
  const config = getConfig();

  if (!config.ADMIN_EMAIL) {
    Logger.log('No admin email configured for error notifications');
    return;
  }

  const subject = `[SGR] Error en sincronización: ${functionName}`;
  const body = `Se produjo un error al sincronizar los datos:

Función: ${functionName}
Fecha/Hora: ${new Date().toLocaleString('es-AR')}
Error: ${error.message}

Stack trace:
${error.stack || 'No disponible'}

---
Sistema de Gestión de Reclamos - Sincronización Automática`;

  try {
    MailApp.sendEmail(config.ADMIN_EMAIL, subject, body);
    Logger.log('Error notification sent to ' + config.ADMIN_EMAIL);
  } catch (emailError) {
    Logger.log('Could not send error notification: ' + emailError.message);
  }
}

// ================================
// CUSTOM MENU
// ================================

/**
 * Create custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('SGR - Sincronización')
    .addItem('Sincronizar Todo', 'syncAll')
    .addSeparator()
    .addItem('Sincronizar Reclamos', 'syncComplaintsToSheet')
    .addItem('Sincronizar Servicios', 'syncServicesToSheet')
    .addItem('Sincronizar Usuarios', 'syncUsersToSheet')
    .addSeparator()
    .addItem('Ver Estado de Sincronización', 'showSyncStatus')
    .addItem('Verificar Configuración', 'verifyConfiguration')
    .addToUi();
}

/**
 * Show sync status dialog
 */
function showSyncStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SYNC_STATUS_SHEET);
  const ui = SpreadsheetApp.getUi();

  if (!sheet || sheet.getLastRow() <= 1) {
    ui.alert('Estado de Sincronización', 'No se han realizado sincronizaciones aún.', ui.ButtonSet.OK);
    return;
  }

  const data = sheet.getDataRange().getValues();
  let message = 'Estado actual de sincronización:\n\n';

  for (let i = 1; i < data.length; i++) {
    message += `${data[i][0]}: ${data[i][3]} (${data[i][2]} registros)\n`;
    message += `  Última sync: ${data[i][1]}\n\n`;
  }

  ui.alert('Estado de Sincronización', message, ui.ButtonSet.OK);
}

/**
 * Verify configuration is set up correctly
 */
function verifyConfiguration() {
  const ui = SpreadsheetApp.getUi();
  const config = getConfig();

  let issues = [];

  if (!config.SUPABASE_URL) {
    issues.push('- SUPABASE_URL no está configurada');
  }

  if (!config.SUPABASE_KEY) {
    issues.push('- SUPABASE_KEY no está configurada');
  }

  if (!config.ADMIN_EMAIL) {
    issues.push('- ADMIN_EMAIL no está configurada (opcional)');
  }

  if (issues.length === 0) {
    // Test connection
    try {
      const testUrl = `${config.SUPABASE_URL}/rest/v1/services?select=id&limit=1`;
      const response = UrlFetchApp.fetch(testUrl, {
        method: 'get',
        headers: {
          'apikey': config.SUPABASE_KEY,
          'Authorization': `Bearer ${config.SUPABASE_KEY}`,
        },
        muteHttpExceptions: true,
      });

      if (response.getResponseCode() === 200) {
        ui.alert('Verificación', '✓ Configuración correcta.\n✓ Conexión a Supabase exitosa.', ui.ButtonSet.OK);
      } else {
        ui.alert('Verificación', `✓ Configuración encontrada.\n✗ Error de conexión: ${response.getResponseCode()}`, ui.ButtonSet.OK);
      }
    } catch (e) {
      ui.alert('Verificación', `✓ Configuración encontrada.\n✗ Error de conexión: ${e.message}`, ui.ButtonSet.OK);
    }
  } else {
    ui.alert('Verificación', 'Problemas encontrados:\n\n' + issues.join('\n') + '\n\nVe a Configuración del Proyecto > Propiedades del script para configurar.', ui.ButtonSet.OK);
  }
}
