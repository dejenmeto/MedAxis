const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const controller = require("../controllers/staff.controller");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  controller.list,
);

router.post("/", authorize("super_admin", "hospital_admin"), controller.create);

router.put(
  "/:id",
  authorize("super_admin", "hospital_admin"),
  controller.update,
);

router.delete(
  "/:id",
  authorize("super_admin", "hospital_admin"),
  controller.remove,
);

module.exports = router;
