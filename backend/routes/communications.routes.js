const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/communications.controller");

const adminRoles = ["super_admin", "hospital_admin"];

router.use(authenticate);

function requireAdmin(req, res, next) {
  if (!adminRoles.includes(req.user?.role)) {
    return res.status(403).json({ message: "Administrator access required." });
  }
  next();
}

router.use(requireAdmin);

router.get("/templates", controller.listTemplates);
router.post("/templates", controller.saveTemplate);
router.delete("/templates/:id", controller.deleteTemplate);

router.post("/send", controller.sendMessage);
router.get("/logs", controller.listLogs);
router.post("/logs/:id/retry", controller.retryMessage);

module.exports = router;
