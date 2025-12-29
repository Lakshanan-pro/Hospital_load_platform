-- Sample Data for Hospital Load Visibility Platform
-- This script inserts sample hospitals and load data for testing/demo purposes
-- Run this after the database schema is set up

-- IMPORTANT: Update the coordinates below to match REAL hospitals near YOUR location
-- The latitude and longitude should match actual hospital positions from OpenStreetMap
-- This ensures the matching logic works correctly (matching by name or lat/lng)
-- 
-- To find real hospital coordinates:
-- 1. Go to https://www.openstreetmap.org
-- 2. Search for hospitals near your location
-- 3. Click on a hospital and note its coordinates
-- 4. Update the values below to match real hospitals
--
-- Example format: ('Hospital Name', latitude, longitude, NOW())

-- Insert sample hospitals
-- NOTE: Update these coordinates to match real hospitals near YOUR current location
INSERT INTO hospitals (name, latitude, longitude, created_at) VALUES
('City General Hospital', 13.0827, 80.2707, NOW()),
('Metro Medical Center', 13.0850, 80.2800, NOW()),
('Community Health Hospital', 13.0750, 80.2600, NOW())
ON DUPLICATE KEY UPDATE name=name;

-- Note: Only insert load data for SOME hospitals (not all)
-- This demonstrates the "Unknown" status for hospitals without DB data

-- Get hospital IDs (these will be set after hospitals are inserted)
SET @hospital1 = (SELECT id FROM hospitals WHERE name = 'City General Hospital' LIMIT 1);
SET @hospital2 = (SELECT id FROM hospitals WHERE name = 'Metro Medical Center' LIMIT 1);
SET @hospital3 = (SELECT id FROM hospitals WHERE name = 'Community Health Hospital' LIMIT 1);

-- Insert sample hospital load data
-- City General Hospital - LOW crowd
INSERT INTO hospital_load (hospital_id, department, crowd_level, estimated_wait, updated_at) VALUES
(@hospital1, 'Emergency', 'LOW', 15, NOW()),
(@hospital1, 'Cardiology', 'LOW', 20, NOW()),
(@hospital1, 'General', 'LOW', 10, NOW())
ON DUPLICATE KEY UPDATE 
  crowd_level=VALUES(crowd_level),
  estimated_wait=VALUES(estimated_wait),
  updated_at=VALUES(updated_at);

-- Metro Medical Center - MEDIUM crowd
INSERT INTO hospital_load (hospital_id, department, crowd_level, estimated_wait, updated_at) VALUES
(@hospital2, 'Emergency', 'MEDIUM', 45, NOW()),
(@hospital2, 'Cardiology', 'MEDIUM', 50, NOW()),
(@hospital2, 'General', 'MEDIUM', 35, NOW())
ON DUPLICATE KEY UPDATE 
  crowd_level=VALUES(crowd_level),
  estimated_wait=VALUES(estimated_wait),
  updated_at=VALUES(updated_at);

-- Community Health Hospital - HIGH crowd
INSERT INTO hospital_load (hospital_id, department, crowd_level, estimated_wait, updated_at) VALUES
(@hospital3, 'Emergency', 'HIGH', 90, NOW()),
(@hospital3, 'Cardiology', 'HIGH', 75, NOW()),
(@hospital3, 'General', 'MEDIUM', 40, NOW())
ON DUPLICATE KEY UPDATE 
  crowd_level=VALUES(crowd_level),
  estimated_wait=VALUES(estimated_wait),
  updated_at=VALUES(updated_at);

-- Note: We're only inserting load data for 3 hospitals
-- Other hospitals from the location API will show "Unknown" status
-- This demonstrates the enrichment behavior

-- Create sample staff user accounts
-- IMPORTANT: The password hashes below are placeholders and will NOT work for login.
-- To create working user accounts, use the Node.js script instead:
--   node backend/scripts/create_user.js staff_citygeneral password123 @hospital1
--   node backend/scripts/create_user.js staff_metro password123 @hospital2
--   node backend/scripts/create_user.js staff_community password123 @hospital3
--
-- Or manually generate bcrypt hash and insert:
--   INSERT INTO users (username, password, role, hospital_id) VALUES
--   ('staff_citygeneral', '<bcrypt_hash_of_password123>', 'staff', @hospital1);
--
-- To generate bcrypt hash in Node.js: bcrypt.hashSync('password123', 10)

