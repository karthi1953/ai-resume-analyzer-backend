const express = require("express");
const multer = require("multer");
const { extractTextFromFile } = require("../utils/fileParser");
const { calculateATSScore } = require("../utils/atsScorer"); 

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
        message: "Please select a resume file"
      });
    }

    console.log(`📄 Processing: ${req.file.originalname}`);

    // Extract text
    const resumeText = await extractTextFromFile(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        error: "Empty File",
        message: "File contains no readable text"
      });
    }

    const analysis = await calculateATSScore(resumeText);

    res.json({
        success: true,
        analysis: {
          ats_score: analysis.ats_score,
          mandatory_changes: analysis.mandatory_changes,
          summary: analysis.summary,
          strengths: analysis.strengths || [],
          insights: analysis.insights || [],
          warnings: analysis.warnings || [],
          analyzed_by: analysis.analyzed_by || "pro_ats_engine",
          metrics: analysis.metrics || {},
          timestamp: new Date().toISOString()
        }
      });

  } catch (error) {
    console.error("Server error:", error.message);
    
    if (error.message.includes("Could not read")) {
      return res.status(400).json({
        success: false,
        error: "File Error",
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: "Analysis Failed",
      message: "An unexpected error occurred"
    });
  }
});

module.exports = router;