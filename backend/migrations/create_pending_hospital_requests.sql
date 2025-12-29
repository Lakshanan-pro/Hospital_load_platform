-- Migration: Create pending_hospital_requests table
-- This table stores hospital registration requests awaiting admin approval

CREATE TABLE IF NOT EXISTS pending_hospital_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_name VARCHAR(255) NOT NULL,
  hospital_id_license VARCHAR(100),
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  contact_number VARCHAR(50),
  address VARCHAR(500),
  city VARCHAR(100),
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_username (username)
);



