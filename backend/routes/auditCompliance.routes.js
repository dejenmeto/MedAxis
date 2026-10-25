const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const auditCompliance = require("../controllers/auditCompliance.controller");

const router = express.Router();

router.use(authenticate);

const managers = ["super_admin", "hospital_admin"];
const auditors = [...managers, "accountant"];

// Summary and read-only audit history.
router.get("/summary", authorize(...auditors), auditCompliance.summary);

router.get("/logs", authorize(...auditors), auditCompliance.listLogs);

// Compliance checklist.
router.get("/checks", authorize(...auditors), auditCompliance.listChecks);

router.post("/checks", authorize(...managers), auditCompliance.createCheck);

router.put("/checks/:id", authorize(...managers), auditCompliance.updateCheck);

router.delete(
  "/checks/:id",
  authorize(...managers),
  auditCompliance.deleteCheck,
);

module.exports = router;
