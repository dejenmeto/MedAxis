const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const icu = require("../controllers/icu.controller");

const router = express.Router();

router.use(authenticate);

// ICU dashboard
router.get("/summary", icu.getSummary);

// ICU units
router.get("/units", icu.listUnits);
router.post(
  "/units",
  authorize("super_admin", "hospital_admin"),
  icu.createUnit,
);
router.put(
  "/units/:id",
  authorize("super_admin", "hospital_admin"),
  icu.updateUnit,
);

// Beds
router.get("/beds", icu.listBeds);
router.post("/beds", authorize("super_admin", "hospital_admin"), icu.createBed);
router.put(
  "/beds/:id",
  authorize("super_admin", "hospital_admin"),
  icu.updateBed,
);

// Patient stays
router.get("/stays", icu.listStays);
router.get("/stays/:id", icu.getStay);
router.post(
  "/stays",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  icu.createStay,
);
router.put(
  "/stays/:id",
  authorize("super_admin", "hospital_admin", "doctor"),
  icu.updateStay,
);
router.patch(
  "/stays/:id/discharge",
  authorize("super_admin", "hospital_admin", "doctor"),
  icu.dischargeStay,
);

// Observations
router.get("/stays/:stayId/observations", icu.listObservations);
router.post(
  "/observations",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  icu.createObservation,
);
router.put(
  "/observations/:id",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  icu.updateObservation,
);
router.delete(
  "/observations/:id",
  authorize("super_admin", "hospital_admin", "doctor"),
  icu.deleteObservation,
);

// Clinical notes
router.get("/stays/:stayId/notes", icu.listNotes);
router.post(
  "/notes",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  icu.createNote,
);
router.put(
  "/notes/:id",
  authorize("super_admin", "hospital_admin", "doctor"),
  icu.updateNote,
);
router.delete(
  "/notes/:id",
  authorize("super_admin", "hospital_admin", "doctor"),
  icu.deleteNote,
);

// Transfers
router.get("/transfers", icu.listTransfers);
router.post(
  "/transfers",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  icu.createTransfer,
);

module.exports = router;
