require("dotenv").config();

const express = require("express");
const cors = require("cors");
const analyzeRoutes = require("./routes/analyze");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Routes
app.use("/api", analyzeRoutes);

// Health check - SIMPLIFIED
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Resume Analyzer",
    timestamp: new Date().toISOString(),
    mode: "enhanced_algorithm"
  });
});

// Root
app.get("/", (req, res) => {
  res.json({
    message: "Resume Analyzer API",
    version: "2.0",
    endpoint: "POST /api/analyze",
    mode: "Enhanced Algorithm (No API required)"
  });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Mode: Enhanced Algorithm (No external APIs)`);
  console.log(`✅ Status: Ready to analyze resumes`);
});