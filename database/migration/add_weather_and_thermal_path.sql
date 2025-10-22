-- Migration script to add weather_condition and thermal_image_path columns to inspections table

-- Add weather_condition column
ALTER TABLE inspections 
ADD COLUMN weather_condition VARCHAR(50);

-- Add thermal_image_path column
ALTER TABLE inspections 
ADD COLUMN thermal_image_path VARCHAR(500);

-- Add comments for documentation
COMMENT ON COLUMN inspections.weather_condition IS 'Weather condition during thermal image capture (sunny, cloudy, rainy, windy)';
COMMENT ON COLUMN inspections.thermal_image_path IS 'Relative path to the uploaded thermal image file';
