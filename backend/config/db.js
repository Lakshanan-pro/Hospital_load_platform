const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "laks",
  database: "hospital_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test database connection on startup
pool.getConnection()
  .then(connection => {
    console.log("✅ Database connected successfully!");
    connection.release();
  })
  .catch(err => {
    console.error("❌ Database connection error:");
    console.error("   Error code:", err.code);
    console.error("   Error message:", err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error("\n💡 Fix: Check your MySQL password in backend/config/db.js");
      console.error("   Make sure the password matches your MySQL root password.");
      console.error("   You can reset it or update the password in the config file.");
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error("\n💡 Fix: Database 'hospital_db' doesn't exist.");
      console.error("   Create it with: CREATE DATABASE hospital_db;");
    } else if (err.code === 'ECONNREFUSED') {
      console.error("\n💡 Fix: MySQL server is not running.");
      console.error("   Start MySQL service and try again.");
    }
  });

module.exports = pool;
