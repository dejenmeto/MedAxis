const express = require("express");
const router = express.Router();

const controller = require("../controllers/telemedicine.controller");
const authenticate = require("../middlewares/authenticate");

router.use(authenticate);

router.get("/dashboard", controller.getDashboard);
router.get("/consultations", controller.listConsultations);
router.post("/consultations", controller.createConsultation);
router.put("/consultations/:id", controller.updateConsultation);
router.patch("/consultations/:id/status", controller.updateConsultationStatus);

module.exports = router;
