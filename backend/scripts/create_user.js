// Script to create hospital staff user accounts
// Usage: node backend/scripts/create_user.js <username> <password> [hospital_id]
// Example: node backend/scripts/create_user.js staff_hospital1 password123 1

const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function createUser() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node create_user.js <username> <password> [hospital_id]');
    console.log('Example: node create_user.js staff_hospital1 password123 1');
    process.exit(1);
  }

  const [username, password, hospitalId] = args;

  try {
    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      console.error(`Error: Username '${username}' already exists`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // If hospital_id provided, verify it exists
    if (hospitalId) {
      const [hospitals] = await pool.query('SELECT id FROM hospitals WHERE id = ?', [parseInt(hospitalId)]);
      if (hospitals.length === 0) {
        console.error(`Error: Hospital with ID ${hospitalId} not found`);
        process.exit(1);
      }
    }

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role, hospital_id) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, 'staff', hospitalId ? parseInt(hospitalId) : null]
    );

    console.log(`✅ User '${username}' created successfully!`);
    console.log(`   User ID: ${result.insertId}`);
    if (hospitalId) {
      console.log(`   Linked to Hospital ID: ${hospitalId}`);
    } else {
      console.log(`   No hospital linked. User can select hospital on first login.`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating user:', err);
    process.exit(1);
  }
}

createUser();



