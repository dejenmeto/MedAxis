const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/calendar.controller");

router.use(authenticate);

router.get("/", controller.listEvents);
router.post("/", controller.createEvent);
router.patch("/:id", controller.updateEvent);
router.delete("/:id", controller.cancelEvent);

module.exports = router;
