-- Migration: Add hospital_id column to users table
-- This allows staff accounts to be linked to specific hospitals
-- Run this script in your MySQL database

-- Add hospital_id column (nullable, so existing users are not affected)
ALTER TABLE users 
ADD COLUMN hospital_id INT NULL,
ADD FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_users_hospital_id ON users(hospital_id);

