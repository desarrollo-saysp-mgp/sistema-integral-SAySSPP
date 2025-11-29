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
