require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const path = require("path");
const session = require("express-session");
const fs = require("fs");
const csv = require("csv-parse");
const { Pool } = require("pg");

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("public"));

// Session middleware
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true if using https
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Add this before creating the pool
console.log("Database connection details:", {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  // Don't log the password
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Add this function to handle database connection retries
const connectWithRetry = async () => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const client = await pool.connect();
      console.log("Connected to PostgreSQL database");
      client.release();
      return;
    } catch (err) {
      retries++;
      console.log(
        `Failed to connect to database (attempt ${retries}/${maxRetries})`
      );
      if (retries === maxRetries) {
        console.error("Could not connect to database after multiple attempts");
        throw err;
      }
      // Wait for 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

// Call this when your app starts
connectWithRetry()
  .then(() => {
    // Start creating tables after successful connection
    return createTables();
  })
  .then(() => {
    // Start your server here
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Error during startup:", err);
    process.exit(1);
  });

// Create tables (PostgreSQL syntax is slightly different)
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, book_id)
      )
    `);

    // Move loadBooksFromCSV here, after tables are created
    await loadBooksFromCSV();
  } catch (err) {
    console.error("Error creating tables:", err);
  }
};

// Modify the loadBooksFromCSV function
function loadBooksFromCSV() {
  return new Promise((resolve, reject) => {
    const books = [];
    fs.createReadStream("books.csv")
      .pipe(csv.parse({ columns: true, skip_empty_lines: true }))
      .on("data", (row) => {
        books.push(row);
      })
      .on("end", async () => {
        try {
          const result = await pool.query(
            "SELECT COUNT(*) as count FROM books"
          );
          if (result.rows[0].count === "0") {
            for (const book of books) {
              await pool.query(
                "INSERT INTO books (title, author) VALUES ($1, $2)",
                [book.title, book.author]
              );
            }
            console.log("Books loaded from CSV into database");
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/");
  }
};

// Routes
app.get("/", (req, res) => {
  if (req.session.user) {
    res.redirect("/welcome");
  } else {
    res.sendFile(path.join(__dirname, "public", "login.html"));
  }
});
app.get("/welcome", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "welcome.html"));
});

app.get("/books", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "books.html"));
});

app.get("/cart", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cart.html"));
});

// Modify the API endpoints to use PostgreSQL
app.get("/api/books", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM books ORDER BY title");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/cart", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.* 
       FROM books b
       JOIN cart c ON b.id = c.book_id
       WHERE c.user_id = $1
       ORDER BY b.title`,
      [req.session.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/cart/count", requireAuth, (req, res) => {
  const userId = req.session.user.id;
  pool.query(
    "SELECT COUNT(*) as count FROM cart WHERE user_id = $1",
    [userId],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ count: result.rows[0].count });
    }
  );
});

app.post("/api/cart/add", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO cart (user_id, book_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.session.user.id, req.body.bookId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error adding to cart" });
  }
});

app.post("/api/cart/remove", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM cart WHERE user_id = $1 AND book_id = $2", [
      req.session.user.id,
      req.body.bookId,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error removing from cart" });
  }
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if username exists
    const userCheck = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [
      username,
      hashedPassword,
    ]);
    res.json({ success: true, message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error creating user" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
    };

    res.json({ success: true, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Logout endpoint
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Error logging out" });
    }
    res.json({ success: true });
  });
});

// Get current user endpoint
app.get("/api/user", (req, res) => {
  if (req.session.user) {
    res.json({ username: req.session.user.username });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

// Health check endpoints
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/health/db", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT 1");
    client.release();

    res.status(200).json({
      status: "UP",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: "DOWN",
      database: "disconnected",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});
