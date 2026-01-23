-- Migration: Add phone_number and email fields to complaints table
-- This migration is idempotent and can be run multiple times safely
-- Date: 2026-01-22

-- Step 1: Drop dependent view to allow table alteration
DROP VIEW IF EXISTS complaint_details CASCADE;

-- Step 2: Add phone_number column (optional, 20 chars max for formatting)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'complaints' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE complaints ADD COLUMN phone_number VARCHAR(20);
    END IF;
END $$;

-- Step 3: Add email column (optional, 100 chars max)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'complaints' AND column_name = 'email'
    ) THEN
        ALTER TABLE complaints ADD COLUMN email VARCHAR(100);
    END IF;
END $$;

-- Step 4: Recreate complaint_details view with new fields
CREATE VIEW complaint_details AS
SELECT
    c.id,
    c.complaint_number,
    c.complaint_date,
    c.complainant_name,
    c.address,
    c.street_number,
    c.dni,
    c.phone_number,          -- NEW FIELD
    c.email,                 -- NEW FIELD
    s.name AS service_name,
    ca.name AS cause_name,
    c.zone,
    c.since_when,            -- Remains as DATE
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

-- Step 5: Add helpful comments
COMMENT ON COLUMN complaints.phone_number IS 'Optional phone number (Argentine format: 10 digits)';
COMMENT ON COLUMN complaints.email IS 'Optional email address for contact';

-- Migration complete
