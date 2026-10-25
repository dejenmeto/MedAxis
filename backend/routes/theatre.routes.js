const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const theatre = require("../controllers/theatre.controller");

// Every theatre endpoint requires authentication.
router.use(authenticate);

// Read access for hospital users. Write access is restricted below.
router.get("/dashboard", theatre.getDashboard);

router.get("/rooms", theatre.listRooms);
router.post(
  "/rooms",
  authorize("super_admin", "hospital_admin"),
  theatre.createRoom,
);
router.patch(
  "/rooms/:id",
  authorize("super_admin", "hospital_admin"),
  theatre.updateRoom,
);

router.get("/procedures", theatre.listProcedures);
router.post(
  "/procedures",
  authorize("super_admin", "hospital_admin", "doctor"),
  theatre.createProcedure,
);
router.patch(
  "/procedures/:id",
  authorize("super_admin", "hospital_admin", "doctor"),
  theatre.updateProcedure,
);

router.get("/surgeries", theatre.listSurgeries);
router.post(
  "/surgeries",
  authorize("super_admin", "hospital_admin", "doctor", "nurse", "receptionist"),
  theatre.createSurgery,
);
router.patch(
  "/surgeries/:id/status",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  theatre.updateSurgeryStatus,
);

router.put(
  "/surgeries/:id/operation-record",
  authorize("super_admin", "hospital_admin", "doctor"),
  theatre.saveOperationRecord,
);

module.exports = router;
