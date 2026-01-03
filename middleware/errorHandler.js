function errorHandler(err, req, res, next) {
  console.error("Global Error:", err.message);
  
  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: "File Too Large",
      message: "File size exceeds 5MB limit"
    });
  }
  
  // Default error
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message: "Something went wrong"
  });
}

module.exports = errorHandler;