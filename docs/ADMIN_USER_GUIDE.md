# Guía de Usuario para Administradores

Esta guía explica cómo realizar tareas administrativas en el Sistema de Gestión de Reclamos.

## Tabla de Contenidos

- [Crear Nuevos Usuarios](#crear-nuevos-usuarios)
- [Gestionar Usuarios Existentes](#gestionar-usuarios-existentes)
- [Configurar Servicios y Causas](#configurar-servicios-y-causas)

---

## Crear Nuevos Usuarios

Como administrador, puedes crear cuentas para nuevos usuarios del sistema.

### Paso 1: Acceder a la Gestión de Usuarios

1. Inicia sesión con tu cuenta de **Admin**
2. Ve al menú de navegación
3. Haz clic en **"Administración"** → **"Usuarios"**
4. Serás redirigido a `/admin/users`

### Paso 2: Crear el Nuevo Usuario

1. Haz clic en el botón **"Crear Usuario"** (o "+ Nuevo Usuario")
2. Se abrirá un formulario con los siguientes campos:

   **Campos del Formulario:**
   - **Nombre completo**: Nombre y apellido del usuario (ej: "María González")
   - **Email**: Correo electrónico del usuario (ej: "maria@municipalidad.gob.ar")
   - **Rol**: Selecciona el nivel de acceso:
     - **Admin**: Acceso completo (puede crear usuarios, configurar servicios, gestionar reclamos)
     - **Administrative**: Acceso estándar (puede crear y gestionar reclamos, ver servicios)

3. **Importante**: NO necesitas crear una contraseña. El usuario la creará por su cuenta.

4. Haz clic en **"Crear"**

### Paso 3: Confirmación

Después de crear el usuario:

1. ✅ Verás un mensaje de éxito
2. 📧 El sistema enviará automáticamente un **correo de invitación** al email proporcionado
3. 👤 El nuevo usuario aparecerá en la lista de usuarios

### Paso 4: Informar al Usuario

El nuevo usuario recibirá un correo con:
- **Asunto**: "Invitación al Sistema de Gestión de Reclamos"
- **Contenido**:
  - Mensaje de bienvenida
  - Enlace para configurar su contraseña
  - El enlace expira en **24 horas**

**Instrucciones para el nuevo usuario:**

1. Revisar su correo electrónico (incluyendo spam)
2. Hacer clic en el botón **"Configurar mi contraseña"**
3. Crear una contraseña segura (mínimo 6 caracteres)
4. Confirmar la contraseña
5. Hacer clic en **"Establecer contraseña"**
6. Será redirigido automáticamente al sistema

Después de esto, el usuario podrá iniciar sesión en `/login` con:
- Email: El que proporcionaste
- Contraseña: La que acaba de crear

---

## Gestionar Usuarios Existentes

### Ver Lista de Usuarios

En `/admin/users` puedes:
- 🔍 **Buscar usuarios** por nombre o email
- 🎯 **Filtrar por rol** (Admin / Administrative)
- 👁️ **Ver todos los usuarios** del sistema

### Editar un Usuario

1. En la lista de usuarios, localiza al usuario que deseas modificar
2. Haz clic en el botón **"Editar"** (icono de lápiz ✏️)
3. Modifica los campos que necesites:
   - Nombre completo
   - Rol
   - **Nota**: El email NO se puede modificar por seguridad
4. Haz clic en **"Guardar Cambios"**

### Eliminar un Usuario

1. En la lista de usuarios, localiza al usuario que deseas eliminar
2. Haz clic en el botón **"Eliminar"** (icono de papelera 🗑️)
3. Confirma la eliminación en el diálogo que aparece
4. El usuario será eliminado permanentemente

**⚠️ Advertencia**: Esta acción NO se puede deshacer. Los reclamos creados por este usuario NO serán eliminados.

---

## Configurar Servicios y Causas

Como administrador, puedes gestionar los servicios y causas que se usan para categorizar los reclamos.

### Acceder a Gestión de Servicios

1. Ve al menú **"Administración"** → **"Servicios"**
2. Serás redirigido a `/admin/services`

### Agregar un Nuevo Servicio

1. Haz clic en **"+ Nuevo Servicio"**
2. Ingresa el nombre del servicio (ej: "Alumbrado Público", "Recolección de Residuos")
3. Haz clic en **"Guardar"**
4. El servicio aparecerá en la lista

### Agregar Causas a un Servicio

1. En la lista de servicios, haz clic en el servicio al que quieres agregar causas
2. En el panel derecho, verás las causas existentes para ese servicio
3. Haz clic en **"+ Nueva Causa"**
4. Ingresa el nombre de la causa (ej: "Lámpara fundida", "Poste dañado")
5. Haz clic en **"Guardar"**

### Editar Servicios o Causas

1. Haz clic en el botón **"Editar"** (✏️) junto al servicio o causa
2. Modifica el nombre
3. Haz clic en **"Guardar"**

### Eliminar Servicios o Causas

1. Haz clic en el botón **"Eliminar"** (🗑️) junto al servicio o causa
2. Confirma la eliminación

**⚠️ Advertencia**:
- No puedes eliminar un servicio que tiene causas asociadas
- No puedes eliminar una causa que está siendo usada en reclamos existentes

---

## Diferencias entre Roles

### Rol: Admin

✅ **Puede hacer todo:**
- Crear, editar y eliminar usuarios
- Configurar servicios y causas
- Crear, editar y eliminar reclamos
- Ver estadísticas y reportes
- Acceder a todas las funciones del sistema

### Rol: Administrative

✅ **Puede:**
- Crear y editar reclamos
- Ver lista de reclamos
- Cambiar estado de reclamos
- Ver estadísticas y reportes
- Ver servicios y causas disponibles

❌ **No puede:**
- Crear o gestionar usuarios
- Configurar servicios y causas
- Eliminar reclamos
- Acceder al panel de administración

---

## Solución de Problemas Comunes

### El usuario no recibió el correo de invitación

**Soluciones:**

1. **Revisar la carpeta de spam** del correo del usuario
2. **Verificar el email**: Asegúrate de que el email está escrito correctamente
3. **Reenviar invitación**:
   - Elimina el usuario que creaste
   - Crea el usuario nuevamente
   - Se enviará un nuevo correo

### El enlace de invitación expiró

**Solución:**

1. El enlace expira en 24 horas
2. El usuario puede usar la opción **"¿Olvidaste tu contraseña?"** en la página de login
3. O puedes eliminar y recrear el usuario para enviar una nueva invitación

### No puedo crear un usuario con un email que ya existe

**Causa**: El email ya está registrado en el sistema

**Solución:**

1. Busca el usuario existente en la lista
2. Si es el mismo usuario, simplemente reenvía las credenciales
3. Si es un usuario diferente, usa otro email

### El nuevo usuario no puede acceder al sistema

**Verificar:**

1. ✅ ¿El usuario completó el proceso de establecer contraseña desde el correo?
2. ✅ ¿Está usando el email correcto para iniciar sesión?
3. ✅ ¿La contraseña tiene al menos 6 caracteres?
4. ✅ ¿El usuario existe en la lista de usuarios de `/admin/users`?

---

## Mejores Prácticas

### Al Crear Usuarios

1. ✅ **Usa emails institucionales** cuando sea posible
2. ✅ **Verifica el email** antes de enviar (evita errores tipográficos)
3. ✅ **Asigna el rol correcto** según las responsabilidades del usuario
4. ✅ **Informa al usuario** que recibirá un correo (revise spam)
5. ✅ **Usa nombres completos reales** (no apodos o abreviaturas)

### Gestión de Roles

1. 🔒 **Limita los usuarios Admin** solo a personas de confianza
2. 👥 **Usa el rol Administrative** para la mayoría de usuarios
3. 🔄 **Revisa periódicamente** los usuarios activos
4. 🗑️ **Elimina usuarios** que ya no trabajan en la municipalidad

### Seguridad

1. 🔐 **No compartas tu contraseña de Admin** con nadie
2. 🚪 **Cierra sesión** cuando no uses el sistema
3. 📧 **No reenvíes** los correos de invitación de otros usuarios
4. ⚠️ **Reporta** cualquier actividad sospechosa

---

## Contacto y Soporte

Si tienes problemas técnicos o preguntas:

1. 📖 Consulta esta guía y la documentación en `/docs`
2. 🐛 Reporta problemas en: https://github.com/torrespablog/gestion_reclamos/issues
3. 💬 Contacta al administrador del sistema

---

**Última actualización**: Diciembre 2025
