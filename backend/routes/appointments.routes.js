const express = require("express");
const authenticate = require("../middlewares/authenticate");
const appointments = require("../controllers/appointments.controller");

const router = express.Router();

// All appointment routes require a valid access token.
router.use(authenticate);

router.get("/", appointments.list);
router.post("/", appointments.create);
router.get("/:id", appointments.getById);
router.patch("/:id", appointments.update);
router.patch("/:id/cancel", appointments.cancel);
router.patch("/:id/status", appointments.changeStatus);

module.exports = router;
