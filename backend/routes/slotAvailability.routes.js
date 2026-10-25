const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/slotAvailability.controller");

router.use(authenticate);

router.get("/", controller.listSlots);
router.post("/", controller.createSlot);
router.patch("/:id", controller.updateSlot);
router.post("/:id/book", controller.bookSlot);
router.patch("/:id/cancel", controller.cancelSlot);

module.exports = router;
