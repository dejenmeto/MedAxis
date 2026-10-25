const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const payroll = require("../controllers/payroll.controller");

const router = express.Router();

// Require authentication for every Payroll endpoint.
router.use(authenticate);

const managers = ["super_admin", "hospital_admin"];
const payrollStaff = [...managers, "accountant"];

// Read Payroll information.
router.get("/summary", authorize(...payrollStaff), payroll.summary);

router.get("/:resource", authorize(...payrollStaff), payroll.list);

// Create payroll periods and salary structures.
router.post("/:resource", authorize(...managers), payroll.create);

// Generate payroll records for a period.
router.post(
  "/periods/:id/process",
  authorize(...managers),
  payroll.processPeriod,
);

// Approve an individual payroll record.
router.put(
  "/records/:id/approve",
  authorize(...managers),
  payroll.approveRecord,
);

// Record a payroll payment.
router.post(
  "/records/:id/payments",
  authorize(...managers, "accountant"),
  payroll.recordPayment,
);

module.exports = router;
