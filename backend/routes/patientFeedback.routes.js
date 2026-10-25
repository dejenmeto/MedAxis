const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/patientFeedback.controller");

router.use(authenticate);

router.get("/", controller.listFeedback);
router.post("/", controller.createFeedback);
router.patch("/:id", controller.updateFeedback);

router.get("/:id/notes", controller.listNotes);
router.post("/:id/notes", controller.createNote);

module.exports = router;
