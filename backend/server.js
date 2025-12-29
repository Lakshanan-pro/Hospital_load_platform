const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Routes
const hospitalRoutes = require("./routes/hospitals");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");

app.use("/api/hospitals", hospitalRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
