const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/patientPortal.controller");

router.use(authenticate);

router.get("/dashboard", controller.dashboard);

router.get("/admin/access", controller.listAccess);
router.post("/admin/access", controller.createAccess);
router.patch("/admin/access/:id", controller.updateAccessStatus);

router.get("/patients/:patientId/appointments", (req, res) =>
  controller.patientResource(req, res, "appointments"),
);

router.get("/patients/:patientId/documents", (req, res) =>
  controller.patientResource(req, res, "documents"),
);

router.get("/patients/:patientId/reports", (req, res) =>
  controller.patientResource(req, res, "reports"),
);

router.get("/patients/:patientId/invoices", (req, res) =>
  controller.patientResource(req, res, "invoices"),
);

router.get("/patients/:patientId/payments", (req, res) =>
  controller.patientResource(req, res, "payments"),
);

module.exports = router;
