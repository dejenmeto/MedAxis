const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const controller = require("../controllers/dashboard.controller");

const router = express.Router();

router.use(authenticate);

router.get(
  "/overview",
  authorize(
    "super_admin",
    "hospital_admin",
    "doctor",
    "nurse",
    "receptionist",
    "lab_technician",
    "radiologist",
    "pharmacist",
    "accountant",
  ),
  controller.overview,
);

router.get(
  "/recent-appointments",
  authorize("super_admin", "hospital_admin", "doctor", "nurse", "receptionist"),
  controller.recentAppointments,
);

module.exports = router;
