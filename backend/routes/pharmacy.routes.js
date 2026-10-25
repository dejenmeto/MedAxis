const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const pharmacy = require("../controllers/pharmacy.controller");

// Require authentication for all pharmacy endpoints.
router.use(authenticate);

// Medication catalogue
router.get("/medications", pharmacy.getMedications);
router.post("/medications", pharmacy.createMedication);
router.put("/medications/:id", pharmacy.updateMedication);
router.patch("/medications/:id/active", pharmacy.setMedicationActive);

// Batch inventory and stock receipts
router.get("/batches", pharmacy.getBatches);
router.post("/batches/receive", pharmacy.receiveStock);

// Dispensing and stock movement history
router.post("/dispense", pharmacy.dispenseStock);
router.get("/movements", pharmacy.getMovements);

module.exports = router;
