const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const queue = require("../controllers/queue.controller");

const router = express.Router();

const allowedRoles = [
  "super_admin",
  "hospital_admin",
  "doctor",
  "nurse",
  "receptionist",
  "lab_technician",
  "radiologist",
];

router.use(authenticate);
router.use(authorize(...allowedRoles));

// Put specific paths before /:id paths.
router.get("/dashboard", queue.getDashboard);
router.get("/", queue.listQueue);
router.post("/", queue.createQueueEntry);
router.put("/:id", queue.updateQueueEntry);
router.patch("/:id/status", queue.updateQueueStatus);
router.delete("/:id", queue.cancelQueueEntry);

module.exports = router;
