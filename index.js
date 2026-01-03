require("dotenv").config();

const express = require("express");
const cors = require("cors");
const analyzeRoutes = require("./routes/analyze");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.use("/api", analyzeRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Resume Analyzer",
    timestamp: new Date().toISOString(),
    mode: "enhanced_algorithm"
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Resume Analyzer API",
    version: "2.0",
    endpoint: "POST /api/analyze",
    mode: "Enhanced Algorithm (No API required)"
  });
});

app.use(errorHandler);

app.listen(PORT, () => {

  console.log(`Status: Ready to analyze resumes`);
});