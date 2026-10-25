require("dotenv").config();

const { pool } = require("../../config/database");

async function runSeeders() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create the hospital only if it does not already exist.
    await client.query(
      `INSERT INTO hospitals (name, code, city, region, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (code) DO NOTHING`,
      ["MedAxis General Hospital", "MEDAXIS-001", "Bishoftu", "Oromia"],
    );

    // 2. Find the existing hospital ID.
    const hospitalResult = await client.query(
      `SELECT id
       FROM hospitals
       WHERE code = $1`,
      ["MEDAXIS-001"],
    );

    if (hospitalResult.rows.length === 0) {
      throw new Error("Hospital MEDAXIS-001 was not found.");
    }

    const hospitalId = hospitalResult.rows[0].id;

    // 3. Starter laboratory tests for the catalogue.
    const laboratoryTests = [
      ["CBC", "Complete Blood Count", "Whole blood", "Hematology", 250, 4],
      ["FBS", "Fasting Blood Sugar", "Blood", "Clinical Chemistry", 100, 2],
      ["RBS", "Random Blood Sugar", "Blood", "Clinical Chemistry", 100, 2],
      ["LFT", "Liver Function Test", "Blood", "Clinical Chemistry", 450, 24],
      ["RFT", "Renal Function Test", "Blood", "Clinical Chemistry", 400, 24],
      ["UA", "Urinalysis", "Urine", "Clinical Pathology", 120, 4],
      ["STOOL", "Stool Examination", "Stool", "Parasitology", 150, 4],
      ["MALARIA", "Malaria Test", "Blood", "Parasitology", 150, 4],
      ["HBSAG", "Hepatitis B Surface Antigen", "Blood", "Serology", 250, 4],
      ["HIV", "HIV Screening Test", "Blood", "Serology", 200, 4],
      ["PREG", "Pregnancy Test", "Urine", "Serology", 100, 2],
      [
        "ESR",
        "Erythrocyte Sedimentation Rate",
        "Whole blood",
        "Hematology",
        120,
        4,
      ],
    ];

    // 4. Insert each test, avoiding duplicate hospital/test-code pairs.
    for (const test of laboratoryTests) {
      await client.query(
        `INSERT INTO lab_test_catalog (
           hospital_id,
           test_code,
           test_name,
           specimen_type,
           department_name,
           price,
           turnaround_hours,
           is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         ON CONFLICT (hospital_id, test_code) DO NOTHING`,
        [hospitalId, ...test],
      );
    }

    await client.query("COMMIT");

    console.log("Initial hospital seed completed.");
    console.log(`Laboratory catalogue seeded for hospital ID ${hospitalId}.`);
    console.log(`Starter tests processed: ${laboratoryTests.length}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeeders().catch((error) => {
  console.error("Seeder failed:", error.message);
  process.exitCode = 1;
});
