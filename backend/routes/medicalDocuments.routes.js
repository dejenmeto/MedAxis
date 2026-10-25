const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/medicalDocuments.controller");
const {
  uploadMedicalDocument,
} = require("../middlewares/medicalDocumentUpload");

router.use(authenticate);

router.get("/", controller.listDocuments);
router.post(
  "/",
  uploadMedicalDocument.single("document"),
  controller.uploadDocument,
);

router.get("/:id/download", controller.downloadDocument);
router.patch("/:id/archive", controller.archiveDocument);
router.patch("/:id", controller.updateDocument);

module.exports = router;
