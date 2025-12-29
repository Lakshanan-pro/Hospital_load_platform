const express = require("express");
const bcrypt = require("bcryptjs");
const fetch = require("node-fetch");
const pool = require("../config/db");

const router = express.Router();

// POST /api/admin/register-request - Hospital registration request
router.post("/register-request", async (req, res) => {
  try {
    const {
      hospital_name,
      hospital_id_license,
      username,
      password,
      email,
      contact_number,
      address,
      city
    } = req.body;

    // Validate required fields
    if (!hospital_name || !username || !password || !email) {
      return res.status(400).json({
        msg: "Hospital name, username, password, and email are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        msg: "Password must be at least 6 characters"
      });
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
      return res.status(400).json({
        msg: "Username already has a pending registration request"
      });
    }

    // Check if username already exists in users table
    const [existingUser] = await pool.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({
        msg: "Username already exists"
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert into pending_hospital_requests
    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO pending_hospital_requests 
         (hospital_name, hospital_id_license, username, password, email, contact_number, address, city, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          hospital_name,
          hospital_id_license || null,
          username,
          hashedPassword,
          email,
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
    console.error("Registration request error:", err);
    res.status(500).json({ msg: "Server error during registration request" });
  }
});

// GET /api/admin/pending-requests - Get all pending requests (admin only)
router.get("/pending-requests", async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT id, hospital_name, hospital_id_license, username, email, 
              contact_number, address, city, status, created_at
       FROM pending_hospital_requests
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    );

    res.json(requests);
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Helper: find hospital by name from live Overpass (OSM) dataset
async function findHospitalInOSMByName(hospitalName) {
  const safeName = hospitalName.replace(/"/g, '\\"');
  const query = `
    [out:json];
    (
      node["amenity"="hospital"]["name"~"^${safeName}$", i];
      way["amenity"="hospital"]["name"~"^${safeName}$", i];
    );
    out center 1;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
  });

  const data = await res.json();
  return Array.isArray(data.elements) ? data.elements : [];
}

// POST /api/admin/approve-request - Approve a registration request (auto-matches hospital name)
router.post("/approve-request", async (req, res) => {
  try {
    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({ msg: "request_id is required" });
    }

    // Get the pending request
    const [requests] = await pool.query(
      "SELECT * FROM pending_hospital_requests WHERE id = ? AND status = 'pending'",
      [request_id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ msg: "Pending request not found" });
    }

    const request = requests[0];

    // First, try to match hospital by name in local DB (case-insensitive, trimmed)
    let hospitalId = null;
    let matchedHospitalName = null;

    const [dbHospitals] = await pool.query(
      "SELECT id, name, osm_id FROM hospitals WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1",
      [request.hospital_name]
    );

    if (dbHospitals.length > 0) {
      hospitalId = dbHospitals[0].id;
      matchedHospitalName = dbHospitals[0].name;
    } else {
      // If not in DB, look it up live from Overpass (map) dataset
      let osmHospitals = [];
      try {
        osmHospitals = await findHospitalInOSMByName(request.hospital_name.trim());
      } catch (osmErr) {
        console.error("Error querying Overpass for hospital:", osmErr);
        return res.status(500).json({
          msg: "Error looking up hospital in map dataset. Please try again later."
        });
      }

      if (!osmHospitals || osmHospitals.length === 0) {
        return res.status(400).json({
          msg: `Hospital "${request.hospital_name}" not found in live map dataset. Cannot approve request.`
        });
      }

      // Take the first matching element
      const h = osmHospitals[0];
      const osmId = h.id;
      const lat = h.lat || h.center?.lat;
      const lng = h.lon || h.center?.lon;
      const osmName = (h.tags && h.tags.name) ? h.tags.name : request.hospital_name.trim();

      if (!lat || !lng) {
        return res.status(400).json({
          msg: `Hospital "${request.hospital_name}" found in map dataset but without valid coordinates. Cannot approve request.`
        });
      }

      // Ensure we don't duplicate hospitals: check by osm_id
      const [existingByOsm] = await pool.query(
        "SELECT id, name FROM hospitals WHERE osm_id = ? LIMIT 1",
        [osmId]
      );

      if (existingByOsm.length > 0) {
        hospitalId = existingByOsm[0].id;
        matchedHospitalName = existingByOsm[0].name;
      } else {
        // Insert hospital mirrored from map dataset into hospitals table
        const [insertResult] = await pool.query(
          "INSERT INTO hospitals (osm_id, name, latitude, longitude, created_at) VALUES (?, ?, ?, ?, NOW())",
          [osmId, osmName, lat, lng]
        );
        hospitalId = insertResult.insertId;
        matchedHospitalName = osmName;
      }
    }

    // Check if username still available
    const [existingUser] = await pool.query(
      "SELECT id FROM users WHERE username = ?",
      [request.username]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ msg: "Username already exists in users table" });
    }

    // Insert into users table with matched hospital_id
    await pool.query(
      `INSERT INTO users (username, password, role, hospital_id)
       VALUES (?, ?, 'staff', ?)`,
      [request.username, request.password, hospitalId]
    );

    // Update request status to approved
    await pool.query(
      "UPDATE pending_hospital_requests SET status = 'approved' WHERE id = ?",
      [request_id]
    );

    res.json({
      msg: `Registration request approved successfully. User linked to "${matchedHospitalName}". Hospital can now login.`,
      username: request.username,
      hospital_id: hospitalId,
      hospital_name: matchedHospitalName
    });
  } catch (err) {
    console.error("Error approving request:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/admin/reject-request - Reject a registration request
router.post("/reject-request", async (req, res) => {
  try {
    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({ msg: "request_id is required" });
    }

    // Update request status to rejected
    const [result] = await pool.query(
      "UPDATE pending_hospital_requests SET status = 'rejected' WHERE id = ? AND status = 'pending'",
      [request_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: "Pending request not found" });
    }

    res.json({ msg: "Registration request rejected successfully" });
  } catch (err) {
    console.error("Error rejecting request:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;

