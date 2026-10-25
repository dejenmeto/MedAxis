require("dotenv").config();

const { pool } = require("./config/database");

async function checkCatalog() {
  try {
    const result = await pool.query(`
      SELECT
        hospital_id,
        COUNT(*) AS total_tests,
        COUNT(*) FILTER (WHERE is_active = TRUE) AS active_tests
      FROM lab_test_catalog
      GROUP BY hospital_id
      ORDER BY hospital_id
    `);

    console.table(result.rows);
  } catch (error) {
    console.error("Catalogue check failed:", error.message);
  } finally {
    await pool.end();
  }
}

checkCatalog();
