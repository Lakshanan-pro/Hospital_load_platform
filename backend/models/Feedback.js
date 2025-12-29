const express = require("express");
const pool = require("../config/db");
const router = express.Router();

router.post("/", async (req, res) => {
  const { hospital_id, actual_wait, comment } = req.body;
  await pool.query("INSERT INTO feedback (hospital_id, actual_wait, comment) VALUES (?, ?, ?)", [hospital_id, actual_wait, comment]);
  res.json({ msg: "Feedback submitted" });
});

module.exports = router;
