require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const rateLimit = require("express-rate-limit");
const axiosRetry = require("axios-retry").default; // Correct import

// Initialize Express app
const app = express();
const upload = multer({ dest: "uploads/" });

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: "Too many requests, please try again later.",
});
app.use("/analyze", limiter);

// Axios retry configuration
axiosRetry(axios, {
  retries: 3, // Retry up to 3 times
  retryDelay: (retryCount) => retryCount * 1000, // 1-second delay between retries
  retryCondition: (error) => {
    // Retry on 429 or network errors
    return error.response?.status === 429 || !error.response;
  },
});

// Middleware
app.use(
  cors({
    origin: "https://ai-resume-analyzer-fawn.vercel.app", // Allow requests from Vercel frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);app.use(express.json());

// TogetherAI Configuration
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const TOGETHER_API_URL = "https://api.together.xyz/v1/completions";

// File Reading Helper
async function readFileContent(filePath, mimetype) {
  try {
    if (mimetype === "application/pdf") {
      const dataBuffer = await fs.promises.readFile(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } else if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    return fs.promises.readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(`File read error: ${error.message}`);
  }
}

// Safe JSON Parsing Function
function safeParseJSON(jsonString) {
  for (let i = jsonString.length; i > 0; i--) {
    try {
      return JSON.parse(jsonString.substring(0, i));
    } catch (e) {
      // Continue trimming
    }
  }
  throw new Error("No valid JSON found in the response");
}

// Analysis Endpoint
app.post("/analyze", upload.single("resume"), async (req, res) => {
  let rawResponse;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { path: filePath, mimetype } = req.file;
    const fileContent = await readFileContent(filePath, mimetype);

    // Strict prompt to enforce JSON-only response
    const prompt = `
      Analyze this resume and return ONLY a JSON object with:
      - "ats_score": integer between 0-100 (ATS percentage)
      - "mandatory_changes": array of {field: string, description: string}
      
      Resume Content:
      ${fileContent}

      STRICT RULES:
      1. Return ONLY the JSON object
      2. No markdown, comments, or text
      3. Ensure proper JSON formatting
      4. ats_score must be integer (e.g., 85 not 0.85)
      
      JSON Response:
    `;

    // Call TogetherAI API
    const response = await axios.post(
      TOGETHER_API_URL,
      {
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        prompt: prompt,
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature for more structured output
        stop: ["\n\n"], // Stop generation after JSON
      },
      {
        headers: {
          Authorization: `Bearer ${TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // 1. Get raw AI response
    rawResponse = response.data.choices[0].text.trim();
    console.log("Raw AI Response:", rawResponse); // Debugging

    // 2. Extract JSON using advanced regex
    const jsonMatch = rawResponse.match(/^[^{]*\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }

    // 3. Sanitize JSON string
    let jsonString = jsonMatch[0]
      .replace(/```json|```/g, "") // Remove markdown
      .replace(/[^\x20-\x7E]/g, "") // Remove non-printable characters
      .replace(/,[ \t\r\n]+}/g, "}") // Fix trailing commas
      .trim();

    // 4. Safe JSON parsing
    console.log("Sanitized JSON:", jsonString); // Debugging
    const analysis = safeParseJSON(jsonString);

    // 5. Validate structure
    if (
      typeof analysis.ats_score !== "number" ||
      analysis.ats_score < 0 ||
      analysis.ats_score > 100 ||
      !Array.isArray(analysis.mandatory_changes)
    ) {
      throw new Error("Invalid analysis structure from AI");
    }

    // 6. Send response
    res.json({ analysis });

  } catch (error) {
    console.error("Server Error:", {
      message: error.message,
      stack: error.stack,
      rawResponse: rawResponse || "N/A", // Log the problematic response
    });
    res.status(500).json({
      error: `Analysis failed: ${error.message}`,
      debug: process.env.NODE_ENV === "development" ? rawResponse : undefined,
    });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});