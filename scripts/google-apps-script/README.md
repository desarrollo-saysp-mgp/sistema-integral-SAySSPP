# Google Apps Script - Backup de Reclamos

Script para sincronizar reclamos desde Supabase a Google Sheets.

## Configuración Paso a Paso

### 1. Crear Google Sheet

1. Ir a [Google Sheets](https://sheets.google.com)
2. Crear una nueva hoja de cálculo
3. Nombrarla: `Sistema de Reclamos - Backup`

### 2. Abrir Apps Script

1. En el Google Sheet, ir a **Extensiones > Apps Script**
2. Se abrirá el editor de Apps Script

### 3. Agregar el Código

1. Eliminar cualquier código existente en `Code.gs`
2. Copiar todo el contenido del archivo `Code.gs` de este directorio
3. Pegarlo en el editor
4. Guardar el proyecto (Ctrl+S o Cmd+S)

### 4. Configurar Credenciales de Supabase

1. En el editor de Apps Script, hacer click en el **ícono de engranaje** (Configuración del proyecto)
2. Ir a la sección **Propiedades del script**
3. Hacer click en **Agregar propiedad de script**
4. Agregar las siguientes propiedades:

| Propiedad | Valor |
|-----------|-------|
| `SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
| `SUPABASE_KEY` | Tu clave anon/pública de Supabase |

**Para obtener las credenciales:**
1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleccionar tu proyecto
3. Ir a **Settings > API**
4. Copiar `Project URL` y `anon public` key

### 5. Verificar Configuración

1. Volver al Google Sheet
2. **Recargar la página** (F5)
3. Aparecerá un menú **SGR - Backup**
4. Ir a **SGR - Backup > Verificar Configuración**
5. Debe mostrar "✓ Configuración correcta"

### 6. Primera Sincronización

1. Ir a **SGR - Backup > Sincronizar TODOS los Reclamos**
2. La primera vez pedirá autorización - aceptar todos los permisos
3. Verificar que se cree la hoja `Reclamos` con los datos

### 7. Sincronización Automática (Opcional)

1. Ir a **SGR - Backup > Configurar Sync Diario (11 PM)**
2. Confirmar la configuración
3. Los reclamos NUEVOS se sincronizarán automáticamente todos los días a las 11 PM

Para desactivar: **SGR - Backup > Desactivar Sync Automático**

## Opciones del Menú

| Opción | Descripción |
|--------|-------------|
| **Sincronizar TODOS los Reclamos** | Borra y reescribe todos los reclamos (usar para setup inicial) |
| **Sincronizar Reclamos de HOY** | Solo agrega reclamos creados hoy (desde las 3 AM) |
| **Configurar Sync Diario (11 PM)** | Activa sincronización automática diaria a las 11 PM |
| **Desactivar Sync Automático** | Elimina el trigger de sincronización |
| **Verificar Configuración** | Prueba la conexión a Supabase |

## Cómo Funciona la Sincronización Diaria

1. El trigger se ejecuta todos los días a las 11 PM
2. Consulta Supabase por reclamos creados **hoy** (desde las 3 AM)
3. Verifica cuáles ya están en la hoja
4. Solo agrega los reclamos nuevos (evita duplicados)

## Estructura de la Hoja "Reclamos"

| Columna | Descripción |
|---------|-------------|
| Número de Reclamo | ID numérico (ej: 123) |
| Fecha de Reclamo | DD/MM/YYYY |
| Nombre y Apellido | Nombre del reclamante |
| Dirección | Calle |
| Número | Número de calle |
| DNI | Documento |
| Teléfono | Número de teléfono (si aplica) |
| Email | Correo electrónico (si aplica) |
| Servicio | Nombre del servicio |
| Causa | Causa del reclamo |
| Zona | Zona/barrio |
| Desde Cuándo | Fecha del problema |
| Medio de Contacto | Presencial/Teléfono/Email/WhatsApp |
| Detalle | Descripción completa |
| Estado | En proceso/Resuelto/No resuelto (con colores) |
| Derivado | Sí/No |
| Responsable de Carga | Usuario que cargó |
| Fecha de Carga | Timestamp de creación |
| Última Modificación | Timestamp de última actualización |

## Solución de Problemas

### "No se encontró la vista complaint_details"

La vista `complaint_details` debe existir en Supabase. Verificar en el SQL Editor.

### "Error de autorización"

1. En Apps Script, ir a **Ejecutar > Ejecutar función > syncComplaintsToSheet**
2. Seguir el proceso de autorización

### No aparece el menú "SGR - Backup"

1. Recargar la página del Google Sheet (F5)
2. Si no aparece, ir a Apps Script y ejecutar `onOpen` manualmente

## Seguridad

- Las credenciales se almacenan en Script Properties (no en código)
- El Google Sheet debe compartirse solo lectura con otros usuarios
- Solo el propietario puede editar el script
