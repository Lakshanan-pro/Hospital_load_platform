const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const router = express.Router();

// POST /api/auth/signup - Create pending registration request (requires admin approval)
router.post("/signup", async (req, res) => {
  try {
    const { 
      username, 
      password, 
      hospital_name,
      email,
      contact_number,
      address,
      city,
      hospital_id_license
    } = req.body;

    if (!username || !password || !hospital_name) {
      return res.status(400).json({ msg: "Username, password, and hospital name are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    // Check if username already exists in pending requests
    let existingPending = [];
    try {
      [existingPending] = await pool.query(
        "SELECT id FROM pending_hospital_requests WHERE username = ?",
        [username]
      );
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({
          msg: "Database table not found. Please run the migration: mysql -u root -p hospital_db < backend/migrations/create_pending_hospital_requests.sql"
        });
      }
      throw tableErr;
    }
    if (existingPending.length > 0) {
      return res.status(400).json({ msg: "Username already has a pending registration request" });
    }

    // Check if username already exists in users table
    const [existingUser] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
    if (existingUser.length > 0) {
      return res.status(400).json({ msg: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into pending_hospital_requests (NOT activated yet)
    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO pending_hospital_requests 
         (hospital_name, hospital_id_license, username, password, email, contact_number, address, city, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          hospital_name.trim(),
          hospital_id_license || null,
          username.trim(),
          hashedPassword,
          email || null,
          contact_number || null,
          address || null,
          city || null
        ]
      );
    } catch (insertErr) {
      if (insertErr.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({
          msg: "Database table not found. Please run the migration: mysql -u root -p hospital_db < backend/migrations/create_pending_hospital_requests.sql"
        });
      }
      throw insertErr;
    }

    res.status(201).json({
      msg: "Registration request submitted successfully. Please wait for admin approval.",
      request_id: result.insertId
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ msg: "Server error during signup" });
  }
});

// POST /api/auth/login - Login user
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ msg: "Username and password are required" });
    }

    // Check if user exists in users table (only approved users are here)
    const [rows] = await pool.query(
      `SELECT u.*, h.name AS hospital_name
       FROM users u
       LEFT JOIN hospitals h ON h.id = u.hospital_id
       WHERE u.username = ?`,
      [username]
    );
    if (rows.length === 0) {
      // Check if there's a pending request
      const [pending] = await pool.query(
        "SELECT status FROM pending_hospital_requests WHERE username = ?",
        [username]
      );
      if (pending.length > 0) {
        if (pending[0].status === 'pending') {
          return res.status(403).json({
            msg: "Your registration request is pending admin approval. Please wait for approval before logging in."
          });
        } else if (pending[0].status === 'rejected') {
          return res.status(403).json({
            msg: "Your registration request was rejected. Please contact administrator."
          });
        }
      }
      return res.status(401).json({ msg: "Invalid username or password" });
    }

    const match = await bcrypt.compare(password, rows[0].password);
    if (!match) {
      return res.status(401).json({ msg: "Invalid username or password" });
    }

    // User is verified (exists in users table after admin approval)
    // Include hospital_id if it exists in the user record
    res.json({ 
      msg: "Login successful", 
      user: {
        id: rows[0].id,
        username: rows[0].username,
        role: rows[0].role || "staff",
        hospital_id: rows[0].hospital_id || null,
        hospital_name: rows[0].hospital_name || null
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error during login" });
  }
});

module.exports = router;
