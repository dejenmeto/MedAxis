const express = require("express");
const authenticate = require("../middlewares/authenticate");
const emr = require("../controllers/emr.controller");

const router = express.Router();

// All EMR endpoints require authentication.
router.use(authenticate);

// Encounters
router.get("/encounters", emr.list);
router.post("/encounters", emr.create);
router.get("/encounters/:id", emr.getById);
router.patch("/encounters/:id", emr.update);

// Clinical details belonging to an encounter
router.post("/encounters/:id/vitals", emr.addVitals);
router.post("/encounters/:id/diagnoses", emr.addDiagnosis);

module.exports = router;
