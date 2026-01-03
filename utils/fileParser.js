const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const fs = require("fs").promises;

async function extractTextFromFile(fileBuffer, mimetype, filename) {
  try {
    if (mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
      console.log("Processing PDF file...");
      
      // Try multiple PDF parsing strategies
      return await extractFromPDF(fileBuffer);
    } 
    else if (mimetype.includes('wordprocessingml') || filename.toLowerCase().endsWith('.docx')) {
      console.log("Processing DOCX file...");
      const tempPath = `./temp-${Date.now()}.docx`;
      await fs.writeFile(tempPath, fileBuffer);
      const result = await mammoth.extractRawText({ path: tempPath });
      await fs.unlink(tempPath);
      return result.value || "";
    }
    else {
      console.log("Processing text file...");
      return fileBuffer.toString('utf-8');
    }
  } catch (error) {
    console.error("Extraction failed:", error.message);
    
    // Try fallback method
    try {
      console.log("Trying fallback text extraction...");
      const fallbackText = await extractWithFallbackMethods(fileBuffer, filename);
      if (fallbackText && fallbackText.length > 100) {
        console.log("Fallback method succeeded!");
        return fallbackText;
      }
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError.message);
    }
    
    throw new Error("Could not read this file. Try saving as a TXT file or using a different PDF.");
  }
}

// Improved PDF extraction with multiple strategies
async function extractFromPDF(fileBuffer) {
  try {
    // Strategy 1: Standard pdf-parse
    const data = await pdf(fileBuffer);
    const text = data.text || "";
    
    if (text.trim().length > 100) {
      console.log(`Standard PDF extraction: ${text.length} chars`);
      return text;
    }
    
    // Strategy 2: Try with different options
    try {
      const data2 = await pdf(fileBuffer, {
        max: 0, // No page limit
        pagerender: null, // Use default renderer
      });
      const text2 = data2.text || "";
      
      if (text2.trim().length > 100) {
        console.log(`Alternative PDF extraction: ${text2.length} chars`);
        return text2;
      }
    } catch (e) {
      console.log("Alternative PDF parsing failed:", e.message);
    }
    
    // Strategy 3: Try to extract raw text from buffer
    const rawText = extractRawTextFromBuffer(fileBuffer);
    if (rawText && rawText.length > 100) {
      console.log(`Raw buffer extraction: ${rawText.length} chars`);
      return rawText;
    }
    
    throw new Error("PDF appears to be empty or unreadable");
    
  } catch (error) {
    console.error("PDF extraction error:", error.message);
    throw error;
  }
}

// Extract raw text from buffer (for corrupted PDFs)
function extractRawTextFromBuffer(buffer) {
  try {
    // Convert buffer to string and look for text patterns
    const bufferString = buffer.toString('latin1');
    
    // Common PDF text patterns
    const patterns = [
      // Text between parentheses (common in PDF)
      /\(([^)]+)\)/g,
      // Text between brackets
      /\[([^\]]+)\]/g,
      // Text segments
      /T[mdJ]*\(([^)]+)\)/g,
      // Simple text matches
      /[A-Za-z0-9\s.,;:!?@#$%^&*()\-_+=<>{}[\]|\\/'"`~]{10,}/g
    ];
    
    let extractedText = "";
    
    patterns.forEach(pattern => {
      const matches = bufferString.match(pattern) || [];
      matches.forEach(match => {
        // Clean up the text
        const cleanText = match
          .replace(/\(|\)|\[|\]|T[mdJ]*\(|\)/g, '') // Remove PDF markers
          .replace(/\\[A-Za-z]/g, ' ') // Remove escape sequences
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        if (cleanText.length > 5) {
          extractedText += cleanText + " ";
        }
      });
    });
    
    return extractedText.trim();
  } catch (error) {
    console.error("Raw text extraction failed:", error.message);
    return "";
  }
}

// Fallback methods
async function extractWithFallbackMethods(fileBuffer, filename) {
  // Method 1: Try as plain text
  try {
    const asText = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 100000));
    if (asText.length > 200 && asText.includes(' ')) {
      return asText;
    }
  } catch (e) {
    // Ignore
  }
  
  // Method 2: Try different encodings
  const encodings = ['utf-8', 'latin1', 'ascii', 'utf16le'];
  for (const encoding of encodings) {
    try {
      const text = fileBuffer.toString(encoding, 0, Math.min(fileBuffer.length, 50000));
      if (text.length > 200 && /[A-Za-z]/.test(text)) {
        console.log(`Found text with ${encoding} encoding`);
        return text;
      }
    } catch (e) {
      // Try next encoding
    }
  }
  
  throw new Error("All fallback methods failed");
}

module.exports = { extractTextFromFile };