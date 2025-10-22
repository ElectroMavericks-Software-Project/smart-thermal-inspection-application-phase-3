-- Insert test data for development and demonstration
-- This data will be available when the supervisor runs the application

-- Insert test transformers with baseline images (using existing files from media/baseline)
INSERT INTO transformers (transformer_no, pole_no, capacity, region, type, location_details, starred, uploader_name, baseline_image_path, baseline_uploaded_at) VALUES
('AZ-1649', 'P001', '500 KVA', 'Central', 'Distribution', 'Main Street Junction', true, 'admin', 'baseline/AZ-1123.jpg', CURRENT_TIMESTAMP - INTERVAL '120 days'),
('AZ-2750', 'P002', '750 KVA', 'North', 'Distribution', 'Industrial Area Block A', false, 'admin', 'baseline/AZ-3333.jpg', CURRENT_TIMESTAMP - INTERVAL '110 days'),
('AZ-3891', 'P003', '1000 KVA', 'South', 'Power', 'Residential Complex Gate', true, 'admin', 'baseline/AZ-3456.jpg', CURRENT_TIMESTAMP - INTERVAL '100 days'),
('AZ-4512', 'P004', '300 KVA', 'East', 'Distribution', 'Commercial Plaza Entrance', false, 'admin', 'baseline/AZ-4343.png', CURRENT_TIMESTAMP - INTERVAL '90 days'),
('AZ-5623', 'P005', '650 KVA', 'West', 'Distribution', 'Highway Service Station', false, 'admin', 'baseline/AZ-8888.jpg', CURRENT_TIMESTAMP - INTERVAL '80 days'),
('AZ-6734', 'P006', '850 KVA', 'Central', 'Power', 'City Center Mall', true, 'admin', 'baseline/AZ-8890.jpg', CURRENT_TIMESTAMP - INTERVAL '70 days'),
('AZ-7845', 'P007', '400 KVA', 'North', 'Distribution', 'University Campus Main Gate', false, 'admin', 'baseline/AZ-8989.jpg', CURRENT_TIMESTAMP - INTERVAL '60 days'),
('AZ-8956', 'P008', '550 KVA', 'South', 'Distribution', 'Hospital Emergency Wing', false, 'admin', 'baseline/AZ-9990.jpg', CURRENT_TIMESTAMP - INTERVAL '50 days'),
('AZ-9067', 'P009', '900 KVA', 'East', 'Power', 'Manufacturing Plant Section B', true, 'admin', 'baseline/AZ-0000.png', CURRENT_TIMESTAMP - INTERVAL '40 days');

-- Insert test inspections with various statuses
-- Recent inspections (last 30 days)
INSERT INTO inspections (transformer_id, inspected_at, status, notes, starred, maintenance_at, thermal_uploader_name, weather_condition, thermal_image_path) VALUES
(1, CURRENT_TIMESTAMP - INTERVAL '2 days', 'COMPLETED', 'Thermal inspection completed. All parameters normal.', true, CURRENT_TIMESTAMP - INTERVAL '1 day', 'inspector_john', 'sunny', 'media/inspections/AZ-1649/thermal_001.jpg'),
(1, CURRENT_TIMESTAMP - INTERVAL '15 days', 'COMPLETED', 'Regular maintenance check completed successfully.', false, CURRENT_TIMESTAMP - INTERVAL '14 days', 'inspector_jane', 'cloudy', 'media/inspections/AZ-1649/thermal_002.jpg'),
(2, CURRENT_TIMESTAMP - INTERVAL '5 days', 'IN_PROGRESS', 'Initial inspection started. Thermal imaging pending.', false, NULL, NULL, NULL, NULL),
(3, CURRENT_TIMESTAMP - INTERVAL '7 days', 'COMPLETED', 'High-voltage transformer inspection completed.', true, CURRENT_TIMESTAMP - INTERVAL '6 days', 'inspector_mike', 'sunny', 'media/inspections/AZ-3891/thermal_001.jpg'),
(4, CURRENT_TIMESTAMP - INTERVAL '3 days', 'NEEDS_REVIEW', 'Unusual thermal patterns detected. Requires expert review.', true, NULL, NULL, NULL, NULL),
(5, CURRENT_TIMESTAMP - INTERVAL '10 days', 'COMPLETED', 'Standard inspection completed without issues.', false, CURRENT_TIMESTAMP - INTERVAL '9 days', 'inspector_sarah', 'rainy', 'media/inspections/AZ-5623/thermal_001.jpg'),
(6, CURRENT_TIMESTAMP - INTERVAL '1 day', 'IN_PROGRESS', 'Power transformer inspection in progress.', false, NULL, NULL, NULL, NULL),
(7, CURRENT_TIMESTAMP - INTERVAL '12 days', 'COMPLETED', 'University campus transformer checked and cleared.', false, CURRENT_TIMESTAMP - INTERVAL '11 days', 'inspector_david', 'windy', 'media/inspections/AZ-7845/thermal_001.jpg'),
(8, CURRENT_TIMESTAMP - INTERVAL '8 days', 'COMPLETED', 'Hospital critical infrastructure inspection completed.', true, CURRENT_TIMESTAMP - INTERVAL '7 days', 'inspector_lisa', 'cloudy', 'media/inspections/AZ-8956/thermal_001.jpg'),
(9, CURRENT_TIMESTAMP - INTERVAL '4 days', 'NEEDS_REVIEW', 'Manufacturing plant transformer showing high temperatures.', true, NULL, NULL, NULL, NULL);

-- Older inspections (for historical data)
INSERT INTO inspections (transformer_id, inspected_at, status, notes, starred, maintenance_at, thermal_uploader_name, weather_condition, thermal_image_path) VALUES
(1, CURRENT_TIMESTAMP - INTERVAL '45 days', 'COMPLETED', 'Previous quarterly inspection completed.', false, CURRENT_TIMESTAMP - INTERVAL '44 days', 'inspector_john', 'sunny', 'media/inspections/AZ-1649/thermal_003.jpg'),
(2, CURRENT_TIMESTAMP - INTERVAL '60 days', 'COMPLETED', 'Bi-monthly inspection completed successfully.', false, CURRENT_TIMESTAMP - INTERVAL '59 days', 'inspector_jane', 'cloudy', 'media/inspections/AZ-2750/thermal_001.jpg'),
(3, CURRENT_TIMESTAMP - INTERVAL '30 days', 'COMPLETED', 'Monthly high-voltage check completed.', false, CURRENT_TIMESTAMP - INTERVAL '29 days', 'inspector_mike', 'windy', 'media/inspections/AZ-3891/thermal_002.jpg'),
(4, CURRENT_TIMESTAMP - INTERVAL '75 days', 'COMPLETED', 'Quarterly inspection completed without issues.', false, CURRENT_TIMESTAMP - INTERVAL '74 days', 'inspector_sarah', 'sunny', 'media/inspections/AZ-4512/thermal_001.jpg'),
(5, CURRENT_TIMESTAMP - INTERVAL '90 days', 'COMPLETED', 'Routine maintenance inspection completed.', false, CURRENT_TIMESTAMP - INTERVAL '89 days', 'inspector_david', 'rainy', 'media/inspections/AZ-5623/thermal_002.jpg'),
(6, CURRENT_TIMESTAMP - INTERVAL '35 days', 'COMPLETED', 'Power transformer quarterly check completed.', false, CURRENT_TIMESTAMP - INTERVAL '34 days', 'inspector_lisa', 'cloudy', 'media/inspections/AZ-6734/thermal_001.jpg'),
(7, CURRENT_TIMESTAMP - INTERVAL '50 days', 'COMPLETED', 'University infrastructure inspection completed.', false, CURRENT_TIMESTAMP - INTERVAL '49 days', 'inspector_john', 'sunny', 'media/inspections/AZ-7845/thermal_002.jpg'),
(8, CURRENT_TIMESTAMP - INTERVAL '40 days', 'COMPLETED', 'Hospital backup power system check completed.', false, CURRENT_TIMESTAMP - INTERVAL '39 days', 'inspector_jane', 'windy', 'media/inspections/AZ-8956/thermal_002.jpg'),
(9, CURRENT_TIMESTAMP - INTERVAL '65 days', 'COMPLETED', 'Industrial transformer maintenance completed.', false, CURRENT_TIMESTAMP - INTERVAL '64 days', 'inspector_mike', 'cloudy', 'media/inspections/AZ-9067/thermal_001.jpg');

-- Insert additional inspections for comprehensive testing
INSERT INTO inspections (transformer_id, inspected_at, status, notes, starred, maintenance_at, thermal_uploader_name) VALUES
(1, CURRENT_TIMESTAMP - INTERVAL '20 days', 'COMPLETED', 'Mid-month inspection completed.', false, CURRENT_TIMESTAMP - INTERVAL '19 days', 'inspector_sarah'),
(2, CURRENT_TIMESTAMP - INTERVAL '25 days', 'COMPLETED', 'Special thermal analysis completed.', false, CURRENT_TIMESTAMP - INTERVAL '24 days', 'inspector_david'),
(3, CURRENT_TIMESTAMP - INTERVAL '18 days', 'COMPLETED', 'Load testing and thermal inspection completed.', false, CURRENT_TIMESTAMP - INTERVAL '17 days', 'inspector_lisa'),
(4, CURRENT_TIMESTAMP - INTERVAL '22 days', 'COMPLETED', 'Post-maintenance verification completed.', false, CURRENT_TIMESTAMP - INTERVAL '21 days', 'inspector_john'),
(5, CURRENT_TIMESTAMP - INTERVAL '28 days', 'COMPLETED', 'Seasonal inspection completed.', false, CURRENT_TIMESTAMP - INTERVAL '27 days', 'inspector_jane'),
(6, CURRENT_TIMESTAMP - INTERVAL '14 days', 'COMPLETED', 'Critical infrastructure check completed.', true, CURRENT_TIMESTAMP - INTERVAL '13 days', 'inspector_mike'),
(7, CURRENT_TIMESTAMP - INTERVAL '16 days', 'COMPLETED', 'Educational facility inspection completed.', false, CURRENT_TIMESTAMP - INTERVAL '15 days', 'inspector_sarah'),
(8, CURRENT_TIMESTAMP - INTERVAL '26 days', 'COMPLETED', 'Healthcare facility inspection completed.', false, CURRENT_TIMESTAMP - INTERVAL '25 days', 'inspector_david'),
(9, CURRENT_TIMESTAMP - INTERVAL '32 days', 'COMPLETED', 'Manufacturing safety inspection completed.', false, CURRENT_TIMESTAMP - INTERVAL '31 days', 'inspector_lisa');

-- Display summary of inserted data
SELECT 'Test Data Summary' as info;
SELECT 
    (SELECT COUNT(*) FROM transformers) as total_transformers,
    (SELECT COUNT(*) FROM inspections) as total_inspections,
    (SELECT COUNT(*) FROM inspections WHERE status = 'COMPLETED') as completed_inspections,
    (SELECT COUNT(*) FROM inspections WHERE status = 'IN_PROGRESS') as in_progress_inspections,
    (SELECT COUNT(*) FROM inspections WHERE status = 'NEEDS_REVIEW') as needs_review_inspections;
