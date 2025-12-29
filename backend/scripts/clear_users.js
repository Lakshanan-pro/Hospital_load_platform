// Utility script to delete all existing users (use with caution)
// Usage: node backend/scripts/clear_users.js

const pool = require("../config/db");

async function clearUsers() {
  try {
    await pool.query("DELETE FROM users");
    await pool.query("ALTER TABLE users AUTO_INCREMENT = 1");
    console.log("✅ All users deleted. Remember to recreate admin accounts if needed.");
  } catch (err) {
    console.error("Error deleting users:", err);
  } finally {
    process.exit(0);
  }
}

clearUsers();


