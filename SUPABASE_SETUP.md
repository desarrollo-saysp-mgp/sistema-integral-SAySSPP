# Supabase Database Setup Instructions

**Status**: ⏳ PENDING - Execute when Supabase dashboard is accessible

This document contains all SQL scripts needed to set up the database. Execute these scripts in the Supabase SQL Editor in the exact order listed below.

---

## Prerequisites

- Supabase project created
- Environment variables configured in `.env.local`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  ```

---

## Execution Order

### Step 1: Create Tables (Execute in Order)

#### 1.1 Services Table
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

#### 1.2 Causes Table
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

#### 1.3 Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Administrative')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

#### 1.4 Complaints Table
```sql
CREATE TABLE complaints (
    id BIGSERIAL PRIMARY KEY,
    complaint_number VARCHAR(20) UNIQUE NOT NULL,
    complaint_date DATE NOT NULL DEFAULT CURRENT_DATE,
    complainant_name VARCHAR(100) NOT NULL,
    address VARCHAR(200) NOT NULL,
    street_number VARCHAR(10) NOT NULL,
    dni VARCHAR(20),
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

---

### Step 2: Create Functions and Triggers

#### 2.1 Update Timestamp Function
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

#### 2.2 Auto-Generate Complaint Number
```sql
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.complaint_number := 'SASP-R' || LPAD(NEW.id::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_complaint_number
    AFTER INSERT ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION generate_complaint_number();
```

---

### Step 3: Enable Row Level Security (RLS)

#### 3.1 Users Table RLS
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'Admin'
        )
    );

CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admins can insert users"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'Admin'
        )
    );

CREATE POLICY "Admins can update users"
    ON users FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'Admin'
        )
    );
```

#### 3.2 Complaints Table RLS
```sql
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

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
```

#### 3.3 Services and Causes RLS
```sql
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE causes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view services"
    ON services FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage services"
    ON services FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'Admin'
        )
    );

CREATE POLICY "Authenticated users can view causes"
    ON causes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage causes"
    ON causes FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'Admin'
        )
    );
```

---

### Step 4: Insert Sample Data

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

---

### Step 5: Create Database View

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

---

### Step 6: Verify Setup

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check sample data
SELECT * FROM services;
SELECT * FROM causes;
```

---

## Creating Admin User

### Method 1: Via Supabase Dashboard (Recommended)

1. Go to **Authentication** → **Users** → **Add user**
2. Create user with:
   - Email: `admin@example.com`
   - Password: (secure password)
   - Auto Confirm User: ✅ **CHECKED**
3. Copy the User UID
4. Run this SQL:
   ```sql
   INSERT INTO users (id, full_name, email, role)
   VALUES (
       'PASTE_USER_UID_HERE',
       'Administrator',
       'admin@example.com',
       'Admin'
   );
   ```

---

## Verification Checklist

After executing all scripts:

- [ ] 4 tables created: `users`, `complaints`, `services`, `causes`
- [ ] All indexes created (11 total)
- [ ] 2 functions created: `update_updated_at_column`, `generate_complaint_number`
- [ ] 8 triggers created (4 for updated_at, 1 for complaint number)
- [ ] RLS enabled on all 4 tables
- [ ] 9 RLS policies created
- [ ] Sample data inserted: 4 services, 12 causes
- [ ] `complaint_details` view created
- [ ] Admin user created and linked to Auth

---

## Troubleshooting

### "Permission denied" errors
- Ensure you're using the SQL Editor as the project owner
- Check that your Supabase project is active (not paused)

### Foreign key constraint errors
- Execute scripts in the exact order listed
- Services and Users must exist before Complaints

### RLS blocking queries
- Verify admin user exists in both Auth and users table
- Check UUIDs match between Auth and users table
- Test with RLS temporarily disabled if needed

---

## Next Steps After Setup

1. Test login at `/login` with admin credentials
2. Verify user profile loads correctly
3. Begin Phase 2: User Management UI
4. Create dashboard pages with real data

---

**Last Updated**: 2025-11-19
**Status**: Ready to execute when Supabase is accessible
