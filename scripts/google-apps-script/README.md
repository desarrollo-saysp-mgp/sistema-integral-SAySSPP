# Google Apps Script - Sistema de Gestión de Reclamos

Este directorio contiene los scripts de Google Apps Script para sincronizar datos del Sistema de Gestión de Reclamos a Google Sheets.

## Archivos

- **Code.gs** - Script principal con funciones de sincronización
- **Triggers.gs** - Gestión de triggers para sincronización automática

## Instrucciones de Configuración

### 1. Crear Google Sheet

1. Ir a [Google Sheets](https://sheets.google.com)
2. Crear una nueva hoja de cálculo
3. Nombrarla: `Sistema de Reclamos - Backup`

### 2. Abrir Apps Script

1. En el Google Sheet, ir a **Extensiones > Apps Script**
2. Se abrirá el editor de Apps Script

### 3. Agregar el Código

1. Eliminar cualquier código existente en `Code.gs`
2. Copiar todo el contenido de `Code.gs` de este directorio
3. Pegarlo en el editor
4. Crear un nuevo archivo: **Archivo > Nuevo > Script**
5. Nombrarlo `Triggers` (sin extensión)
6. Copiar y pegar el contenido de `Triggers.gs`
7. Guardar el proyecto (Ctrl+S o Cmd+S)

### 4. Configurar Credenciales

1. En el editor de Apps Script, ir a **Configuración del proyecto** (ícono de engranaje)
2. Ir a la sección **Propiedades del script**
3. Agregar las siguientes propiedades:

| Propiedad | Valor | Descripción |
|-----------|-------|-------------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | URL de tu proyecto Supabase |
| `SUPABASE_KEY` | `eyJhbGci...` | Clave anon/pública de Supabase |
| `ADMIN_EMAIL` | `admin@example.com` | Email para notificaciones de error (opcional) |

**Para obtener las credenciales de Supabase:**
1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleccionar tu proyecto
3. Ir a **Settings > API**
4. Copiar `Project URL` y `anon public` key

### 5. Verificar Configuración

1. Volver al Google Sheet
2. Recargar la página (F5)
3. Aparecerá un menú **SGR - Sincronización**
4. Ir a **SGR - Sincronización > Verificar Configuración**
5. Debe mostrar "✓ Configuración correcta"

### 6. Ejecutar Primera Sincronización

1. Ir a **SGR - Sincronización > Sincronizar Todo**
2. La primera vez pedirá autorización - aceptar todos los permisos
3. Verificar que se creen las hojas: `Reclamos`, `Servicios`, `Usuarios`

### 7. Configurar Sincronización Automática

1. Ir a **SGR - Sincronización > Triggers > Configurar Triggers**
2. Confirmar la configuración
3. La sincronización automática quedará activa:
   - **Reclamos**: cada 15 minutos
   - **Servicios**: cada hora
   - **Usuarios**: cada hora

## Estructura de las Hojas

### Reclamos
| Columna | Descripción |
|---------|-------------|
| Número de Reclamo | SASP-R000001 |
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
| Estado | En proceso/Resuelto/No resuelto |
| Derivado | Sí/No |
| Responsable de Carga | Usuario que cargó |
| Fecha de Carga | Timestamp de creación |
| Última Modificación | Timestamp de última actualización |

### Servicios
| Columna | Descripción |
|---------|-------------|
| ID | Identificador |
| Servicio | Nombre del servicio |
| Causas | Lista de causas separadas por coma |

### Usuarios
| Columna | Descripción |
|---------|-------------|
| Nombre y Apellido | Nombre completo |
| Email | Correo electrónico |
| Rol | Admin/Administrativo |
| Fecha de Alta | Fecha de creación |

## Monitoreo

### Ver Estado de Sincronización
1. Ir a **SGR - Sincronización > Ver Estado de Sincronización**
2. O revisar la hoja oculta `_SyncStatus`

### Notificaciones de Error
Si configuraste `ADMIN_EMAIL`, recibirás emails cuando:
- Falle una sincronización
- Haya errores de conexión con Supabase

## Solución de Problemas

### "No se encontró la vista complaint_details"
Ejecutar la migración SQL en Supabase:
```sql
CREATE VIEW complaint_details AS
SELECT ... (ver migración completa)
```

### "Error de autorización"
1. En Apps Script, ir a **Ejecutar > Ejecutar función > syncAll**
2. Seguir el proceso de autorización

### Sincronización no funciona
1. Verificar triggers: **SGR - Sincronización > Triggers > Ver Triggers Activos**
2. Revisar logs: En Apps Script, ir a **Ver > Registros**

## Seguridad

- Las credenciales se almacenan en Script Properties (no en código)
- El Google Sheet debe compartirse solo lectura con usuarios
- Solo el propietario puede editar el script
