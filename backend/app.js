const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { checkDatabaseConnection } = require("./config/database");

const app = express();

app.disable("x-powered-by");

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS."));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    name: "MedAxis Hospital ERP",
    version: "1.0.0",
    api: "/api",
    health: "/api/health",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const db = await checkDatabaseConnection();

    res.json({
      success: true,
      message: "MedAxis API is running.",
      database: "connected",
      databaseName: db.database_name,
      timestamp: db.server_time,
    });
  } catch (error) {
    console.error("Health check:", error.message);

    res.status(503).json({
      success: false,
      message: "Database connection unavailable.",
    });
  }
});

app.use("/api", require("./routes"));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, req, res, next) => {
  console.error("API error:", error.stack || error);

  if (res.headersSent) return next(error);

  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "A record with the same unique value already exists.",
    });
  }

  if (error.code === "23503") {
    return res.status(409).json({
      success: false,
      message: "This record is referenced by another record.",
    });
  }

  if (error.code === "22P02") {
    return res.status(400).json({
      success: false,
      message: "An invalid database value was supplied.",
    });
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.status
      ? error.message
      : "An unexpected server error occurred.",
  });
});

module.exports = app;
