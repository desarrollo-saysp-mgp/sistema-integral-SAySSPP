/**
 * Google Apps Script - Trigger Management
 *
 * This file handles the setup and management of time-based triggers
 * for automatic synchronization.
 */

// ================================
// TRIGGER SETUP
// ================================

/**
 * Set up time-based triggers for automatic sync
 * Run this function ONCE manually after initial setup
 */
function setupTriggers() {
  const ui = SpreadsheetApp.getUi();

  // Ask for confirmation
  const response = ui.alert(
    'Configurar Triggers',
    'Esto configurará la sincronización automática:\n\n' +
    '- Reclamos: cada 15 minutos\n' +
    '- Servicios: cada hora\n' +
    '- Usuarios: cada hora\n\n' +
    '¿Desea continuar?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('Configuración cancelada.');
    return;
  }

  try {
    // Delete existing triggers first
    removeTriggers();

    // Sync complaints every 15 minutes
    ScriptApp.newTrigger('syncComplaintsToSheet')
      .timeBased()
      .everyMinutes(15)
      .create();

    // Sync services every hour
    ScriptApp.newTrigger('syncServicesToSheet')
      .timeBased()
      .everyHours(1)
      .create();

    // Sync users every hour
    ScriptApp.newTrigger('syncUsersToSheet')
      .timeBased()
      .everyHours(1)
      .create();

    Logger.log('Triggers created successfully');
    ui.alert(
      'Triggers Configurados',
      '✓ Triggers creados exitosamente.\n\n' +
      'La sincronización automática está activa:\n' +
      '- Reclamos: cada 15 minutos\n' +
      '- Servicios: cada hora\n' +
      '- Usuarios: cada hora',
      ui.ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error setting up triggers: ' + error.message);
    ui.alert('Error', 'No se pudieron configurar los triggers: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * Remove all existing triggers
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });

  Logger.log(`Removed ${triggers.length} existing triggers`);
}

/**
 * Remove triggers with confirmation dialog
 */
function removeTriggersWithConfirmation() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    'Eliminar Triggers',
    '¿Está seguro de que desea eliminar todos los triggers de sincronización automática?',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    removeTriggers();
    ui.alert('Triggers eliminados', 'Se han eliminado todos los triggers de sincronización.', ui.ButtonSet.OK);
  }
}

/**
 * List current triggers
 */
function listTriggers() {
  const ui = SpreadsheetApp.getUi();
  const triggers = ScriptApp.getProjectTriggers();

  if (triggers.length === 0) {
    ui.alert('Triggers Activos', 'No hay triggers configurados.', ui.ButtonSet.OK);
    return;
  }

  let message = 'Triggers activos:\n\n';

  triggers.forEach(trigger => {
    const handlerFunction = trigger.getHandlerFunction();
    const triggerSource = trigger.getTriggerSource();
    message += `- ${handlerFunction}\n`;
  });

  ui.alert('Triggers Activos', message, ui.ButtonSet.OK);
}

// ================================
// ADMIN MENU (Extended)
// ================================

/**
 * Extended menu with trigger management
 * This replaces the simpler onOpen() in Code.gs if you want more options
 */
function onOpenExtended() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('SGR - Sincronización')
    .addItem('Sincronizar Todo', 'syncAll')
    .addSeparator()
    .addItem('Sincronizar Reclamos', 'syncComplaintsToSheet')
    .addItem('Sincronizar Servicios', 'syncServicesToSheet')
    .addItem('Sincronizar Usuarios', 'syncUsersToSheet')
    .addSeparator()
    .addSubMenu(ui.createMenu('Triggers')
      .addItem('Configurar Triggers', 'setupTriggers')
      .addItem('Ver Triggers Activos', 'listTriggers')
      .addItem('Eliminar Triggers', 'removeTriggersWithConfirmation'))
    .addSeparator()
    .addItem('Ver Estado', 'showSyncStatus')
    .addItem('Verificar Configuración', 'verifyConfiguration')
    .addToUi();
}
