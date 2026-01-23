# Database Design

## Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ COMPLAINTS : creates
    SERVICES ||--o{ CAUSES : has
    SERVICES ||--o{ COMPLAINTS : categorizes
    CAUSES ||--o{ COMPLAINTS : specifies

    USERS {
        uuid id PK
        varchar(100) full_name
        varchar(50) email UK
        varchar(20) role
        timestamp created_at
        timestamp updated_at
    }

    COMPLAINTS {
        bigserial id PK
        varchar(20) complaint_number UK
        date complaint_date
        varchar(100) complainant_name
        varchar(200) address
        varchar(10) street_number
        varchar(20) dni
        bigint service_id FK
        bigint cause_id FK
        varchar(50) zone
        date since_when
        varchar(20) contact_method
        text details
        varchar(20) status
        boolean referred
        uuid loaded_by FK
        timestamp created_at
        timestamp updated_at
    }

    SERVICES {
        bigserial id PK
        varchar(100) name UK
        boolean active
        timestamp created_at
        timestamp updated_at
    }

    CAUSES {
        bigserial id PK
        bigint service_id FK
        varchar(150) name
        boolean active
        timestamp created_at
        timestamp updated_at
    }
```

## Table Specifications

### Users Table

Stores system users with role-based access control.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Administrative')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster email lookups during authentication
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### Complaints Table

Main table for storing all complaint records.

```sql
CREATE TABLE complaints (
    id BIGSERIAL PRIMARY KEY,
    complaint_number VARCHAR(20) UNIQUE NOT NULL,
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

-- Indexes for common queries
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_date ON complaints(complaint_date DESC);
CREATE INDEX idx_complaints_service ON complaints(service_id);
CREATE INDEX idx_complaints_loaded_by ON complaints(loaded_by);
CREATE INDEX idx_complaints_number ON complaints(complaint_number);
```

### Services Table

Stores service categories for complaints.

```sql
CREATE TABLE services (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_services_active ON services(active);
```

### Causes Table

Stores causes associated with each service.

```sql
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
```

## Functions and Triggers

### Auto-generate Complaint Number

```sql
-- Function to generate complaint number
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.complaint_number := 'SASP-R' || LPAD(NEW.id::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate complaint number after insert
CREATE TRIGGER set_complaint_number
    AFTER INSERT ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION generate_complaint_number();
```

### Update Timestamp Trigger

```sql
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
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
```

## Row Level Security (RLS) Policies

### Helper Functions

Before creating RLS policies, we need a helper function to check user roles without causing infinite recursion:

```sql
-- Helper function to check if a user is an Admin
-- Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion
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
```

### Users Table Policies

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Admins can see all users
CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Only admins can insert users
CREATE POLICY "Admins can insert users"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can update users
CREATE POLICY "Admins can update users"
    ON users FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- Only admins can delete users
CREATE POLICY "Admins can delete users"
    ON users FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));
```

### Complaints Table Policies

```sql
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view complaints
CREATE POLICY "Authenticated users can view complaints"
    ON complaints FOR SELECT
    TO authenticated
    USING (true);

-- All authenticated users can insert complaints
CREATE POLICY "Authenticated users can insert complaints"
    ON complaints FOR INSERT
    TO authenticated
    WITH CHECK (loaded_by = auth.uid());

-- All authenticated users can update complaints
CREATE POLICY "Authenticated users can update complaints"
    ON complaints FOR UPDATE
    TO authenticated
    USING (true);
```

### Services and Causes Policies

```sql
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE causes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view services
CREATE POLICY "Authenticated users can view services"
    ON services FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can modify services
CREATE POLICY "Admins can manage services"
    ON services FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- All authenticated users can view causes
CREATE POLICY "Authenticated users can view causes"
    ON causes FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can modify causes
CREATE POLICY "Admins can manage causes"
    ON causes FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()));
```

## Sample Data

### Insert Sample Admin User

```sql
INSERT INTO users (full_name, email, role)
VALUES ('Administrator', 'admin@example.com', 'Admin');
```

### Insert Sample Services and Causes

```sql
-- Insert services
INSERT INTO services (name) VALUES
    ('Alumbrado Público'),
    ('Recolección de Residuos'),
    ('Mantenimiento de Calles'),
    ('Espacios Verdes');

-- Insert causes for each service
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

## Database Views

### Complaint Details View

Combines complaint information with related data for easier querying:

```sql
CREATE VIEW complaint_details AS
SELECT
    c.id,
    c.complaint_number,
    c.complaint_date,
    c.complainant_name,
    c.address,
    c.street_number,
    c.dni,
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

## Backup Strategy

### Google Sheets Sync

The system maintains a real-time backup to Google Sheets using:

- Supabase Database Webhooks or
- Scheduled Google Apps Script that queries the database API
- Sync frequency: Every 15 minutes or on complaint creation/update

### Fields to Sync

All complaint fields plus:

- Service name (instead of ID)
- Cause name (instead of ID)
- Loaded by name (instead of user ID)

## Exporting Schema for Production Deployment

This section explains how to export your complete database schema (including tables, functions, RLS policies, indexes, and triggers) from your testing/development Supabase instance to deploy to your production environment.

### Method 1: Using Supabase CLI (Recommended)

The Supabase CLI provides the most complete and reliable export.

#### Prerequisites

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Get your database connection string:**
   - Go to Supabase Dashboard → Project Settings → Database
   - Copy the **Connection String** (URI format)
   - It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

#### Export Complete Schema

Run this command to export your entire schema including RLS policies:

```bash
# Export schema to a file
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f schema.sql

# Or export only specific schemas (public schema contains your tables)
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" --schema public -f public_schema.sql
```

**What gets exported:**
- ✅ All table definitions
- ✅ All indexes
- ✅ All foreign keys and constraints
- ✅ All functions (including `is_admin()` helper)
- ✅ All RLS policies
- ✅ All triggers
- ✅ Column defaults and data types

#### Export Data (Optional)

If you also want to export sample data:

```bash
# Export data only (no schema)
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" --data-only -f data.sql

# Export specific tables with data
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" --data-only --table public.services --table public.causes -f sample_data.sql
```

### Method 2: Using Supabase Dashboard

For quick manual exports of individual components:

#### Export Table Schema

1. Go to **Table Editor** in Supabase Dashboard
2. Select a table
3. Click the **⋮** (three dots) menu
4. Select **View SQL Definition**
5. Copy the SQL and save to a file

**Note:** This only exports the table definition, not RLS policies or functions.

#### Export RLS Policies

1. Go to **Authentication** → **Policies**
2. Click on a table to see its policies
3. Click **View SQL** on each policy
4. Copy and save to your schema file

**Note:** Manual method - you'll need to do this for each table.

#### Export Functions

1. Go to **Database** → **Functions**
2. Click on a function (e.g., `is_admin`)
3. View the function definition
4. Copy to your schema file

### Method 3: Using pg_dump Directly

If you have PostgreSQL tools installed:

```bash
# Full schema export
pg_dump -h db.[PROJECT-REF].supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  --no-owner \
  --no-privileges \
  -f complete_schema.sql

# With RLS policies (PostgreSQL 10+)
pg_dump -h db.[PROJECT-REF].supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  --no-owner \
  --no-privileges \
  --enable-row-security \
  -f schema_with_rls.sql
```

### Deploying to Production Environment

Once you have your `schema.sql` file exported:

#### Option A: Using Supabase Dashboard (Manual)

1. Go to your **production Supabase project**
2. Navigate to **SQL Editor**
3. Create a new query
4. Paste the contents of `schema.sql`
5. Click **Run** (or Cmd/Ctrl + Enter)
6. Verify all tables, functions, and policies were created

#### Option B: Using Supabase CLI

```bash
# Apply schema to production database
supabase db push --db-url "postgresql://postgres:[PROD-PASSWORD]@db.[PROD-PROJECT-REF].supabase.co:5432/postgres" --file schema.sql
```

#### Option C: Using psql

```bash
# Import schema using psql
psql -h db.[PROD-PROJECT-REF].supabase.co \
  -U postgres \
  -d postgres \
  -f schema.sql
```

### Verification Checklist

After importing to production, verify:

- [ ] **Tables created:** Check all 4 tables exist (users, complaints, services, causes)
- [ ] **Indexes created:** Verify indexes on email, role, complaint_number, etc.
- [ ] **Foreign keys:** Verify relationships between tables
- [ ] **Functions created:** Verify `is_admin()` function exists
- [ ] **RLS enabled:** Verify `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` was applied
- [ ] **RLS policies:** Verify all policies exist:
  - Users: SELECT (2), INSERT (1), UPDATE (1), DELETE (1) = 5 policies
  - Complaints: SELECT (1), INSERT (1), UPDATE (1) = 3 policies
  - Services: SELECT (1), ALL (1) = 2 policies
  - Causes: SELECT (1), ALL (1) = 2 policies
- [ ] **Sample data** (optional): If you exported data, verify it was imported

### Quick Verification Queries

Run these in your production SQL Editor to verify everything:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check all RLS policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Verify is_admin function exists
SELECT public.is_admin(auth.uid());

-- Check row counts (if you imported data)
SELECT
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM services) as services_count,
  (SELECT COUNT(*) FROM causes) as causes_count,
  (SELECT COUNT(*) FROM complaints) as complaints_count;
```

### Important Notes

1. **Connection Strings:** Never commit database passwords to version control
2. **Service Role Key:** Update your production `.env` with the production Supabase keys
3. **Auth Users:** `auth.users` table is managed by Supabase Auth - you don't export/import this directly
4. **RLS Policies:** Always verify RLS policies were created - security depends on them
5. **Testing:** Test authentication and permissions in production with a test admin user
6. **Rollback Plan:** Keep your schema export file for rollback if needed

### Troubleshooting

**Error: "permission denied"**
- Make sure you're using the correct database password
- Verify your user has sufficient privileges

**Error: "relation already exists"**
- Production database may have leftover tables
- Drop existing tables first, or use `DROP TABLE IF EXISTS` in your schema

**RLS policies not working:**
- Verify `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` was executed
- Check that `is_admin()` function exists and works
- Test with: `SELECT public.is_admin(auth.uid());`

**Functions causing errors:**
- Make sure to create helper functions BEFORE creating policies that use them
- The `is_admin()` function must be created before user table policies
