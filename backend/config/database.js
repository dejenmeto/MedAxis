const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  application_name: "medaxis-hms",
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function checkDatabaseConnection() {
  const result = await query(`
    SELECT
      current_database() AS database_name,
      CURRENT_TIMESTAMP AS server_time,
      version() AS postgres_version
  `);

  return result.rows[0];
}

module.exports = {
  pool,
  query,
  checkDatabaseConnection,
};
