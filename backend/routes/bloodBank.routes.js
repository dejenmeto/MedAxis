const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const bloodBank = require("../controllers/bloodBank.controller");

const router = express.Router();

router.use(authenticate);

router.get("/summary", bloodBank.getSummary);
router.post(
  "/issue",
  authorize(
    "super_admin",
    "hospital_admin",
    "doctor",
    "nurse",
    "lab_technician",
    "receptionist",
  ),
  bloodBank.issueUnit,
);

router.get("/:resource", bloodBank.list);

router.post(
  "/:resource",
  authorize(
    "super_admin",
    "hospital_admin",
    "doctor",
    "nurse",
    "lab_technician",
    "receptionist",
  ),
  bloodBank.create,
);

router.put(
  "/:resource/:id",
  authorize(
    "super_admin",
    "hospital_admin",
    "doctor",
    "nurse",
    "lab_technician",
    "receptionist",
  ),
  bloodBank.update,
);

router.delete(
  "/:resource/:id",
  authorize("super_admin", "hospital_admin"),
  bloodBank.remove,
);
router.put(
  "/units/:id/release",
  authorize("super_admin", "hospital_admin", "lab_technician"),
  bloodBank.releaseUnit,
);

module.exports = router;
