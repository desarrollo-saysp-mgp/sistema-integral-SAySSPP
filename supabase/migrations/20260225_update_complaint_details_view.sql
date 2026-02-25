-- Migration: Update complaint_details view to include phone_number and email
-- Date: 2026-02-25
-- Description: Adds phone_number and email fields to the complaint_details view
--              for Google Sheets sync integration

-- Drop the existing view
DROP VIEW IF EXISTS complaint_details;

-- Recreate with new fields
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

-- Grant access to authenticated users
GRANT SELECT ON complaint_details TO authenticated;
