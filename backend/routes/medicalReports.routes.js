const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/medicalReports.controller");

router.use(authenticate);

router.get("/", controller.listReports);
router.get("/:id", controller.getReport);
router.post("/", controller.createReport);
router.patch("/:id", controller.updateReport);
router.patch("/:id/finalize", controller.finalizeReport);
router.patch("/:id/archive", controller.archiveReport);

module.exports = router;
