# Guía de Migración a Producción

Esta guía proporciona instrucciones paso a paso para desplegar el Sistema de Gestión de Reclamos (SGR) en un entorno de producción. La organización destino necesitará sus propias cuentas de GitHub, Vercel, Supabase y Google.

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Paso 1: Fork del Repositorio en GitHub](#paso-1-fork-del-repositorio-en-github)
3. [Paso 2: Configurar Proyecto en Supabase](#paso-2-configurar-proyecto-en-supabase)
4. [Paso 3: Desplegar en Vercel](#paso-3-desplegar-en-vercel)
5. [Paso 4: Crear Usuario Administrador](#paso-4-crear-usuario-administrador)
6. [Paso 5: Configurar Google Sheets (Backup)](#paso-5-configurar-google-sheets-backup)
7. [Lista de Verificación](#lista-de-verificación)
8. [Solución de Problemas](#solución-de-problemas)

---

## Requisitos Previos

Antes de comenzar, asegúrese de tener:

- [ ] Una **cuenta de GitHub** (el plan gratuito es suficiente)
- [ ] Una **cuenta de Vercel** (plan Hobby gratuito o Pro para producción)
- [ ] Una **cuenta de Supabase** (el plan gratuito es suficiente para organizaciones pequeñas)
- [ ] Una **cuenta de Google** (para el backup en Google Sheets)

---

## Paso 1: Fork del Repositorio en GitHub

### 1.1 Hacer Fork del Repositorio

1. Inicie sesión en GitHub
2. Vaya al repositorio original: `https://github.com/torrespablog/gestion_reclamos`
3. Haga clic en el botón **Fork** (esquina superior derecha)
4. Seleccione su organización/cuenta como destino
5. Haga clic en **Create fork**

Su repositorio fork estará en: `https://github.com/SU-USUARIO/gestion_reclamos`

### 1.2 (Opcional) Hacer el Repositorio Privado

Si desea que el repositorio sea privado:

1. Vaya a su repositorio fork
2. Haga clic en **Settings** (pestaña)
3. Desplácese hasta **Danger Zone**
4. Haga clic en **Change visibility** → **Make private**

### 1.3 (Opcional) Clonar Localmente

Si desea hacer modificaciones locales:

```bash
git clone https://github.com/SU-USUARIO/gestion_reclamos.git
cd gestion_reclamos
npm install
```

---

## Paso 2: Configurar Proyecto en Supabase

### 2.1 Crear un Nuevo Proyecto en Supabase

1. Vaya a [supabase.com](https://supabase.com) e inicie sesión
2. Haga clic en **New Project**
3. Complete los campos:
   - **Name:** `gestion-reclamos-prod` (o el nombre que prefiera)
   - **Database Password:** Genere una contraseña segura y **GUÁRDELA**
   - **Region:** Elija la más cercana a sus usuarios
4. Haga clic en **Create new project**
5. Espere a que se complete la configuración (1-2 minutos)

### 2.2 Obtener las Credenciales de la API

1. Vaya a **Settings** → **API**
2. Copie y guarde estos valores (los necesitará más adelante):

| Valor | Dónde Encontrarlo |
|-------|-------------------|
| **Project URL** | Bajo "Project URL" |
| **anon public** key | Bajo "Project API keys" |
| **service_role** key | Bajo "Project API keys" (haga clic en "Reveal") |

**Nota de Seguridad:** Nunca comparta la clave `service_role` públicamente.

### 2.3 Crear el Esquema de Base de Datos

1. Vaya a **SQL Editor** en el Panel de Supabase
2. Haga clic en **New query**
3. Copie y pegue el siguiente SQL (ejecute cada sección por separado):

#### Parte 1: Crear Tablas

```sql
-- =============================================
-- PARTE 1: CREAR TABLAS
-- =============================================

-- Tabla de Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Administrative')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Tabla de Servicios
CREATE TABLE services (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_services_active ON services(active);

-- Tabla de Causas
CREATE TABLE causes (
    id BIGSERIAL PRIMARY KEY,
    service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, name)
);

CREATE INDEX idx_causes_service ON causes(service_id);
CREATE INDEX idx_causes_active ON causes(active);

-- Tabla de Reclamos
CREATE TABLE complaints (
    id BIGSERIAL PRIMARY KEY,
    complaint_number VARCHAR(20) UNIQUE,
    complaint_date DATE NOT NULL DEFAULT CURRENT_DATE,
    complainant_name VARCHAR(100) NOT NULL,
    address VARCHAR(200) NOT NULL,
    street_number VARCHAR(10) NOT NULL,
    dni VARCHAR(20),
    phone_number VARCHAR(20),
    email VARCHAR(100),
    service_id BIGINT NOT NULL REFERENCES services(id),
    cause_id BIGINT NOT NULL REFERENCES causes(id),
    zone VARCHAR(50) NOT NULL,
    since_when DATE NOT NULL,
    contact_method VARCHAR(20) NOT NULL CHECK (contact_method IN ('Presencial', 'Telefono', 'Email', 'WhatsApp')),
    details TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'En proceso' CHECK (status IN ('En proceso', 'Resuelto', 'No resuelto')),
    referred BOOLEAN DEFAULT FALSE,
    loaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_date ON complaints(complaint_date DESC);
CREATE INDEX idx_complaints_service ON complaints(service_id);
CREATE INDEX idx_complaints_loaded_by ON complaints(loaded_by);
CREATE INDEX idx_complaints_number ON complaints(complaint_number);
```

4. Haga clic en **Run** (o Ctrl+Enter)

#### Parte 2: Crear Funciones y Triggers

```sql
-- =============================================
-- PARTE 2: FUNCIONES Y TRIGGERS
-- =============================================

-- Función para actualizar el timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_complaints_updated_at
    BEFORE UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_causes_updated_at
    BEFORE UPDATE ON causes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función helper para verificar si el usuario es Admin (evita recursión RLS)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = user_id
        AND role = 'Admin'
    );
$$;

-- Función para generar número de reclamo automáticamente
-- El número de reclamo es un BIGINT que iguala al ID primario
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE complaints
    SET complaint_number = NEW.id
    WHERE id = NEW.id AND complaint_number IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-generar número de reclamo
CREATE TRIGGER set_complaint_number
    AFTER INSERT ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION generate_complaint_number();
```

5. Haga clic en **Run**

#### Parte 3: Habilitar Row Level Security (RLS)

```sql
-- =============================================
-- PARTE 3: POLÍTICAS DE SEGURIDAD (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE causes ENABLE ROW LEVEL SECURITY;

-- Políticas de la Tabla Users
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert users"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update users"
    ON users FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete users"
    ON users FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- Políticas de la Tabla Complaints
CREATE POLICY "Authenticated users can view complaints"
    ON complaints FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert complaints"
    ON complaints FOR INSERT
    TO authenticated
    WITH CHECK (loaded_by = auth.uid());

CREATE POLICY "Authenticated users can update complaints"
    ON complaints FOR UPDATE
    TO authenticated
    USING (true);

-- Políticas de la Tabla Services
CREATE POLICY "Authenticated users can view services"
    ON services FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage services"
    ON services FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- Políticas de la Tabla Causes
CREATE POLICY "Authenticated users can view causes"
    ON causes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage causes"
    ON causes FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()));
```

6. Haga clic en **Run**

#### Parte 4: Crear Vista para Google Sheets

```sql
-- =============================================
-- PARTE 4: CREAR VISTA PARA REPORTES
-- =============================================

CREATE VIEW complaint_details AS
SELECT
    c.id,
    c.complaint_number,
    c.complaint_date,
    c.complainant_name,
    c.address,
    c.street_number,
    c.dni,
    c.phone_number,
    c.email,
    s.name AS service_name,
    ca.name AS cause_name,
    c.zone,
    c.since_when,
    c.contact_method,
    c.details,
    c.status,
    c.referred,
    u.full_name AS loaded_by_name,
    c.created_at,
    c.updated_at
FROM complaints c
JOIN services s ON c.service_id = s.id
JOIN causes ca ON c.cause_id = ca.id
JOIN users u ON c.loaded_by = u.id;
```

7. Haga clic en **Run**

#### Parte 5: Insertar Datos de Ejemplo (Opcional)

```sql
-- =============================================
-- PARTE 5: DATOS DE EJEMPLO (Opcional)
-- =============================================

-- Insertar servicios de ejemplo
INSERT INTO services (name) VALUES
    ('Alumbrado Público'),
    ('Recolección de Residuos'),
    ('Mantenimiento de Calles'),
    ('Espacios Verdes');

-- Insertar causas de ejemplo
INSERT INTO causes (service_id, name) VALUES
    (1, 'Lámpara fundida'),
    (1, 'Poste dañado'),
    (1, 'Falta de iluminación'),
    (2, 'No se retiran los residuos'),
    (2, 'Basural clandestino'),
    (2, 'Contenedor dañado'),
    (3, 'Bache en la calle'),
    (3, 'Vereda rota'),
    (3, 'Falta señalización'),
    (4, 'Poda de árboles'),
    (4, 'Limpieza de plaza'),
    (4, 'Reparación de juegos');
```

8. Haga clic en **Run**

### 2.4 Verificar la Configuración de Base de Datos

Ejecute esta consulta para verificar que todo esté configurado:

```sql
-- Verificar que todas las tablas existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verificar políticas RLS
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar funciones
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public';
```

Debería ver:
- 4 tablas: `causes`, `complaints`, `services`, `users`
- Múltiples políticas RLS
- Funciones: `is_admin`, `update_updated_at_column`, `generate_complaint_number`

---

## Paso 3: Desplegar en Vercel

### 3.1 Conectar Vercel con su Fork

1. Vaya a [vercel.com](https://vercel.com) e inicie sesión
2. Haga clic en **Add New...** → **Project**
3. Haga clic en **Import Git Repository**
4. Seleccione **GitHub** y autorice Vercel si es necesario
5. Busque su repositorio fork (`gestion_reclamos`)
6. Haga clic en **Import**

### 3.2 Configurar Variables de Entorno

Antes de desplegar, agregue estas variables de entorno:

1. En la configuración del proyecto, expanda **Environment Variables**
2. Agregue las siguientes variables:

| Nombre de Variable | Valor |
|--------------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Su URL del Proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Su clave anon public de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Su clave service_role de Supabase |

**Ejemplo:**
```
NEXT_PUBLIC_SUPABASE_URL = https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Haga clic en **Deploy**
4. Espere a que se complete el despliegue (2-3 minutos)

### 3.3 Obtener su URL de Producción

Después del despliegue, Vercel proporcionará una URL como:
- `https://gestion-reclamos-xxxx.vercel.app`

También puede agregar un dominio personalizado en **Settings** → **Domains**.

### 3.4 Configurar URLs de Redirección en Supabase

1. Regrese al Panel de Supabase
2. Vaya a **Authentication** → **URL Configuration**
3. Agregue su URL de Vercel a:
   - **Site URL:** `https://su-app.vercel.app`
   - **Redirect URLs:** `https://su-app.vercel.app/**`

---

## Paso 4: Crear Usuario Administrador

### 4.1 Crear Usuario de Autenticación en Supabase

1. Vaya al Panel de Supabase → **Authentication** → **Users**
2. Haga clic en **Add user** → **Create new user**
3. Complete:
   - **Email:** Dirección de email del administrador
   - **Password:** Una contraseña temporal
   - **Auto Confirm User:** ✓ Marque esta casilla
4. Haga clic en **Create user**
5. Copie el **User UID** (lo necesitará)

### 4.2 Crear Perfil de Usuario en la Base de Datos

1. Vaya a **SQL Editor**
2. Ejecute esta consulta (reemplace con los valores reales):

```sql
INSERT INTO users (id, full_name, email, role)
VALUES (
    'PEGUE-EL-UID-DEL-USUARIO-AQUÍ',  -- El UID del paso 4.1
    'Nombre del Administrador',
    'admin@ejemplo.com',
    'Admin'
);
```

3. Haga clic en **Run**

### 4.3 Probar el Inicio de Sesión

1. Vaya a la URL de su aplicación en Vercel
2. Inicie sesión con las credenciales del administrador
3. Debería ver el panel de control

### 4.4 Cambiar Contraseña (Recomendado)

Después del primer inicio de sesión, el administrador debería:
1. Ir al Panel de Supabase → **Authentication** → **Users**
2. Hacer clic en el usuario → **Send password recovery**
3. Revisar el email y establecer una nueva contraseña segura

---

## Paso 5: Configurar Google Sheets (Backup)

### 5.1 Crear Google Sheet

1. Vaya a [Google Sheets](https://sheets.google.com)
2. Cree una nueva hoja de cálculo
3. Nómbrela: `Sistema de Reclamos - Backup`

### 5.2 Abrir Apps Script

1. En la hoja de Google, vaya a **Extensiones** → **Apps Script**
2. Esto abre el editor de Apps Script

### 5.3 Agregar el Código

1. Elimine cualquier código existente en `Code.gs`
2. Copie el contenido de `scripts/google-apps-script/Code.gs` de su repositorio
3. Péguelo en el editor
4. Guarde (Ctrl+S)

### 5.4 Configurar Credenciales de Supabase

1. Haga clic en el **ícono de engranaje** (Configuración del Proyecto)
2. Vaya a **Script Properties** (Propiedades del script)
3. Haga clic en **Add script property**
4. Agregue estas propiedades:

| Propiedad | Valor |
|-----------|-------|
| `SUPABASE_URL` | Su URL del Proyecto de Supabase |
| `SUPABASE_KEY` | Su clave anon public de Supabase |

### 5.5 Verificar y Sincronizar

1. Cierre la Configuración del Proyecto
2. Regrese a su Google Sheet
3. Actualice la página (F5)
4. Debería aparecer un nuevo menú **SGR - Backup**
5. Haga clic en **SGR - Backup** → **Verificar Configuración**
6. Debería mostrar "✓ Configuración correcta"
7. Haga clic en **SGR - Backup** → **Sincronizar TODOS los Reclamos**
8. Acepte los permisos de autorización

### 5.6 Habilitar Sincronización Automática Diaria (Opcional)

1. Haga clic en **SGR - Backup** → **Configurar Sync Diario (11 PM)**
2. Confirme la configuración
3. Los reclamos nuevos se sincronizarán automáticamente a las 11 PM diariamente

---

## Lista de Verificación

Después de completar todos los pasos, verifique:

### Base de Datos
- [ ] Las 4 tablas creadas (users, services, causes, complaints)
- [ ] Políticas RLS activas
- [ ] Servicios/causas de ejemplo cargados
- [ ] Usuario administrador creado

### Aplicación
- [ ] Despliegue en Vercel exitoso
- [ ] El inicio de sesión funciona con credenciales de administrador
- [ ] El panel de control carga correctamente
- [ ] Se puede crear un nuevo reclamo
- [ ] Se puede ver la lista de reclamos

### Google Sheets
- [ ] Apps Script configurado
- [ ] Sincronización manual funciona
- [ ] Los datos aparecen en la hoja "Reclamos"

---

## Solución de Problemas

### El inicio de sesión no funciona

1. Verifique que las variables de entorno en Vercel sean correctas
2. Compruebe que la URL Configuration de Supabase tenga las URLs de redirección correctas
3. Asegúrese de que el usuario exista tanto en Auth como en la tabla users

### Error "User profile not found"

El usuario de autenticación existe pero no hay registro correspondiente en la tabla `users`:
1. Vaya a Supabase → Authentication → Users
2. Copie el User UID
3. Ejecute el SQL para insertar en la tabla users (ver Paso 4.2)

### La sincronización de Google Sheets falla

1. Verifique SUPABASE_URL y SUPABASE_KEY en Script Properties
2. Ejecute **Verificar Configuración** para probar la conexión
3. Compruebe que la vista `complaint_details` exista en la base de datos

### Errores de RLS

Si obtiene errores de permisos:
1. Verifique que la función `is_admin` exista
2. Compruebe que todas las políticas RLS fueron creadas
3. Asegúrese de que el usuario tenga el rol correcto en la tabla `users`

### El despliegue falla en Vercel

1. Revise los logs de compilación en el panel de Vercel
2. Asegúrese de que todas las variables de entorno estén configuradas
3. Intente redesplegar: **Deployments** → última → **Redeploy**

---

## Soporte

Para problemas no cubiertos aquí:
- Revise la carpeta `docs/` en el repositorio para documentación detallada
- Revise los logs de Supabase: **Database** → **Logs**
- Revise los logs de funciones de Vercel: pestaña **Logs** en el panel de Vercel
