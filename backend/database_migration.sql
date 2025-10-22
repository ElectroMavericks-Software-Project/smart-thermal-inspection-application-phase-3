-- Add thermal_uploader_name column to inspections table
-- Run this SQL script to add the new column to your existing database

ALTER TABLE inspections 
ADD COLUMN thermal_uploader_name VARCHAR(255);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN inspections.thermal_uploader_name IS 'Name of the user who uploaded the thermal image for this inspection';

-- Note: When thermal images are uploaded, the following automatic updates occur:
-- 1. thermal_uploader_name is set to the current user
-- 2. status is updated to 'COMPLETED' 
-- 3. maintenance_at is set to the upload timestamp
