const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const controller = require("../controllers/inpatient.controller");

const router = express.Router();

// All endpoints require a valid authenticated session.
router.use(authenticate);

// -------------------------
// ROOMS
// -------------------------

router.get(
  "/rooms",
  authorize("super_admin", "hospital_admin", "doctor", "nurse", "receptionist"),
  controller.listRooms,
);

router.get(
  "/rooms/:id",
  authorize("super_admin", "hospital_admin", "doctor", "nurse", "receptionist"),
  controller.getRoom,
);

router.post(
  "/rooms",
  authorize("super_admin", "hospital_admin"),
  controller.createRoom,
);

router.put(
  "/rooms/:id",
  authorize("super_admin", "hospital_admin"),
  controller.updateRoom,
);

router.patch(
  "/rooms/:id/deactivate",
  authorize("super_admin", "hospital_admin"),
  controller.deactivateRoom,
);

// -------------------------
// BEDS
// -------------------------

router.get(
  "/beds",
  authorize("super_admin", "hospital_admin", "doctor", "nurse", "receptionist"),
  controller.listBeds,
);

router.get(
  "/beds/:id",
  authorize("super_admin", "hospital_admin", "doctor", "nurse", "receptionist"),
  controller.getBed,
);

router.post(
  "/beds",
  authorize("super_admin", "hospital_admin"),
  controller.createBed,
);

router.put(
  "/beds/:id",
  authorize("super_admin", "hospital_admin", "nurse"),
  controller.updateBed,
);

// -------------------------
// ADMISSIONS
// -------------------------

router.get(
  "/admissions",
  authorize("super_admin", "hospital_admin", "doctor", "nurse", "receptionist"),
  controller.listAdmissions,
);

router.get(
  "/admissions/:id",
  authorize("super_admin", "hospital_admin", "doctor", "nurse", "receptionist"),
  controller.getAdmission,
);

router.post(
  "/admissions",
  authorize("super_admin", "hospital_admin", "doctor", "nurse", "receptionist"),
  controller.createAdmission,
);

router.put(
  "/admissions/:id",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  controller.updateAdmission,
);

router.patch(
  "/admissions/:id/discharge",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  controller.dischargeAdmission,
);

router.patch(
  "/admissions/:id/cancel",
  authorize("super_admin", "hospital_admin"),
  controller.cancelAdmission,
);

module.exports = router;
