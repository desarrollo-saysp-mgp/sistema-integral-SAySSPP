-- Simplified migration to fix complaint_number
-- This version handles the case where the column might already be BIGINT

-- Step 1: Drop the view that depends on complaint_number
DROP VIEW IF EXISTS complaint_details;

-- Step 2: Drop existing trigger and function
DROP TRIGGER IF EXISTS set_complaint_number ON complaints;
DROP FUNCTION IF EXISTS generate_complaint_number();

-- Step 3: Drop the unique constraint
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_complaint_number_key;

-- Step 4: Make column nullable (in case it's not already)
ALTER TABLE complaints ALTER COLUMN complaint_number DROP NOT NULL;

-- Step 5: Set all complaint numbers to their ID
-- This works regardless of whether the column is VARCHAR or BIGINT
UPDATE complaints
SET complaint_number = id::text::bigint
WHERE id IS NOT NULL;

-- Step 6: Now change column type to BIGINT if it's not already
DO $$
BEGIN
    ALTER TABLE complaints ALTER COLUMN complaint_number TYPE BIGINT USING complaint_number::BIGINT;
EXCEPTION
    WHEN OTHERS THEN
        -- Column might already be BIGINT, that's OK
        NULL;
END $$;

-- Step 7: Create new simplified function
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Set complaint_number equal to the ID
    UPDATE complaints
    SET complaint_number = NEW.id
    WHERE id = NEW.id AND complaint_number IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger
CREATE TRIGGER set_complaint_number
    AFTER INSERT ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION generate_complaint_number();

-- Step 9: Add unique constraint back
DO $$
BEGIN
    ALTER TABLE complaints ADD CONSTRAINT complaints_complaint_number_key UNIQUE (complaint_number);
EXCEPTION
    WHEN duplicate_object THEN
        -- Constraint might already exist, that's OK
        NULL;
END $$;

-- Step 10: Recreate the complaint_details view
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

-- Step 11: Add comment
COMMENT ON COLUMN complaints.complaint_number IS 'Unique complaint identifier - uses the primary key ID as a simple numeric reference';
