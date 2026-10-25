require("dotenv").config();

const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`MedAxis API listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down MedAxis...`);

  server.close(async () => {
    try {
      const { pool } = require("./config/database");
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error.message);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
