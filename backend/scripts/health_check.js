require("dotenv").config();

const { checkDatabaseConnection, pool } = require("../config/database");

async function main() {
  try {
    const database = await checkDatabaseConnection();

    console.log("PostgreSQL connection successful.");
    console.log("Database:", database.database_name);
    console.log("Server time:", database.server_time);
    console.log("PostgreSQL version:", database.postgres_version);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
