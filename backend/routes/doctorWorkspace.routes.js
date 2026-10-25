const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/doctorWorkspace.controller");

const allowedRoles = ["super_admin", "hospital_admin", "doctor"];

function requireWorkspaceRole(req, res, next) {
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({
      message: "You do not have access to the doctor workspace.",
    });
  }
  next();
}

router.use(authenticate);
router.use(requireWorkspaceRole);

router.get("/", controller.getWorkspace);
router.post("/tasks", controller.createTask);
router.patch("/tasks/:id/status", controller.updateTaskStatus);
router.post("/notes", controller.createClinicalNote);

module.exports = router;
