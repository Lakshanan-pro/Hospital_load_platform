const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { fetchHospitals, getAddressFromCoordinates } = require("../services/osmService");

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET nearby hospitals - fetches from location API, enriches with DB data
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ msg: "Lat & Lng required" });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    // Step 1: Fetch ALL nearby hospitals from Overpass API (location-based)
    let osmHospitals = [];
    try {
      osmHospitals = await fetchHospitals(userLat, userLng);
    } catch (osmErr) {
      console.error("Error fetching from Overpass API:", osmErr);
      return res.status(500).json({ msg: "Error fetching hospitals from location service" });
    }

    // Step 2: Get all hospitals from DB
    const [dbHospitals] = await pool.query(`
      SELECT id, name, latitude, longitude, osm_id
      FROM hospitals
    `);

    // Step 3: Get all load data (use SELECT * to get whatever columns exist)
    let loadData = [];
    try {
      const [loadDataRows] = await pool.query(`
        SELECT *
        FROM hospital_load
        ORDER BY hospital_id, updated_at DESC
      `);
      loadData = loadDataRows;
    } catch (loadErr) {
      // If hospital_load table doesn't exist or has issues, continue without load data
      console.warn("Could not fetch load data:", loadErr.message);
      loadData = [];
    }

    // Group load data by hospital_id
    // Handle different possible column names
    const loadDataMap = new Map();
    loadData.forEach(row => {
      const hospitalId = row.hospital_id || row.hospitalId;
      const dept = row.department || row.dept || row.dept_name || 'General';
      const crowdLevel = row.crowd_level || row.crowdLevel || 'MEDIUM';
      const estimatedWait = row.estimated_wait || row.estimatedWait || row.wait_time || 0;
      const updatedAt = row.updated_at || row.updatedAt || row.last_updated || new Date();

      if (!loadDataMap.has(hospitalId)) {
        loadDataMap.set(hospitalId, []);
      }
      loadDataMap.get(hospitalId).push({
        department: dept,
        crowd_level: crowdLevel,
        estimated_wait: estimatedWait,
        updated_at: updatedAt
      });
    });

    // Create map of DB hospitals with their load data
    const dbHospitalMap = new Map();
    dbHospitals.forEach(hospital => {
      dbHospitalMap.set(hospital.id, {
        id: hospital.id,
        name: hospital.name,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        osm_id: hospital.osm_id,
        departments: loadDataMap.get(hospital.id) || []
      });
    });

    // Step 3: Match OSM hospitals with DB data and enrich
    const results = [];

    for (const osmHospital of osmHospitals) {
      const osmLat = osmHospital.lat || osmHospital.center?.lat;
      const osmLng = osmHospital.lon || osmHospital.center?.lon;
      const osmName = osmHospital.tags?.name || "Unnamed Hospital";

      if (!osmLat || !osmLng) continue; // Skip if no valid coordinates

      // Try to match with DB hospital
      let matchedDbHospital = null;
      let crowd_level = null;
      let estimated_wait = null;
      let db_hospital_id = null;

      // Match by name (exact or similar)
      for (const [dbId, dbHosp] of dbHospitalMap.entries()) {
        if (dbHosp.name.toLowerCase().trim() === osmName.toLowerCase().trim()) {
          matchedDbHospital = dbHosp;
          break;
        }
      }

      // If no name match, try matching by lat/lng (within 0.001 degrees ~100m)
      if (!matchedDbHospital) {
        for (const [dbId, dbHosp] of dbHospitalMap.entries()) {
          const latDiff = Math.abs(dbHosp.latitude - osmLat);
          const lngDiff = Math.abs(dbHosp.longitude - osmLng);
          if (latDiff < 0.001 && lngDiff < 0.001) {
            matchedDbHospital = dbHosp;
            break;
          }
        }
      }

      // If matched, calculate aggregate crowd data
      if (matchedDbHospital && matchedDbHospital.departments.length > 0) {
        db_hospital_id = matchedDbHospital.id;
        const levels = { LOW: 1, MEDIUM: 2, HIGH: 3 };
        const maxLevel = matchedDbHospital.departments.reduce((prev, curr) => 
          (levels[curr.crowd_level] > levels[prev.crowd_level] ? curr : prev), 
          matchedDbHospital.departments[0]
        );
        crowd_level = maxLevel.crowd_level;
        estimated_wait = Math.round(
          matchedDbHospital.departments.reduce((sum, d) => sum + d.estimated_wait, 0) / 
          matchedDbHospital.departments.length
        );
      }

      // Get departments for this hospital if matched
      const hospitalDepartments = matchedDbHospital ? matchedDbHospital.departments : [];

      // Add hospital to results (ALL hospitals, with or without DB data)
      results.push({
        id: db_hospital_id || null, // DB ID if matched, null otherwise
        name: osmName,
        lat: osmLat,
        lng: osmLng,
        crowd_level: crowd_level || "Unknown",
        estimated_wait: estimated_wait !== null ? estimated_wait : null,
        address: osmHospital.tags?.["addr:full"] || 
                 osmHospital.tags?.["addr:street"] || 
                 osmHospital.tags?.["addr:city"] || 
                 "Address not available",
        departments: hospitalDepartments // Include departments for popup display
      });
    }

    res.json(results);
  } catch (err) {
    console.error("Error in /nearby:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET single hospital by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { department } = req.query; // Department filter from URL parameter

    // Fetch hospital details
    const [hospitals] = await pool.query("SELECT * FROM hospitals WHERE id = ?", [id]);
    
    if (hospitals.length === 0) {
      return res.status(404).json({ msg: "Hospital not found" });
    }

    const hospital = hospitals[0];

    // Fetch address from OSM using coordinates
    let addressStr = null;
    try {
      addressStr = await getAddressFromCoordinates(hospital.latitude, hospital.longitude, hospital.name);
    } catch (addrErr) {
      console.warn("Error fetching address from OSM:", addrErr.message);
    }
    
    // Fallback to lat/lng if address not available
    if (!addressStr) {
      addressStr = `Lat: ${parseFloat(hospital.latitude).toFixed(6)}, Lng: ${parseFloat(hospital.longitude).toFixed(6)}`;
    }

    // Fetch department-wise crowd data (use SELECT * to handle different column names)
    let loadData = [];
    try {
      const [loadDataRows] = await pool.query(
        "SELECT * FROM hospital_load WHERE hospital_id = ? ORDER BY updated_at DESC",
        [id]
      );
      // Map to standard column names
      loadData = loadDataRows.map(row => ({
        department: row.department || row.dept || row.dept_name || 'General',
        crowd_level: row.crowd_level || row.crowdLevel || 'MEDIUM',
        estimated_wait: row.estimated_wait || row.estimatedWait || row.wait_time || 0,
        updated_at: row.updated_at || row.updatedAt || row.last_updated || new Date()
      }));
    } catch (loadErr) {
      // If query fails, continue with empty load data
      console.warn("Could not fetch load data for hospital:", loadErr.message);
      loadData = [];
    }

    // Filter by department if provided
    let filteredData = loadData;
    let selectedDepartment = null;
    if (department && department.trim() !== "") {
      const deptName = department.trim();
      // Try exact match first (case-insensitive), then partial match
      selectedDepartment = loadData.find(d => 
        d.department.toLowerCase() === deptName.toLowerCase()
      ) || loadData.find(d => 
        d.department.toLowerCase().includes(deptName.toLowerCase())
      );
      
      if (selectedDepartment) {
        filteredData = [selectedDepartment];
      }
    }

    // Calculate overall crowd level and estimated wait
    let overallCrowdLevel = "Unknown";
    let overallEstimatedWait = null;
    const departments = [];

    // If department filter is specified, use that department's data for overall stats
    if (selectedDepartment) {
      overallCrowdLevel = selectedDepartment.crowd_level;
      overallEstimatedWait = selectedDepartment.estimated_wait;
    } else if (loadData.length > 0) {
      const levels = { LOW: 1, MEDIUM: 2, HIGH: 3 };
      const maxLevel = loadData.reduce((prev, curr) => 
        (levels[curr.crowd_level] > levels[prev.crowd_level] ? curr : prev), 
        loadData[0]
      );
      overallCrowdLevel = maxLevel.crowd_level;
      overallEstimatedWait = Math.round(
        loadData.reduce((sum, d) => sum + d.estimated_wait, 0) / loadData.length
      );
    }

    // Group by department (get latest for each department) for the departments list
    const deptMap = new Map();
    loadData.forEach(d => {
      if (!deptMap.has(d.department) || 
          new Date(d.updated_at) > new Date(deptMap.get(d.department).updated_at)) {
        deptMap.set(d.department, d);
      }
    });
    
    deptMap.forEach((value, key) => {
      departments.push({
        name: key,
        crowd_level: value.crowd_level,
        estimated_wait: value.estimated_wait,
        last_updated: value.updated_at
      });
    });

    // Get user location from query params if available (for distance calculation)
    let distance = null;
    if (req.query.lat && req.query.lng) {
      const userLat = parseFloat(req.query.lat);
      const userLng = parseFloat(req.query.lng);
      const R = 6371; // Earth's radius in km
      const dLat = (hospital.latitude - userLat) * Math.PI / 180;
      const dLon = (hospital.longitude - userLng) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(userLat * Math.PI / 180) * Math.cos(hospital.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance = R * c;
    }

    res.json({
      id: hospital.id,
      name: hospital.name,
      address: addressStr,
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      distance: distance,
      crowd_level: overallCrowdLevel,
      estimated_wait: overallEstimatedWait,
      departments: departments,
      selected_department: selectedDepartment ? selectedDepartment.department : null,
      last_updated: loadData.length > 0 
        ? loadData[0].updated_at 
        : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST hospital load data (for staff dashboard)
router.post("/:id/load", async (req, res) => {
  try {
    const { id } = req.params;
    const { department, crowd_level, estimated_wait, user_id } = req.body;

    // Validate input
    if (!department || !crowd_level || estimated_wait === undefined) {
      return res.status(400).json({ 
        msg: "Missing required fields: department, crowd_level, estimated_wait" 
      });
    }

    if (!["LOW", "MEDIUM", "HIGH"].includes(crowd_level)) {
      return res.status(400).json({ 
        msg: "crowd_level must be LOW, MEDIUM, or HIGH" 
      });
    }

    if (isNaN(estimated_wait) || estimated_wait < 0) {
      return res.status(400).json({ 
        msg: "estimated_wait must be a positive number" 
      });
    }

    // Validate user is linked to this hospital
    if (!user_id) {
      return res.status(400).json({ msg: "user_id is required for auditing" });
    }

    const [users] = await pool.query(
      "SELECT hospital_id FROM users WHERE id = ?",
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (!users[0].hospital_id) {
      return res.status(403).json({ msg: "User is not linked to any hospital" });
    }

    if (parseInt(users[0].hospital_id, 10) !== parseInt(id, 10)) {
      return res.status(403).json({ msg: "You can only update data for your linked hospital" });
    }

    // Verify hospital exists
    const [hospitals] = await pool.query("SELECT id FROM hospitals WHERE id = ?", [id]);
    if (hospitals.length === 0) {
      return res.status(404).json({ msg: "Hospital not found" });
    }

    // Check if record exists for this hospital + department combination
    // Handle different column names dynamically
    let existing = [];
    let deptColumn = 'department'; // Default column name
    
    // First, try to find department column name
    try {
      const [columns] = await pool.query("SHOW COLUMNS FROM hospital_load");
      const deptCol = columns.find(col => 
        col.Field.toLowerCase().includes('dept') || 
        col.Field.toLowerCase() === 'department'
      );
      if (deptCol) {
        deptColumn = deptCol.Field;
      }
    } catch (err) {
      console.warn("Could not check columns, will try default 'department':", err.message);
    }

    // Check if record exists for this specific hospital_id + department combination
    try {
      [existing] = await pool.query(
        `SELECT id FROM hospital_load WHERE hospital_id = ? AND ${deptColumn} = ?`,
        [id, department]
      );
    } catch (err) {
      // If query fails (column might not exist), try without department filter as fallback
      console.warn("Query with department filter failed, trying without:", err.message);
      [existing] = await pool.query(
        "SELECT id FROM hospital_load WHERE hospital_id = ?",
        [id]
      );
    }

    if (existing.length > 0) {
      // UPDATE existing record for this hospital + department combination
      try {
        await pool.query(
          `UPDATE hospital_load 
           SET crowd_level = ?, estimated_wait = ?, updated_at = NOW()
           WHERE hospital_id = ? AND ${deptColumn} = ?`,
          [crowd_level, parseInt(estimated_wait), id, department]
        );
      } catch (updateErr) {
        // If update with department filter fails, try without
        console.warn("Update with department filter failed, trying without:", updateErr.message);
        await pool.query(
          `UPDATE hospital_load 
           SET crowd_level = ?, estimated_wait = ?, updated_at = NOW()
           WHERE hospital_id = ? LIMIT 1`,
          [crowd_level, parseInt(estimated_wait), id]
        );
      }
    } else {
      // INSERT new record for this hospital + department combination
      try {
        await pool.query(
          `INSERT INTO hospital_load (hospital_id, ${deptColumn}, crowd_level, estimated_wait, updated_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [id, department, crowd_level, parseInt(estimated_wait)]
        );
      } catch (insertErr) {
        // If insert with department fails, try without department column
        console.warn("Insert with department column failed, trying without:", insertErr.message);
        await pool.query(
          `INSERT INTO hospital_load (hospital_id, crowd_level, estimated_wait, updated_at)
           VALUES (?, ?, ?, NOW())`,
          [id, crowd_level, parseInt(estimated_wait)]
        );
      }
    }

    res.json({ 
      msg: "Hospital load data updated successfully",
      hospital_id: id,
      department,
      crowd_level,
      estimated_wait: parseInt(estimated_wait)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET all hospitals (for dashboard display)
router.get("/", async (req, res) => {
  try {
    const [hospitals] = await pool.query("SELECT id, name FROM hospitals ORDER BY name");
    res.json(hospitals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/hospitals/link-user - Disabled: linking happens only during registration
router.post("/link-user", async (_req, res) => {
  res.status(410).json({ msg: "Hospital linking is locked to registration and cannot be changed later." });
});

module.exports = router;
