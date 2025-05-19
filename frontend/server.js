const express = require("express");
const path = require("path");
const cors = require("cors");
const app = express();
const port = 3001;

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// CORS configuration
app.use(
  cors({
    origin: process.env.BACKEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Basic logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

app.get("/books", (req, res) => {
  res.redirect("/books.html");
});

app.get("/cart", (req, res) => {
  res.redirect("/cart.html");
});

app.get("/welcome", (req, res) => {
  res.redirect("/welcome.html");
});

// Handle all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "welcome.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, "public", "error.html"));
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(port, () => {
  console.log(`Frontend server running at http://localhost:${port}`);
});
