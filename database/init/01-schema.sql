-- Initialize database schema
-- This script runs automatically when the PostgreSQL container starts

-- Create the main tables
CREATE TABLE IF NOT EXISTS transformers (
    id BIGSERIAL PRIMARY KEY,
    transformer_no VARCHAR(255) UNIQUE NOT NULL,
    pole_no VARCHAR(255),
    capacity VARCHAR(255),
    region VARCHAR(255),
    type VARCHAR(255),
    location_details TEXT,
    starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploader_name VARCHAR(255),
    baseline_image_path VARCHAR(500),
    baseline_uploaded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspections (
    id BIGSERIAL PRIMARY KEY,
    transformer_id BIGINT NOT NULL REFERENCES transformers(id) ON DELETE CASCADE,
    inspected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(255) NOT NULL DEFAULT 'IN_PROGRESS',
    notes TEXT,
    starred BOOLEAN DEFAULT FALSE,
    maintenance_at TIMESTAMP,
    thermal_uploader_name VARCHAR(255),
    weather_condition VARCHAR(50),
    thermal_image_path VARCHAR(500)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transformers_transformer_no ON transformers(transformer_no);
CREATE INDEX IF NOT EXISTS idx_inspections_transformer_id ON inspections(transformer_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_inspected_at ON inspections(inspected_at);

-- Comments for documentation
COMMENT ON COLUMN inspections.thermal_uploader_name IS 'Name of the user who uploaded the thermal image for this inspection';
COMMENT ON COLUMN inspections.weather_condition IS 'Weather condition during thermal image capture (sunny, cloudy, rainy, windy)';
COMMENT ON COLUMN inspections.thermal_image_path IS 'Relative path to the uploaded thermal image file';
COMMENT ON COLUMN transformers.uploader_name IS 'Name of the user who created this transformer record';
COMMENT ON COLUMN transformers.baseline_image_path IS 'Relative path to the baseline thermal image for this transformer';
COMMENT ON COLUMN transformers.baseline_uploaded_at IS 'Timestamp when the baseline image was uploaded';

-- Note: When thermal images are uploaded, the following automatic updates occur:
-- 1. thermal_uploader_name is set to the current user
-- 2. status is updated to 'COMPLETED' 
-- 3. maintenance_at is set to the upload timestamp
