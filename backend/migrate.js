require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("./config/database");

const MIGRATIONS_DIR = path.join(__dirname, "database", "migrations");

const MIGRATION_LOCK_ID = 827364;

async function runMigrations() {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
      .sort();

    const appliedResult = await client.query(
      "SELECT filename FROM schema_migrations",
    );

    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`SKIPPED ${filename} — already applied`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");

      console.log(`RUNNING ${filename}`);

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
          `INSERT INTO schema_migrations (filename)
           VALUES ($1)`,
          [filename],
        );

        await client.query("COMMIT");
        console.log(`SUCCESS ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`${filename} failed: ${error.message}`);
      }
    }

    console.log("All pending migrations completed.");
  } finally {
    try {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock($1)", [
          MIGRATION_LOCK_ID,
        ]);
      }
    } finally {
      client.release();
      await pool.end();
    }
  }
}

runMigrations().catch((error) => {
  console.error("Migration error:", error.message);
  process.exitCode = 1;
});
